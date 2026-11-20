import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { expirePendingSubscriptionPayments, notifySubscriptionPayment } from "@/lib/subscription-payments";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (access.role !== "OWNER") return NextResponse.json({ error: "Only the workspace owner can manage subscription payments." }, { status: 403 });
  await expirePendingSubscriptionPayments();
  const [methods, submissions, subscription] = await Promise.all([
    prisma.subscriptionPaymentMethod.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" }, select: { id: true, key: true, label: true, accountName: true, instructions: true, qrImageData: true, qrContentType: true } }),
    prisma.subscriptionPaymentSubmission.findMany({ where: { tenantId: access.tenant.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, methodLabel: true, reference: true, amount: true, paidAt: true, status: true, provisionalUntil: true, rejectionReason: true, createdAt: true } }),
    prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, include: { plan: { select: { name: true, monthlyPrice: true } } } }),
  ]);
  return NextResponse.json({
    methods, submissions: submissions.map(item => ({ ...item, amount: Number(item.amount), paidAt: item.paidAt.toISOString(), provisionalUntil: item.provisionalUntil.toISOString(), createdAt: item.createdAt.toISOString() })),
    subscription: subscription ? { tier: subscription.tier, status: subscription.status, planName: subscription.plan.name, monthlyPrice: Number(subscription.plan.monthlyPrice), currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null } : null,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (access.role !== "OWNER") return NextResponse.json({ error: "Only the workspace owner can submit subscription payments." }, { status: 403 });
  await expirePendingSubscriptionPayments();
  const body = await request.json().catch(() => null);
  const methodId = typeof body?.methodId === "string" ? body.methodId : "";
  const reference = typeof body?.reference === "string" ? body.reference.trim().slice(0, 120) : "";
  const amount = Number(body?.amount);
  const paidAt = new Date(body?.paidAt);
  const receiptData = typeof body?.receiptData === "string" ? body.receiptData : null;
  const receiptContentType = typeof body?.receiptContentType === "string" ? body.receiptContentType : null;
  if (!methodId || !reference || reference.length < 3 || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || !Number.isFinite(paidAt.getTime()) || paidAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Enter a valid payment method, transaction reference, amount and payment date." }, { status: 400 });
  }
  if (receiptData && (!/^data:image\/(png|jpeg|webp);base64,/.test(receiptData) || receiptData.length > 2800000)) {
    return NextResponse.json({ error: "Receipt must be a PNG, JPG or WebP image up to 2 MB." }, { status: 400 });
  }
  const method = await prisma.subscriptionPaymentMethod.findFirst({ where: { id: methodId, enabled: true }, select: { id: true, label: true, accountName: true } });
  if (!method) return NextResponse.json({ error: "That payment method is no longer available." }, { status: 404 });
  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1)) IS NULL AS locked", "subscription-payment:" + access.tenant.id);
      const [tenant, subscription, pending] = await Promise.all([
        tx.tenant.findUnique({ where: { id: access.tenant.id }, select: { status: true } }),
        tx.subscription.findUnique({ where: { tenantId: access.tenant.id }, include: { plan: { select: { monthlyPrice: true } } } }),
        tx.subscriptionPaymentSubmission.findFirst({ where: { tenantId: access.tenant.id, status: "PENDING" }, select: { id: true } }),
      ]);
      if (!tenant || !subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
      if (subscription.tier === "FREE" || Number(subscription.plan.monthlyPrice) <= 0) throw new Error("COMPLIMENTARY_PLAN");
      if (amount < Number(subscription.plan.monthlyPrice)) throw new Error("PAYMENT_BELOW_PLAN_PRICE");
      if (pending) throw new Error("PAYMENT_ALREADY_PENDING");
      const provisionalUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const submission = await tx.subscriptionPaymentSubmission.create({
        data: {
          tenantId: access.tenant.id, methodId: method.id, methodLabel: method.label, accountName: method.accountName,
          reference, amount, paidAt, receiptData, receiptContentType, provisionalUntil,
          previousTenantStatus: tenant.status,
          previousSubscriptionStatus: subscription.status,
          previousCurrentPeriodStart: subscription.currentPeriodStart,
          previousCurrentPeriodEnd: subscription.currentPeriodEnd,
          previousTrialEndsAt: subscription.trialEndsAt,
          previousTrialGraceEndsAt: subscription.trialGraceEndsAt,
        },
        select: { id: true, reference: true, amount: true, provisionalUntil: true },
      });
      await tx.subscription.update({ where: { tenantId: access.tenant.id }, data: { status: "payment_pending" } });
      return submission;
    });
    await notifySubscriptionPayment({ tenantId: access.tenant.id, status: "SUBMITTED", reference, amount, provisionalUntil: result.provisionalUntil });
    const adminEmails = (process.env.ROAM_ADMIN_EMAILS || "").split(",").map(email => email.trim()).filter(Boolean);
    if (adminEmails.length) {
      const { sendSubscriptionPaymentEmail } = await import("@/lib/email");
      await Promise.allSettled(adminEmails.map(recipient => sendSubscriptionPaymentEmail({
        recipient, businessName: access.tenant.name, status: "SUBMITTED", reference, amount,
        accountUrl: (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/+$/, "") + "/admin/payments",
        provisionalUntil: result.provisionalUntil,
      })));
    }
    return NextResponse.json({ submission: { id: result.id, reference: result.reference, amount: Number(result.amount), provisionalUntil: result.provisionalUntil.toISOString(), status: "PENDING" } }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SUBSCRIPTION_NOT_FOUND") return NextResponse.json({ error: "Your workspace does not have a subscription plan assigned." }, { status: 404 });
    if (code === "COMPLIMENTARY_PLAN") return NextResponse.json({ error: "Your complimentary plan does not require payment." }, { status: 400 });
    if (code === "PAYMENT_BELOW_PLAN_PRICE") return NextResponse.json({ error: "The submitted amount must cover at least one month of your current plan." }, { status: 400 });
    if (code === "PAYMENT_ALREADY_PENDING") return NextResponse.json({ error: "You already have a payment awaiting review." }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "That transaction reference has already been submitted for this payment method." }, { status: 409 });
    console.error("Subscription payment submission failed", error);
    return NextResponse.json({ error: "Unable to submit your payment details." }, { status: 500 });
  }
}
