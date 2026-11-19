import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCurrentLegalAcceptance } from "@/lib/legal";

export async function getTenantAccess(slug: string) {
  const user = await getCurrentUser();
  if (!user || !hasCurrentLegalAcceptance(user.legalAcceptances)) return null;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true, name: true, status: true, currency: true } });
  if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) return null;
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    select: { role: true },
  });
  if (!membership) return null;
  return { user, tenant, role: membership.role };
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
