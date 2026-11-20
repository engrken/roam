import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantAccess, canManageFleet, workspaceWriteBlock } from "@/lib/tenant-access";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const records = await prisma.vehicleMaintenance.findMany({
    where: { tenantId: access.tenant.id },
    include: { vehicle: { select: { make: true, model: true, plateNumber: true } }, serviceRecords: true },
    orderBy: [{ startAt: "desc" }], take: 200,
  });
  return NextResponse.json({ maintenance: records.map((m) => ({
    ...m, vehicleLabel: `${m.vehicle.make} ${m.vehicle.model} · ${m.vehicle.plateNumber}`,
    serviceRecords: m.serviceRecords.map((r) => ({ ...r, cost: Number(r.cost) })),
  })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage maintenance." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId : "";
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const startAt = new Date(body?.startAt), endAt = new Date(body?.endAt);
  if (!vehicleId || !title || !Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
    return NextResponse.json({ error: "Choose a vehicle, title, and valid maintenance start/end times." }, { status: 400 });
  }
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: access.tenant.id }, select: { id: true } });
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found in this workspace." }, { status: 404 });
  const result = await prisma.$transaction(async (tx) => {
    // Share the public booking lock so a maintenance block and a new booking cannot race each other.
    await tx.$queryRawUnsafe(
      "SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))) AS advisory_lock",
      access.tenant.id,
      vehicleId,
    );
    const bookingConflict = await tx.bookingItem.findFirst({
      where: { vehicleId, booking: { tenantId: access.tenant.id, status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] }, startAt: { lt: endAt }, endAt: { gt: startAt } } },
      select: { id: true },
    });
    const maintenanceConflict = await tx.vehicleMaintenance.findFirst({
      where: { tenantId: access.tenant.id, vehicleId, status: { in: ["SCHEDULED", "IN_PROGRESS"] }, startAt: { lt: endAt }, endAt: { gt: startAt } },
      select: { id: true },
    });
    if (bookingConflict) return { error: "This vehicle already has a confirmed or active booking during those dates." };
    if (maintenanceConflict) return { error: "This vehicle already has a maintenance period during those dates." };
    const maintenance = await tx.vehicleMaintenance.create({ data: {
      tenantId: access.tenant.id, vehicleId, title, startAt, endAt,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null,
    } });
    return { maintenance };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ maintenance: result.maintenance }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage maintenance." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body?.id || !["COMPLETED", "CANCELLED"].includes(body.status)) return NextResponse.json({ error: "A maintenance ID and valid status are required." }, { status: 400 });
  const result = await prisma.vehicleMaintenance.updateMany({ where: { id: String(body.id), tenantId: access.tenant.id }, data: { status: body.status } });
  if (!result.count) return NextResponse.json({ error: "Maintenance record not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
