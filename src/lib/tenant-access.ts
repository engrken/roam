import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCurrentLegalAcceptance } from "@/lib/legal";
import { NextResponse } from "next/server";

export async function getTenantAccess(slug: string) {
  const user = await getCurrentUser();
  if (!user || !hasCurrentLegalAcceptance(user.legalAcceptances)) return null;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, currency: true, subscription: { select: { status: true, trialPolicyVersion: true, trialGraceEndsAt: true } } } });
  if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) return null;
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return null;
  const trialReadOnly = tenant.subscription?.trialPolicyVersion === 1
    && tenant.subscription.status === "trialing"
    && !!tenant.subscription.trialGraceEndsAt
    && tenant.subscription.trialGraceEndsAt <= new Date();
  return { user, tenant, role: membership.role, trialReadOnly };
}

export function canManageFleet(role: string) {
  return ["OWNER", "ADMIN", "MANAGER"].includes(role);
}

const planTierRank: Record<string, number> = {
  FREE: 0,
  STARTER: 1,
  PRO: 2,
  BUSINESS: 3,
  ENTERPRISE: 4,
};

export async function hasWorkspaceTier(tenantId: string, minimumTier: "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE") {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { tier: true },
  });
  return (planTierRank[subscription?.tier || "FREE"] ?? 0) >= planTierRank[minimumTier];
}

/** Returns a consistent 423 response when a newly enrolled trial has passed its grace period. */
export function workspaceWriteBlock(access: { trialReadOnly?: boolean }) {
  if (!access.trialReadOnly) return null;
  return NextResponse.json({
    error: "This workspace is in read-only mode because its trial and 7-day grace period have ended. The owner can request a paid plan from Account & Subscription. Existing records remain available.",
    code: "TRIAL_READ_ONLY",
  }, { status: 423 });
}
