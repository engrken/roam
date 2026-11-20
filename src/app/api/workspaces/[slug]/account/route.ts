import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageBilling } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (!canManageBilling(access.role)) return NextResponse.json({ error: "Only the workspace owner can view account and billing details." }, { status: 403 });

  const [tenant, plans, billingRecords, requests, subscriptionPayments] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: access.tenant.id },
      select: {
        id: true, name: true, email: true, phone: true, status: true, createdAt: true, referralCode: true,
        referralsSent: { orderBy: { createdAt: "desc" }, take: 50, select: { id: true, status: true, registeredAt: true, expiresAt: true, qualifiedAt: true, rewardedAt: true, referredTenant: { select: { name: true } } } },
        referralReceived: { select: { status: true, registeredAt: true, expiresAt: true, qualifiedAt: true, rewardedAt: true, referrerTenant: { select: { name: true } } } },
        subscription: { include: { plan: { select: { name: true, monthlyPrice: true, maxVehicles: true, maxBranches: true, maxStaff: true } } } },
      },
    }),
    prisma.plan.findMany({ where: { active: true }, orderBy: { monthlyPrice: "asc" }, select: { tier: true, name: true, monthlyPrice: true, maxVehicles: true, maxBranches: true, maxStaff: true } }),
    prisma.billingRecord.findMany({ where: { tenantId: access.tenant.id }, orderBy: { issuedAt: "desc" }, take: 50 }),
    prisma.subscriptionChangeRequest.findMany({ where: { tenantId: access.tenant.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.subscriptionPayment.findMany({ where: { tenantId: access.tenant.id }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, reference: true, amount: true, currency: true, status: true, qrCodeData: true, expiresAt: true, paidAt: true, createdAt: true } }),
  ]);
  if (!tenant) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  return NextResponse.json({
    user: { id: access.user.id, name: access.user.name, email: access.user.email },
    tenant: {
      id: tenant.id, name: tenant.name, email: tenant.email, phone: tenant.phone, status: tenant.status,
      createdAt: tenant.createdAt.toISOString(), referralCode: tenant.referralCode,
      referralsSent: tenant.referralsSent.map(item => ({
        id: item.id, referredBusiness: item.referredTenant.name, status: item.status,
        registeredAt: item.registeredAt.toISOString(), expiresAt: item.expiresAt.toISOString(),
        qualifiedAt: item.qualifiedAt?.toISOString() || null, rewardedAt: item.rewardedAt?.toISOString() || null,
      })),
      referralReceived: tenant.referralReceived ? {
        status: tenant.referralReceived.status, registeredAt: tenant.referralReceived.registeredAt.toISOString(),
        expiresAt: tenant.referralReceived.expiresAt.toISOString(), qualifiedAt: tenant.referralReceived.qualifiedAt?.toISOString() || null,
        rewardedAt: tenant.referralReceived.rewardedAt?.toISOString() || null,
        referrerBusiness: tenant.referralReceived.referrerTenant.name,
      } : null,
    },
    subscription: tenant.subscription ? {
      tier: tenant.subscription.tier, status: tenant.subscription.status,
      currentPeriodStart: tenant.subscription.currentPeriodStart?.toISOString() || null,
      currentPeriodEnd: tenant.subscription.currentPeriodEnd?.toISOString() || null,
      trialEndsAt: tenant.subscription.trialEndsAt?.toISOString() || null,
      referralCreditMonths: tenant.subscription.referralCreditMonths,
      plan: { ...tenant.subscription.plan, monthlyPrice: Number(tenant.subscription.plan.monthlyPrice) },
    } : null,
    plans: plans.map(plan => ({ ...plan, monthlyPrice: Number(plan.monthlyPrice) })),
    billingRecords: billingRecords.map(record => ({ ...record, amount: Number(record.amount), issuedAt: record.issuedAt.toISOString(), dueAt: record.dueAt?.toISOString() || null, paidAt: record.paidAt?.toISOString() || null, createdAt: record.createdAt.toISOString() })),
    subscriptionPayments: subscriptionPayments.map(payment => ({ ...payment, amount: Number(payment.amount), expiresAt: payment.expiresAt?.toISOString() || null, paidAt: payment.paidAt?.toISOString() || null, createdAt: payment.createdAt.toISOString() })),
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
  if (!["FREE", "STARTER", "PRO", "BUSINESS", "ENTERPRISE"].includes(tier)) return NextResponse.json({ error: "Choose a valid subscription tier." }, { status: 400 });

  const [plan, subscription, pending] = await Promise.all([
    prisma.plan.findUnique({ where: { tier: tier as "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE", active: true } }),
    prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, select: { tier: true } }),
    prisma.subscriptionChangeRequest.findFirst({ where: { tenantId: access.tenant.id, status: "PENDING" } }),
  ]);
  if (!plan) return NextResponse.json({ error: "That plan is not currently available." }, { status: 404 });
  const currentTier = subscription?.tier || "FREE";
  if (currentTier === tier) return NextResponse.json({ error: "Your workspace is already on this tier." }, { status: 400 });
  if (pending) return NextResponse.json({ error: "You already have a pending subscription change request." }, { status: 409 });

  const change = await prisma.$transaction(async tx => {
    const created = await tx.subscriptionChangeRequest.create({
      data: { tenantId: access.tenant.id, requestedTier: tier as "FREE" | "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE", currentTier, requestedById: access.user.id },
      select: { id: true, currentTier: true, requestedTier: true, status: true, createdAt: true },
    });
    await recordWorkspaceAudit(tx, {
      tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
      action: "subscription.change_requested", targetType: "subscriptionChangeRequest", targetId: created.id,
      details: { fromTier: currentTier, requestedTier: tier },
    });
    return created;
  });
  return NextResponse.json({ request: { ...change, createdAt: change.createdAt.toISOString() }, message: "Your request has been submitted for review. Your current plan remains active until it is approved." }, { status: 201 });
}
