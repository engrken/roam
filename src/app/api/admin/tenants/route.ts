import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true, vehicles: true, branches: true, bookings: true } },
      subscription: { select: { tier: true, status: true, currentPeriodEnd: true, plan: { select: { name: true } } } },
    },
  });
  return NextResponse.json({ tenants: tenants.map((tenant) => ({
    id: tenant.id, name: tenant.name, slug: tenant.slug, email: tenant.email, phone: tenant.phone,
    status: tenant.status, createdAt: tenant.createdAt, counts: tenant._count,
    subscription: tenant.subscription ? { tier: tenant.subscription.tier, status: tenant.subscription.status, plan: tenant.subscription.plan.name, currentPeriodEnd: tenant.subscription.currentPeriodEnd } : null,
  })) });
}

export async function PATCH(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : "";
  const status = body?.status;
  if (!tenantId || !["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"].includes(status)) {
    return NextResponse.json({ error: "Choose a valid tenant and status." }, { status: 400 });
  }
  try {
    const tenant = await prisma.tenant.update({ where: { id: tenantId }, data: { status } });
    return NextResponse.json({ tenant: { id: tenant.id, status: tenant.status } });
  } catch {
    return NextResponse.json({ error: "Tenant not found or update failed." }, { status: 404 });
  }
}
