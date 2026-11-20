import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantAccess, canManageFleet, workspaceWriteBlock } from "@/lib/tenant-access";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const records = await prisma.vehicleServiceRecord.findMany({
    where: { tenantId: access.tenant.id }, include: { vehicle: { select: { make: true, model: true, plateNumber: true } } },
    orderBy: { performedAt: "desc" }, take: 300,
  });
  return NextResponse.json({ records: records.map((r) => ({ ...r, cost: Number(r.cost) })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage service records." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId : "";
  const serviceType = typeof body?.serviceType === "string" ? body.serviceType.trim().slice(0, 80) : "";
  const cost = Number(body?.cost ?? 0), odometerKm = body?.odometerKm == null || body.odometerKm === "" ? null : Number(body.odometerKm);
  const performedAt = body?.performedAt ? new Date(body.performedAt) : new Date();
  if (!vehicleId || !serviceType || !Number.isFinite(cost) || cost < 0 || (odometerKm !== null && (!Number.isInteger(odometerKm) || odometerKm < 0)) || !Number.isFinite(performedAt.getTime())) {
    return NextResponse.json({ error: "Enter a vehicle, service type, valid cost, odometer reading, and service date." }, { status: 400 });
  }
  if (!await prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: access.tenant.id }, select: { id: true } })) return NextResponse.json({ error: "Vehicle not found in this workspace." }, { status: 404 });
  const record = await prisma.vehicleServiceRecord.create({ data: {
    tenantId: access.tenant.id, vehicleId, serviceType, cost, odometerKm, performedAt,
    description: typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null,
    maintenanceId: typeof body.maintenanceId === "string" ? body.maintenanceId : null,
  } });
  return NextResponse.json({ record: { ...record, cost: Number(record.cost) } }, { status: 201 });
}
