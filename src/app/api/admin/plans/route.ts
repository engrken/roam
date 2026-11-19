import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const [plans, tenants, subscriptionRequests] = await Promise.all([
    prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" }, select: { id: true, tier: true, name: true, monthlyPrice: true, maxVehicles: true, maxBranches: true, maxStaff: true, active: true } }),
    prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, subscription: { select: { tier: true, status: true, currentPeriodEnd: true, trialEndsAt: true } } } }),
    prisma.subscriptionChangeRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { tenant: { select: { name: true, slug: true } } } }),
  ]);
  return NextResponse.json({
    plans: plans.map(plan => ({ ...plan, monthlyPrice: Number(plan.monthlyPrice) })),
    tenants: tenants.map(tenant => ({ ...tenant, subscription: tenant.subscription ? { ...tenant.subscription, currentPeriodEnd: tenant.subscription.currentPeriodEnd?.toISOString() || null, trialEndsAt: tenant.subscription.trialEndsAt?.toISOString() || null } : null })),
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
      update: { planId: plan.id, tier: plan.tier, status: current?.status === "canceled" ? "manual_review" : current?.status || "manual_review" },
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
