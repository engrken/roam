import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (access.role !== "OWNER") return NextResponse.json({ error: "Only the workspace owner can view account and billing details." }, { status: 403 });

  const [tenant, plans, billingRecords, requests] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: access.tenant.id },
      select: {
        id: true, name: true, email: true, phone: true, status: true, createdAt: true,
        subscription: { include: { plan: { select: { name: true, monthlyPrice: true, maxVehicles: true, maxBranches: true, maxStaff: true } } } },
      },
    }),
    prisma.plan.findMany({ where: { active: true }, orderBy: { monthlyPrice: "asc" }, select: { tier: true, name: true, monthlyPrice: true, maxVehicles: true, maxBranches: true, maxStaff: true } }),
    prisma.billingRecord.findMany({ where: { tenantId: access.tenant.id }, orderBy: { issuedAt: "desc" }, take: 50 }),
    prisma.subscriptionChangeRequest.findMany({ where: { tenantId: access.tenant.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  if (!tenant) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  return NextResponse.json({
    user: { id: true, name: true, email: true },
        user: { id: access.user.id, name: access.user.name, email: access.user.email },
    tenant: { ...tenant, createdAt: tenant.createdAt.toISOString() },
    subscription: tenant.subscription ? {
      tier: tenant.subscription.tier, status: tenant.subscription.status,
      currentPeriodStart: tenant.subscription.currentPeriodStart?.toISOString() || null,
      currentPeriodEnd: tenant.subscription.currentPeriodEnd?.toISOString() || null,
      trialEndsAt: tenant.subscription.trialEndsAt?.toISOString() || null,
      plan: { ...tenant.subscription.plan, monthlyPrice: Number(tenant.subscription.plan.monthlyPrice) },
    } : null,
    plans: plans.map(plan => ({ ...plan, monthlyPrice: Number(plan.monthlyPrice) })),
    billingRecords: billingRecords.map(record => ({ ...record, amount: Number(record.amount), issuedAt: record.issuedAt.toISOString(), dueAt: record.dueAt?.toISOString() || null, paidAt: record.paidAt?.toISOString() || null, createdAt: record.createdAt.toISOString() })),
    requests: requests.map(request => ({ ...request, createdAt: request.createdAt.toISOString(), reviewedAt: request.reviewedAt?.toISOString() || null })),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (access.role !== "OWNER") return NextResponse.json({ error: "Only the workspace owner can edit account details." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length > 100) return NextResponse.json({ error: "Your name must be 100 characters or fewer." }, { status: 400 });
  const user = await prisma.user.update({ where: { id: access.user.id }, data: { name: name || null }, select: { id: true, name: true, email: true } });
  return NextResponse.json({ user });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (access.role !== "OWNER") return NextResponse.json({ error: "Only the workspace owner can request a subscription change." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const tier = typeof body?.tier === "string" ? body.tier : "";
  if (!["STARTER", "PRO", "BUSINESS", "ENTERPRISE"].includes(tier)) return NextResponse.json({ error: "Choose a valid subscription tier." }, { status: 400 });

  const [plan, subscription, pending] = await Promise.all([
    prisma.plan.findUnique({ where: { tier: tier as "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE", active: true } }),
    prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, select: { tier: true } }),
    prisma.subscriptionChangeRequest.findFirst({ where: { tenantId: access.tenant.id, status: "PENDING" } }),
  ]);
  if (!plan) return NextResponse.json({ error: "That plan is not currently available." }, { status: 404 });
  const currentTier = subscription?.tier || "FREE";
  if (currentTier === tier) return NextResponse.json({ error: "Your workspace is already on this tier." }, { status: 400 });
  if (pending) return NextResponse.json({ error: "You already have a pending subscription change request." }, { status: 409 });

  const change = await prisma.subscriptionChangeRequest.create({
    data: { tenantId: access.tenant.id, requestedTier: tier as "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE", currentTier, requestedById: access.user.id },
    select: { id: true, currentTier: true, requestedTier: true, status: true, createdAt: true },
  });
  return NextResponse.json({ request: { ...change, createdAt: change.createdAt.toISOString() }, message: "Your request has been submitted for review. Your current plan remains active until it is approved." }, { status: 201 });
}
