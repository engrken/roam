import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { addCalendarMonths, grantReferralMonth } from "@/lib/referrals";
import { expirePendingSubscriptionPayments, notifySubscriptionPayment } from "@/lib/subscription-payments";
import { sendReferralRewardEmail } from "@/lib/email";

export const runtime = "nodejs";

const defaultMethods = [
  { key: "GCASH", label: "GCash", sortOrder: 1 },
  { key: "MAYA", label: "Maya", sortOrder: 2 },
  { key: "BANK", label: "Bank transfer / QR", sortOrder: 3 },
];

async function ensureMethods() {
  for (const method of defaultMethods) {
    await prisma.subscriptionPaymentMethod.upsert({
      where: { key: method.key },
      create: { ...method, enabled: false },
      update: {},
    });
  }
}

export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  await expirePendingSubscriptionPayments();
  await ensureMethods();
  const [methods, submissions] = await Promise.all([
    prisma.subscriptionPaymentMethod.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.subscriptionPaymentSubmission.findMany({
      orderBy: { createdAt: "desc" }, take: 100,
      include: { tenant: { select: { id: true, name: true, slug: true, email: true } } },
    }),
  ]);
  return NextResponse.json({
    methods,
    submissions: submissions.map(item => ({
      id: item.id, tenantId: item.tenantId, tenantName: item.tenant.name, tenantSlug: item.tenant.slug,
      tenantEmail: item.tenant.email, methodLabel: item.methodLabel, accountName: item.accountName,
      reference: item.reference, amount: Number(item.amount), paidAt: item.paidAt.toISOString(),
      receiptData: item.receiptData, receiptContentType: item.receiptContentType, status: item.status,
      provisionalUntil: item.provisionalUntil.toISOString(), rejectionReason: item.rejectionReason,
      createdAt: item.createdAt.toISOString(), reviewedAt: item.reviewedAt?.toISOString() || null,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null);

  if (body?.action === "save-method") {
    const key = typeof body.key === "string" ? body.key : "";
    const label = typeof body.label === "string" ? body.label.trim().slice(0, 60) : "";
    const accountName = typeof body.accountName === "string" ? body.accountName.trim().slice(0, 120) : "";
    const instructions = typeof body.instructions === "string" ? body.instructions.trim().slice(0, 1000) : "";
    const qrImageData = typeof body.qrImageData === "string" ? body.qrImageData : null;
    const qrContentType = typeof body.qrContentType === "string" ? body.qrContentType : null;
    if (!defaultMethods.some(method => method.key === key) || !label) return NextResponse.json({ error: "Choose a valid payment method and label." }, { status: 400 });
    if (qrImageData && (!/^data:image\/(png|jpeg|webp);base64,/.test(qrImageData) || qrImageData.length > 2800000)) return NextResponse.json({ error: "QR image must be PNG, JPG or WebP up to 2 MB." }, { status: 400 });
    if (body.enabled === true && (body.clearQr === true || (!qrImageData && !((await prisma.subscriptionPaymentMethod.findUnique({ where: { key }, select: { qrImageData: true } }))?.qrImageData)))) return NextResponse.json({ error: "Upload a QR image before enabling this payment method." }, { status: 400 });
    if (qrImageData && !["image/png", "image/jpeg", "image/webp"].includes(qrContentType || "")) return NextResponse.json({ error: "Unsupported QR image format." }, { status: 400 });
    const existing = await prisma.subscriptionPaymentMethod.findUnique({ where: { key } });
    const method = await prisma.subscriptionPaymentMethod.upsert({
      where: { key },
      create: { key, label, accountName: accountName || null, instructions: instructions || null, enabled: body.enabled === true, qrImageData, qrContentType },
      update: {
        label, accountName: accountName || null, instructions: instructions || null, enabled: body.enabled === true,
        ...(body.clearQr === true ? { qrImageData: null, qrContentType: null } : qrImageData ? { qrImageData, qrContentType } : {}),
      },
    });
    await prisma.platformAuditLog.create({ data: {
      actorUserId: admin.id, actorEmail: admin.email, action: "subscription.payment_method.updated",
      entityType: "subscriptionPaymentMethod", entityId: method.id,
      details: { key, enabled: method.enabled, qrReplaced: !!qrImageData || body.clearQr === true, existed: !!existing },
    } });
    return NextResponse.json({ method });
  }

  if (body?.action === "review-submission") {
    const submissionId = typeof body.submissionId === "string" ? body.submissionId : "";
    const decision = body.decision === "approve" ? "APPROVED" : body.decision === "reject" ? "REJECTED" : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!submissionId || !decision) return NextResponse.json({ error: "Choose a valid payment review decision." }, { status: 400 });
    const now = new Date();
    let result: { tenantId: string; reference: string; amount: number; status: string; referralQualified: boolean; referrerTenantId: string | null };
    try {
      result = await prisma.$transaction(async tx => {
        const item = await tx.subscriptionPaymentSubmission.findUnique({ where: { id: submissionId } });
        if (!item || item.status !== "PENDING") throw new Error("PAYMENT_NOT_PENDING");
        if (item.provisionalUntil <= now) throw new Error("PAYMENT_EXPIRED");
        await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1)) IS NULL AS locked", "subscription-payment:" + item.tenantId);
        const submission = await tx.subscriptionPaymentSubmission.findUnique({ where: { id: submissionId } });
        if (!submission || submission.status !== "PENDING") throw new Error("PAYMENT_NOT_PENDING");
        if (submission.provisionalUntil <= now) throw new Error("PAYMENT_EXPIRED");
        let referralQualified = false;
        let referrerTenantId: string | null = null;
        if (decision === "APPROVED") {
          const subscription = await tx.subscription.findUnique({ where: { tenantId: item.tenantId }, include: { plan: { select: { name: true, monthlyPrice: true, active: true } }, tenant: { select: { currency: true } } } });
          if (!subscription || !subscription.plan.active) throw new Error("PLAN_UNAVAILABLE");
          if (Number(submission.amount) < Number(subscription.plan.monthlyPrice)) throw new Error("PAYMENT_BELOW_PRICE");
          const paidCount = await tx.billingRecord.count({ where: { tenantId: item.tenantId, status: "PAID" } });
          const periodStart = subscription.currentPeriodEnd && subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
          let periodEnd = addCalendarMonths(periodStart, 1 + subscription.referralCreditMonths);
          if (paidCount === 0) {
            const referral = await tx.referral.findUnique({ where: { referredTenantId: item.tenantId } });
            if (referral && referral.status === "PENDING") {
              if (referral.registeredAt <= now && referral.expiresAt >= now) {
                const claim = await tx.referral.updateMany({ where: { id: referral.id, status: "PENDING", expiresAt: { gte: now } }, data: { status: "REWARDED", qualifiedAt: now, rewardedAt: now } });
                if (claim.count === 1) {
                  periodEnd = addCalendarMonths(periodEnd, 1);
                  await grantReferralMonth(tx, referral.referrerTenantId);
                  referralQualified = true;
                  referrerTenantId = referral.referrerTenantId;
                }
              } else {
                await tx.referral.updateMany({ where: { id: referral.id, status: "PENDING" }, data: { status: "EXPIRED" } });
              }
            }
          } else {
            await tx.referral.updateMany({ where: { referredTenantId: item.tenantId, status: "PENDING" }, data: { status: "EXPIRED" } });
          }
          await tx.billingRecord.create({
            data: {
              tenantId: item.tenantId, description: "ROAM subscription · " + subscription.plan.name + " · transaction " + submission.reference,
              reference: "ROAM-SUB-" + submission.id, amount: submission.amount,
              currency: subscription.tenant.currency || "PHP", status: "PAID", issuedAt: now, paidAt: now,
            },
          });
          await tx.subscription.update({
            where: { tenantId: item.tenantId },
            data: { status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, trialEndsAt: null, trialGraceEndsAt: null, referralCreditMonths: 0 },
          });
          await tx.tenant.update({ where: { id: item.tenantId }, data: { status: "ACTIVE" } });
        } else {
          await tx.subscription.updateMany({
            where: { tenantId: item.tenantId, status: "payment_pending" },
            data: {
              status: item.previousSubscriptionStatus, currentPeriodStart: item.previousCurrentPeriodStart,
              currentPeriodEnd: item.previousCurrentPeriodEnd, trialEndsAt: item.previousTrialEndsAt,
              trialGraceEndsAt: item.previousTrialGraceEndsAt,
            },
          });
          await tx.tenant.update({ where: { id: item.tenantId }, data: { status: item.previousTenantStatus } });
        }
        const updated = await tx.subscriptionPaymentSubmission.updateMany({
          where: { id: submissionId, status: "PENDING", provisionalUntil: { gt: now } },
          data: { status: decision, reviewedById: admin.id, reviewedAt: now, rejectionReason: decision === "REJECTED" ? (reason || "Payment could not be verified.") : null },
        });
        if (updated.count !== 1) throw new Error("PAYMENT_NOT_PENDING");
        await tx.platformAuditLog.create({ data: {
          actorUserId: admin.id, actorEmail: admin.email, action: "subscription.payment." + decision.toLowerCase(),
          entityType: "subscriptionPaymentSubmission", entityId: item.id,
          details: { tenantId: item.tenantId, amount: Number(item.amount), reference: item.reference },
        } });
        return { tenantId: item.tenantId, reference: item.reference, amount: Number(item.amount), status: decision, referralQualified, referrerTenantId };
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "PAYMENT_NOT_PENDING") return NextResponse.json({ error: "This payment has already been reviewed." }, { status: 409 });
      if (code === "PAYMENT_EXPIRED") {
        await expirePendingSubscriptionPayments(now);
        return NextResponse.json({ error: "The provisional access period has expired. The previous subscription state has been restored." }, { status: 409 });
      }
      if (code === "PLAN_UNAVAILABLE") return NextResponse.json({ error: "The tenant's assigned plan is no longer available." }, { status: 409 });
      if (code === "PAYMENT_BELOW_PRICE") return NextResponse.json({ error: "The submitted amount is below the current plan's monthly price." }, { status: 400 });
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "A billing reference conflict prevented approval." }, { status: 409 });
      console.error("Subscription payment review failed", error);
      return NextResponse.json({ error: "Unable to review this payment submission." }, { status: 500 });
    }
    await notifySubscriptionPayment({ tenantId: result.tenantId, status: result.status as "APPROVED" | "REJECTED", reference: result.reference, amount: result.amount, reason });
    let referralEmailsSent = 0;
    if (result.referralQualified && result.referrerTenantId) {
      const tenants = await prisma.tenant.findMany({ where: { id: { in: [result.tenantId, result.referrerTenantId] } }, select: { id: true, name: true, slug: true, memberships: { where: { role: "OWNER" }, select: { user: { select: { email: true } } }, take: 1 } } });
      const referred = tenants.find(item => item.id === result.tenantId);
      const referrer = tenants.find(item => item.id === result.referrerTenantId);
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/+$/, "");
      const emails = await Promise.allSettled([
        ...(referred?.memberships[0]?.user.email && referrer ? [sendReferralRewardEmail({ recipient: referred.memberships[0].user.email, businessName: referred.name, referredBusinessName: referrer.name, accountUrl: baseUrl + "/workspace/" + encodeURIComponent(referred.slug) + "/account" })] : []),
        ...(referrer?.memberships[0]?.user.email && referred ? [sendReferralRewardEmail({ recipient: referrer.memberships[0].user.email, businessName: referrer.name, referredBusinessName: referred.name, accountUrl: baseUrl + "/workspace/" + encodeURIComponent(referrer.slug) + "/account" })] : []),
      ]);
      referralEmailsSent = emails.filter(item => item.status === "fulfilled").length;
    }
    return NextResponse.json({ status: result.status, referralQualified: result.referralQualified, referralEmailsSent, message: decision === "APPROVED" ? "Payment approved. The subscription is now active or extended." : "Payment rejected. The previous subscription state has been restored." });
  }
  return NextResponse.json({ error: "Unsupported payment management action." }, { status: 400 });
}
