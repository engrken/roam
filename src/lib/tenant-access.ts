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
