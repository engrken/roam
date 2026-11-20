import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { addCalendarMonths, grantReferralMonth } from "@/lib/referrals";
import { sendReferralRewardEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const [plans, tenants, subscriptionRequests] = await Promise.all([
    prisma.plan.findMany({ where: { tier: { not: "FREE" } }, orderBy: { monthlyPrice: "asc" }, select: { id: true, tier: true, name: true, monthlyPrice: true, maxVehicles: true, maxBranches: true, maxStaff: true, active: true } }),
    prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, subscription: { select: { tier: true, status: true, currentPeriodEnd: true, trialEndsAt: true, plan: { select: { monthlyPrice: true } } } } } }),
    prisma.subscriptionChangeRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { tenant: { select: { name: true, slug: true } } } }),
  ]);
  return NextResponse.json({
    plans: plans.map(plan => ({ ...plan, monthlyPrice: Number(plan.monthlyPrice) })),
    tenants: tenants.map(tenant => ({ ...tenant, subscription: tenant.subscription ? { tier: tenant.subscription.tier, status: tenant.subscription.status, currentPeriodEnd: tenant.subscription.currentPeriodEnd?.toISOString() || null, trialEndsAt: tenant.subscription.trialEndsAt?.toISOString() || null, monthlyPrice: Number(tenant.subscription.plan.monthlyPrice) } : null })),
    subscriptionRequests: subscriptionRequests.map(item => ({ id: item.id, tenantId: item.tenantId, tenantName: item.tenant.name, tenantSlug: item.tenant.slug, currentTier: item.currentTier, requestedTier: item.requestedTier, status: item.status, createdAt: item.createdAt.toISOString() })),
  });
}

