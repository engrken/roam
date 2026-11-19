import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const [plans, tenants] = await Promise.all([
    prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" }, select: { id: true, tier: true, name: true, monthlyPrice: true, maxVehicles: true, maxBranches: true, maxStaff: true, active: true } }),
    prisma.tenant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, subscription: { select: { tier: true, status: true, currentPeriodEnd: true, trialEndsAt: true } } } }),
  ]);
  return NextResponse.json({
    plans: plans.map(plan => ({ ...plan, monthlyPrice: Number(plan.monthlyPrice) })),
    tenants: tenants.map(tenant => ({ ...tenant, subscription: tenant.subscription ? { ...tenant.subscription, currentPeriodEnd: tenant.subscription.currentPeriodEnd?.toISOString() || null, trialEndsAt: tenant.subscription.trialEndsAt?.toISOString() || null } : null })),
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
    return NextResponse.json({ plan: { ...plan, monthlyPrice: Number(plan.monthlyPrice) } });
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
    return NextResponse.json({ subscription: { ...subscription, currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || null } });
  }
  return NextResponse.json({ error: "Unsupported management action." }, { status: 400 });
}
