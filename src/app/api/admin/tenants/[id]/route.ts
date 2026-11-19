import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      _count: { select: { memberships: true, vehicles: true, branches: true, bookings: true, customers: true, invitations: true } },
      memberships: { orderBy: [{ role: "asc" }, { createdAt: "asc" }], include: { user: { select: { id: true, name: true, email: true, createdAt: true } } } },
      branches: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, code: true, address: true, isActive: true, _count: { select: { vehicles: true, bookings: true } } } },
      subscription: { include: { plan: { select: { name: true, monthlyPrice: true, maxVehicles: true, maxBranches: true, maxStaff: true, active: true } } } },
      invitations: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" }, take: 10, select: { id: true, email: true, role: true, expiresAt: true, createdAt: true } },
      bookings: { orderBy: { createdAt: "desc" }, take: 8, select: { id: true, reference: true, status: true, startAt: true, endAt: true, totalAmount: true, createdAt: true, branch: { select: { name: true } } } },
    },
  });
  if (!tenant) return NextResponse.json({ error: "Tenant not found." }, { status: 404 });

  const auditLogs = await prisma.platformAuditLog.findMany({
    where: { entityType: "tenant", entityId: id },
    orderBy: { createdAt: "desc" }, take: 12,
    select: { id: true, actorEmail: true, action: true, details: true, createdAt: true },
  });

  return NextResponse.json({
    tenant: {
      id: tenant.id, name: tenant.name, slug: tenant.slug, email: tenant.email, phone: tenant.phone,
      status: tenant.status, currency: tenant.currency, timezone: tenant.timezone,
      createdAt: tenant.createdAt, updatedAt: tenant.updatedAt,
      counts: tenant._count,
      memberships: tenant.memberships.map(m => ({ id: m.id, userId: m.userId, name: m.user.name, email: m.user.email, role: m.role, joinedAt: m.createdAt, accountCreatedAt: m.user.createdAt })),
      branches: tenant.branches,
      subscription: tenant.subscription ? {
        tier: tenant.subscription.tier, status: tenant.subscription.status,
        currentPeriodStart: tenant.subscription.currentPeriodStart, currentPeriodEnd: tenant.subscription.currentPeriodEnd,
        trialEndsAt: tenant.subscription.trialEndsAt,
        plan: { ...tenant.subscription.plan, monthlyPrice: Number(tenant.subscription.plan.monthlyPrice) },
      } : null,
      invitations: tenant.invitations,
      recentBookings: tenant.bookings.map(b => ({ ...b, totalAmount: Number(b.totalAmount) })),
    },
    auditLogs,
  });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

  const data: Record<string, string | null> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 120) return NextResponse.json({ error: "Business name must be between 2 and 120 characters." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.email !== undefined) {
    if (typeof body.email !== "string" || body.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return NextResponse.json({ error: "Enter a valid business contact email." }, { status: 400 });
    data.email = body.email.trim().toLowerCase();
  }
  if (body.phone !== undefined) {
    if (body.phone !== null && (typeof body.phone !== "string" || body.phone.trim().length > 30)) return NextResponse.json({ error: "Phone number must be 30 characters or fewer." }, { status: 400 });
    data.phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  }
  if (body.currency !== undefined) {
    if (typeof body.currency !== "string" || !/^[A-Z]{3}$/.test(body.currency)) return NextResponse.json({ error: "Currency must be a three-letter uppercase code." }, { status: 400 });
    data.currency = body.currency;
  }
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== "string" || body.timezone.length > 80) return NextResponse.json({ error: "Enter a valid timezone." }, { status: 400 });
    try { new Intl.DateTimeFormat("en", { timeZone: body.timezone }); } catch { return NextResponse.json({ error: "That timezone is not recognized." }, { status: 400 }); }
    data.timezone = body.timezone;
  }
  if (body.status !== undefined) {
    if (!["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"].includes(body.status)) return NextResponse.json({ error: "Choose a valid workspace status." }, { status: 400 });
    data.status = body.status;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "No supported tenant changes were provided." }, { status: 400 });

  try {
    const updated = await prisma.$transaction(async tx => {
      const before = await tx.tenant.findUnique({ where: { id }, select: { name: true, email: true, phone: true, currency: true, timezone: true, status: true } });
      if (!before) throw new Error("TENANT_NOT_FOUND");
      const tenant = await tx.tenant.update({ where: { id }, data });
      const changes = Object.fromEntries(Object.keys(data).map(key => [key, {
        from: before[key as keyof typeof before],
        to: tenant[key as keyof typeof tenant],
      }]));
      await tx.platformAuditLog.create({ data: {
        actorUserId: admin.id, actorEmail: admin.email,
        action: data.status ? "tenant.profile_and_access.updated" : "tenant.profile.updated",
        entityType: "tenant", entityId: id, details: changes,
      } });
      return tenant;
    });
    return NextResponse.json({ tenant: { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone, currency: updated.currency, timezone: updated.timezone, status: updated.status, updatedAt: updated.updatedAt } });
  } catch (error) {
    if (error instanceof Error && error.message === "TENANT_NOT_FOUND") return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
    console.error("Platform tenant update failed", error);
    return NextResponse.json({ error: "Unable to update tenant details. Check for conflicting values and try again." }, { status: 409 });
  }
}