export async function PATCH(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (body?.action === "update-plan") {
    const tier = typeof body.tier === "string" ? body.tier : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const monthlyPrice = Number(body.monthlyPrice);
    const maxVehicles = body.maxVehicles === null || body.maxVehicles === "" ? null : Number(body.maxVehicles);
    const maxBranches = body.maxBranches === null || body.maxBranches === "" ? null : Number(body.maxBranches);
    const maxStaff = body.maxStaff === null || body.maxStaff === "" ? null : Number(body.maxStaff);
    if (!["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].includes(tier) || !name || name.length > 60 || !Number.isFinite(monthlyPrice) || monthlyPrice < 0 || monthlyPrice > 100000000) {
      return NextResponse.json({ error: "Enter a valid plan name, tier and monthly price." }, { status: 400 });
    }
    for (const limit of [maxVehicles, maxBranches, maxStaff]) {
      if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 100000)) return NextResponse.json({ error: "Plan limits must be positive whole numbers or unlimited." }, { status: 400 });
    }
    const plan = await prisma.plan.update({
      where: { tier: tier as "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE" },
      data: { name, monthlyPrice, maxVehicles, maxBranches, maxStaff, active: body.active !== false },
      select: { id: true, tier: true, name: true, monthlyPrice: true, maxVehicles: true, maxBranches: true, maxStaff: true, active: true },
    }).catch(() => null);
    if (!plan) return NextResponse.json({ error: "Plan not found. Create a workspace first to initialize the standard plans." }, { status: 404 });
    await prisma.platformAuditLog.create({ data: {
      actorUserId: admin.id, actorEmail: admin.email, action: "plan.updated",
      entityType: "plan", entityId: plan.id,
      details: { tier: plan.tier, name: plan.name, monthlyPrice: Number(plan.monthlyPrice), active: plan.active },
    } });
    return NextResponse.json({ plan: { ...plan, monthlyPrice: Number(plan.monthlyPrice) } });
  }
  if (body?.action === "review-subscription-request") {
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const decision = body.decision === "approve" ? "APPROVED" : body.decision === "reject" ? "REJECTED" : "";
    if (!requestId || !decision) return NextResponse.json({ error: "Choose a valid subscription request decision." }, { status: 400 });
    const change = await prisma.subscriptionChangeRequest.findFirst({ where: { id: requestId, status: "PENDING" } });
    if (!change) return NextResponse.json({ error: "This request is no longer pending." }, { status: 404 });
    if (decision === "APPROVED") {
      if (change.requestedTier === "FREE") return NextResponse.json({ error: "The Complimentary plan has been retired. Choose a paid plan instead." }, { status: 409 });
      const plan = await prisma.plan.findUnique({ where: { tier: change.requestedTier, active: true } });
      if (!plan) return NextResponse.json({ error: "The requested plan is no longer available." }, { status: 409 });
      await prisma.subscription.upsert({
        where: { tenantId: change.tenantId },
        create: { tenantId: change.tenantId, planId: plan.id, tier: plan.tier, status: "manual_review", currentPeriodStart: new Date() },
        update: { planId: plan.id, tier: plan.tier, status: "manual_review", currentPeriodStart: new Date() },
      });
    }
    const reviewed = await prisma.subscriptionChangeRequest.update({
      where: { id: change.id },
      data: { status: decision, reviewedById: admin.id, reviewedAt: new Date() },
    });
    await prisma.platformAuditLog.create({ data: {
      actorUserId: admin.id, actorEmail: admin.email, action: "tenant.subscription.request." + decision.toLowerCase(),
      entityType: "tenant", entityId: change.tenantId,
      details: { requestId: change.id, currentTier: change.currentTier, requestedTier: change.requestedTier },
    } });
    return NextResponse.json({ request: { id: reviewed.id, status: reviewed.status }, message: decision === "APPROVED" ? "Plan changed. Subscription remains in manual billing review until payment is confirmed." : "Subscription change request rejected." });
  }
  if (body?.action === "record-subscription-payment") {
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const amount = Number(body.amount);
    const suppliedReference = typeof body.reference === "string" ? body.reference.trim().slice(0, 100) : "";
    if (!tenantId || !Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      return NextResponse.json({ error: "Enter a valid tenant and a verified payment amount greater than zero." }, { status: 400 });
    }
    const reference = suppliedReference || "ROAM-SUB-" + randomBytes(8).toString("hex").toUpperCase();
    try {
      const result = await prisma.$transaction(async tx => {
        const referralForLock = await tx.referral.findUnique({ where: { referredTenantId: tenantId }, select: { referrerTenantId: true } });
        const lockTenantIds = [tenantId, referralForLock?.referrerTenantId].filter((id): id is string => !!id).sort();
        for (const lockTenantId of lockTenantIds) {
          await tx.$queryRawUnsafe("SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1))) AS advisory_lock", "subscription-payment:" + lockTenantId);
        }
        const subscription = await tx.subscription.findUnique({
          where: { tenantId },
          include: { plan: { select: { name: true, monthlyPrice: true } }, tenant: { select: { currency: true } } },
        });
        if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
        if (amount < Number(subscription.plan.monthlyPrice)) throw new Error("PAYMENT_BELOW_PLAN_PRICE");
        const previousPaidCount = await tx.billingRecord.count({ where: { tenantId, status: "PAID" } });
        const now = new Date();
        const record = await tx.billingRecord.create({
          data: {
            tenantId, description: "Subscription payment · " + subscription.plan.name,
            reference, amount, currency: subscription.tenant.currency || "PHP",
            status: "PAID", issuedAt: now, paidAt: now,
          },
        });
        const periodStart = subscription.currentPeriodEnd && subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
        let periodEnd = addCalendarMonths(periodStart, 1 + subscription.referralCreditMonths);
        let referralQualified = false;
        let referralReferrerTenantId: string | null = null;
        if (previousPaidCount === 0) {
          const referral = await tx.referral.findUnique({ where: { referredTenantId: tenantId } });
          if (referral && referral.status === "PENDING") {
            if (referral.registeredAt <= now && referral.expiresAt >= now) {
              const claim = await tx.referral.updateMany({
                where: { id: referral.id, status: "PENDING", expiresAt: { gte: now } },
                data: { status: "REWARDED", qualifiedAt: now, rewardedAt: now },
              });
              if (claim.count === 1) {
                periodEnd = addCalendarMonths(periodEnd, 1);
                await grantReferralMonth(tx, referral.referrerTenantId);
                referralReferrerTenantId = referral.referrerTenantId;
                referralQualified = true;
              }
            } else {
              await tx.referral.updateMany({ where: { id: referral.id, status: "PENDING" }, data: { status: "EXPIRED" } });
            }
          }
        } else {
          await tx.referral.updateMany({ where: { referredTenantId: tenantId, status: "PENDING" }, data: { status: "EXPIRED" } });
        }
        const updated = await tx.subscription.update({
          where: { tenantId },
          data: {
            status: "active", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
            referralCreditMonths: 0,
          },
          select: { tier: true, status: true, currentPeriodStart: true, currentPeriodEnd: true },
        });
        await tx.platformAuditLog.create({
          data: {
            actorUserId: admin.id, actorEmail: admin.email, action: "tenant.subscription.payment.confirmed",
            entityType: "tenant", entityId: tenantId,
            details: { billingRecordId: record.id, reference, amount, currency: subscription.tenant.currency || "PHP", referralQualified },
          },
        });
        return { record, subscription: updated, referralQualified, referralReferrerTenantId };
      });
      let referralEmailsSent = 0;
      if (result.referralQualified && result.referralReferrerTenantId) {
        try {
          const rewardedTenants = await prisma.tenant.findMany({
            where: { id: { in: [tenantId, result.referralReferrerTenantId] } },
            select: { id: true, name: true, slug: true, memberships: { where: { role: "OWNER" }, select: { user: { select: { email: true } } }, take: 1 } },
          });
          const referred = rewardedTenants.find(item => item.id === tenantId);
          const referrer = rewardedTenants.find(item => item.id === result.referralReferrerTenantId);
          const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/+$/, "");
          const emails = await Promise.allSettled([
            ...(referred?.memberships[0]?.user.email && referrer ? [sendReferralRewardEmail({
              recipient: referred.memberships[0].user.email, businessName: referred.name,
              referredBusinessName: referrer.name, accountUrl: baseUrl + "/workspace/" + encodeURIComponent(referred.slug) + "/account",
            })] : []),
            ...(referrer?.memberships[0]?.user.email && referred ? [sendReferralRewardEmail({
              recipient: referrer.memberships[0].user.email, businessName: referrer.name,
              referredBusinessName: referred.name, accountUrl: baseUrl + "/workspace/" + encodeURIComponent(referrer.slug) + "/account",
            })] : []),
          ]);
          referralEmailsSent = emails.filter(item => item.status === "fulfilled").length;
        } catch (emailError) {
          console.error("Referral reward email notification failed", emailError);
        }
      }
      return NextResponse.json({
        payment: { id: result.record.id, reference: result.record.reference, amount: Number(result.record.amount), paidAt: result.record.paidAt?.toISOString() || null },
        subscription: { ...result.subscription, currentPeriodStart: result.subscription.currentPeriodStart?.toISOString() || null, currentPeriodEnd: result.subscription.currentPeriodEnd?.toISOString() || null },
        referralQualified: result.referralQualified,
        referralEmailsSent,
        message: result.referralQualified
          ? "Payment recorded. Referral qualified: one free month has been credited to both workspaces."
          : "Payment recorded and subscription activated.",
      }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "SUBSCRIPTION_NOT_FOUND") return NextResponse.json({ error: "Assign a subscription plan before recording payment." }, { status: 404 });
      if (error instanceof Error && error.message === "PAYMENT_BELOW_PLAN_PRICE") return NextResponse.json({ error: "The verified payment must cover at least the current monthly plan price." }, { status: 400 });
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "That payment reference has already been recorded." }, { status: 409 });
      console.error("Subscription payment confirmation failed", error);
      return NextResponse.json({ error: "Unable to record the subscription payment." }, { status: 500 });
    }
  }
  if (body?.action === "assign-plan") {
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const tier = typeof body.tier === "string" ? body.tier : "";
    if (!tenantId || !["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].includes(tier)) return NextResponse.json({ error: "Choose a valid tenant and plan." }, { status: 400 });
    const plan = await prisma.plan.findUnique({ where: { tier: tier as "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE", active: true } }).catch(() => null);
    if (!plan) return NextResponse.json({ error: "That plan is unavailable." }, { status: 404 });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    const current = await prisma.subscription.findUnique({ where: { tenantId }, select: { status: true } });
    const subscription = await prisma.subscription.upsert({
      where: { tenantId },
      create: { tenantId, planId: plan.id, tier: plan.tier, status: "manual_review", currentPeriodStart: new Date() },
      update: { planId: plan.id, tier: plan.tier, status: current?.status === "canceled" || current?.status === "trialing" || current?.status === "complimentary" ? "manual_review" : current?.status || "manual_review" },
      select: { tier: true, status: true, currentPeriodEnd: true },
    });
    await prisma.platformAuditLog.create({ data: {
      actorUserId: admin.id, actorEmail: admin.email, action: "tenant.plan.assigned",
      entityType: "tenant", entityId: tenantId, details: { tier: subscription.tier, status: subscription.status },
    } });
    return NextResponse.json({ subscription: { ...subscription, currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null } });
  }
  return NextResponse.json({ error: "Unsupported management action." }, { status: 400 });
}
