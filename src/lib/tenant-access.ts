import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCurrentLegalAcceptance } from "@/lib/legal";
import { NextResponse } from "next/server";
import { expireTenantPendingSubscriptionPayment } from "@/lib/subscription-payments";
export { canManageFleet, canManageTeam, canManageWorkspaceSettings, canManageBilling } from "@/lib/permissions";

export async function getTenantAccess(slug: string) {
  const user = await getCurrentUser();
  if (!user || !hasCurrentLegalAcceptance(user.legalAcceptances)) return null;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, currency: true, timezone: true, subscription: { select: { status: true, trialPolicyVersion: true, trialEndsAt: true, trialGraceEndsAt: true } } } });
  if (!tenant) return null;
  let currentTenant = tenant;
  if (tenant.subscription?.status === "payment_pending" && await expireTenantPendingSubscriptionPayment(tenant.id)) {
    const refreshedTenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, currency: true, timezone: true, subscription: { select: { status: true, trialPolicyVersion: true, trialEndsAt: true, trialGraceEndsAt: true } } } });
    if (!refreshedTenant) return null;
    currentTenant = refreshedTenant;
  }
  if (!["ACTIVE", "TRIAL"].includes(currentTenant.status)) return null;
  const membership = await prisma.membership.findUniqu¶»§q«^