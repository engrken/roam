import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

export const runtime = "nodejs";
const types = ["MOTORCYCLE","SCOOTER","SEDAN","HATCHBACK","SUV","MPV","VAN","PICKUP","BUS","TRUCK","OTHER"] as const;
const optionalPrice = (value: unknown): number | null => value === "" || value == null ? null : Number(value);
const validOptionalPrices = (...values: Array<number | null>) => values.every((value) => value === null || (Number.isFinite(value) && value >= 0));
const optionalInteger = (value: unknown): number | null => value === "" || value == null ? null : Number(value);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId: access.tenant.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { branch: { select: { name: true } } },
  });
  return NextResponse.json({ vehicles: vehicles.map((v) => ({
    id: v.id, type: v.type, make: v.make, model: v.model, year: v.year, plateNumber: v.plateNumber,
    color: v.color, seats: v.seats, transmission: v.transmission, dailyRate: Number(v.dailyRate),
    securityDeposit: Number(v.securityDeposit), selfDriveEnabled: v.selfDriveEnabled, withDriverEnabled: v.withDriverEnabled,
    withDriverDailyRate: v.withDriverDailyRate === null ? null : Number(v.withDriverDailyRate),
    hourlyRate: v.hourlyRate === null ? null : Number(v.hourlyRate), weeklyRate: v.weeklyRate === null ? null : Number(v.weeklyRate),
    monthlyRate: v.monthlyRate === null ? null : Number(v.monthlyRate),
    withDriverHourlyRate: v.withDriverHourlyRate === null ? null : Number(v.withDriverHourlyRate),
    withDriverWeeklyRate: v.withDriverWeeklyRate === null ? null : Number(v.withDriverWeeklyRate),
    withDriverMonthlyRate: v.withDriverMonthlyRate === null ? null : Number(v.withDriverMonthlyRate),
    deliveryAvailable: v.deliveryAvailable, deliveryFee: Number(v.deliveryFee),
    includedKmPerDay: v.includedKmPerDay, excessMileageRate: Number(v.excessMileageRate),
    overtimeGraceMinutes: v.overtimeGraceMinutes,
    overtimeHourlyRate: v.overtimeHourlyRate === null ? null : Number(v.overtimeHourlyRate),
    withDriverOvertimeHourlyRate: v.withDriverOvertimeHourlyRate === null ? null : Number(v.withDriverOvertimeHourlyRate),
    status: v.status, notes: v.notes, branchId: v.branchId,
    branchName: v.branch?.name || "Unassigned",
  })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage the fleet." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const make = typeof body?.make === "string" ? body.make.trim() : "";
  const model = typeof body?.model === "string" ? body.model.trim() : "";
  const plateNumber = typeof body?.plateNumber === "string" ? body.plateNumber.trim().toUpperCase() : "";
  const type = body?.type;
  const dailyRate = Number(body?.dailyRate);
  const selfDriveEnabled = body?.selfDriveEnabled !== false;
  const withDriverEnabled = body?.withDriverEnabled === true;
  const withDriverDailyRate = body?.withDriverDailyRate === "" || body?.withDriverDailyRate == null ? null : Number(body.withDriverDailyRate);
  const hourlyRate = optionalPrice(body.hourlyRate);
  const weeklyRate = optionalPrice(body.weeklyRate);
  const monthlyRate = optionalPrice(body.monthlyRate);
  const withDriverHourlyRate = optionalPrice(body.withDriverHourlyRate);
  const withDriverWeeklyRate = optionalPrice(body.withDriverWeeklyRate);
  const withDriverMonthlyRate = optionalPrice(body.withDriverMonthlyRate);
  const deliveryAvailable = body.deliveryAvailable === true;
  const deliveryFee = Number(body.deliveryFee ?? 0);
  const includedKmPerDay = optionalInteger(body.includedKmPerDay);
  const excessMileageRate = Number(body.excessMileageRate ?? 0);
  const overtimeGraceMinutes = Number(body.overtimeGraceMinutes ?? 0);
  const overtimeHourlyRate = optionalPrice(body.overtimeHourlyRate);
  const withDriverOvertimeHourlyRate = optionalPrice(body.withDriverOvertimeHourlyRate);
  const extraPricesValid = validOptionalPrices(hourlyRate, weeklyRate, monthlyRate, withDriverHourlyRate, withDriverWeeklyRate, withDriverMonthlyRate, overtimeHourlyRate, withDriverOvertimeHourlyRate)
    && Number.isFinite(deliveryFee) && deliveryFee >= 0
    && Number.isFinite(excessMileageRate) && excessMileageRate >= 0
    && (includedKmPerDay === null || (Number.isInteger(includedKmPerDay) && includedKmPerDay >= 0 && includedKmPerDay <= 100000))
    && Number.isInteger(overtimeGraceMinutes) && overtimeGraceMinutes >= 0 && overtimeGraceMinutes <= 1440;
  const year = body?.year === "" || body?.year == null ? null : Number(body.year);
  if (make.length < 2 || model.length < 1 || plateNumber.length < 2 || plateNumber.length > 20 || !types.includes(type) || !Number.isFinite(dailyRate) || dailyRate < 0 || (!selfDriveEnabled && !withDriverEnabled) || (withDriverEnabled && (withDriverDailyRate === null || !Number.isFinite(withDriverDailyRate) || withDriverDailyRate < 0)) || !extraPricesValid || (year !== null && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1))) {
    return NextResponse.json({ error: "Enter a valid vehicle type, make, model, plate number, year, and daily rate." }, { status: 400 });
  }
  const plan = await prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, include: { plan: true } });
  const count = await prisma.vehicle.count({ where: { tenantId: access.tenant.id, status: { not: "INACTIVE" } } });
  if (plan?.plan.maxVehicles != null && count >= plan.plan.maxVehicles) {
    return NextResponse.json({ error: `Your ${plan.plan.name} plan allows up to ${plan.plan.maxVehicles} active vehicles. Upgrade your plan to add more.` }, { status: 403 });
  }
  const branchId = typeof body.branchId === "string" && body.branchId ? body.branchId : null;
  if (branchId && !await prisma.branch.findFirst({ where: { id: branchId, tenantId: access.tenant.id, isActive: true } })) {
    return NextResponse.json({ error: "Choose a branch in this workspace." }, { status: 400 });
  }
  try {
    const vehicle = await prisma.$transaction(async tx => {
      const created = await tx.vehicle.create({ data: {
        tenantId: access.tenant.id, branchId, type, make, model, plateNumber, year,
        color: typeof body.color === "string" ? body.color.trim().slice(0, 40) : null,
        transmission: typeof body.transmission === "string" ? body.transmission : null,
        seats: Number.isInteger(Number(body.seats)) && Number(body.seats) > 0 ? Number(body.seats) : null,
        dailyRate, selfDriveEnabled, withDriverEnabled, withDriverDailyRate,
        hourlyRate, weeklyRate, monthlyRate, withDriverHourlyRate, withDriverWeeklyRate, withDriverMonthlyRate,
        deliveryAvailable, deliveryFee, includedKmPerDay, excessMileageRate, overtimeGraceMinutes,
        overtimeHourlyRate, withDriverOvertimeHourlyRate, securityDeposit: Number.isFinite(Number(body.securityDeposit)) && Number(body.securityDeposit) >= 0 ? Number(body.securityDeposit) : 0,
        status: "AVAILABLE",
      } });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "vehicle.created", targetType: "vehicle", targetId: created.id,
        details: { make, model, plateNumber, branchId },
      });
      return created;
    });
    return NextResponse.json({ vehicle: { id: vehicle.id, make: vehicle.make, model: vehicle.model, plateNumber: vehicle.plateNumber } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "A vehicle with this plate number may already exist in this workspace." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage the fleet." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Vehicle ID is required." }, { status: 400 });

  if (typeof body.status === "string") {
    if (!["AVAILABLE","RESERVED","RENTED","MAINTENANCE","INACTIVE"].includes(body.status)) {
      return NextResponse.json({ error: "Choose a valid vehicle status." }, { status: 400 });
    }
    const current = await prisma.vehicle.findFirst({ where: { id, tenantId: access.tenant.id }, select: { status: true } });
    if (!current) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    if (current.status === "INACTIVE" && body.status !== "INACTIVE") {
      const plan = await prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, include: { plan: true } });
      const activeCount = await prisma.vehicle.count({ where: { tenantId: access.tenant.id, status: { not: "INACTIVE" } } });
      if (plan?.plan.maxVehicles != null && activeCount >= plan.plan.maxVehicles) {
        return NextResponse.json({ error: `Your ${plan.plan.name} plan allows up to ${plan.plan.maxVehicles} active vehicles. Upgrade your plan to reactivate this vehicle.` }, { status: 403 });
      }
    }
    const result = await prisma.$transaction(async tx => {
      const updated = await tx.vehicle.updateMany({ where: { id, tenantId: access.tenant.id }, data: { status: body.status } });
      if (!updated.count) return false;
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "vehicle.status_changed", targetType: "vehicle", targetId: id,
        details: { fromStatus: current.status, toStatus: body.status },
      });
      return true;
    });
    if (!result) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    return NextResponse.json({ vehicle: { id, status: body.status } });
  }

  const make = typeof body.make === "string" ? body.make.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const plateNumber = typeof body.plateNumber === "string" ? body.plateNumber.trim().toUpperCase() : "";
  const dailyRate = Number(body.dailyRate);
  const selfDriveEnabled = body.selfDriveEnabled !== false;
  const withDriverEnabled = body.withDriverEnabled === true;
  const withDriverDailyRate = body.withDriverDailyRate === "" || body.withDriverDailyRate == null ? null : Number(body.withDriverDailyRate);
  const hourlyRate = optionalPrice(body.hourlyRate);
  const weeklyRate = optionalPrice(body.weeklyRate);
  const monthlyRate = optionalPrice(body.monthlyRate);
  const withDriverHourlyRate = optionalPrice(body.withDriverHourlyRate);
  const withDriverWeeklyRate = optionalPrice(body.withDriverWeeklyRate);
  const withDriverMonthlyRate = optionalPrice(body.withDriverMonthlyRate);
  const deliveryAvailable = body.deliveryAvailable === true;
  const deliveryFee = Number(body.deliveryFee ?? 0);
  const includedKmPerDay = optionalInteger(body.includedKmPerDay);
  const excessMileageRate = Number(body.excessMileageRate ?? 0);
  const overtimeGraceMinutes = Number(body.overtimeGraceMinutes ?? 0);
  const overtimeHourlyRate = optionalPrice(body.overtimeHourlyRate);
  const withDriverOvertimeHourlyRate = optionalPrice(body.withDriverOvertimeHourlyRate);
  const extraPricesValid = validOptionalPrices(hourlyRate, weeklyRate, monthlyRate, withDriverHourlyRate, withDriverWeeklyRate, withDriverMonthlyRate, overtimeHourlyRate, withDriverOvertimeHourlyRate)
    && Number.isFinite(deliveryFee) && deliveryFee >= 0
    && Number.isFinite(excessMileageRate) && excessMileageRate >= 0
    && (includedKmPerDay === null || (Number.isInteger(includedKmPerDay) && includedKmPerDay >= 0 && includedKmPerDay <= 100000))
    && Number.isInteger(overtimeGraceMinutes) && overtimeGraceMinutes >= 0 && overtimeGraceMinutes <= 1440;
  const year = body.year === "" || body.year == null ? null : Number(body.year);
  if (make.length < 2 || model.length < 1 || plateNumber.length < 2 || plateNumber.length > 20 || !types.includes(body.type) || !Number.isFinite(dailyRate) || dailyRate < 0 || (!selfDriveEnabled && !withDriverEnabled) || (withDriverEnabled && (withDriverDailyRate === null || !Number.isFinite(withDriverDailyRate) || withDriverDailyRate < 0)) || !extraPricesValid || (year !== null && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1))) {
    return NextResponse.json({ error: "Enter valid vehicle details and a daily rate." }, { status: 400 });
  }
  const branchId = typeof body.branchId === "string" && body.branchId ? body.branchId : null;
  if (branchId && !await prisma.branch.findFirst({ where: { id: branchId, tenantId: access.tenant.id, isActive: true } })) {
    return NextResponse.json({ error: "Choose a branch in this workspace." }, { status: 400 });
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.vehicle.findFirst({ where: { id, tenantId: access.tenant.id }, select: { id: true } });
      if (!existing) return false;
      await tx.vehicle.update({ where: { id }, data: {
        type: body.type, make, model, plateNumber, year, branchId, dailyRate,
        selfDriveEnabled, withDriverEnabled, withDriverDailyRate,
        hourlyRate, weeklyRate, monthlyRate, withDriverHourlyRate, withDriverWeeklyRate, withDriverMonthlyRate,
        deliveryAvailable, deliveryFee, includedKmPerDay, excessMileageRate, overtimeGraceMinutes,
        overtimeHourlyRate, withDriverOvertimeHourlyRate,
        color: typeof body.color === "string" ? body.color.trim().slice(0, 40) : null,
        securityDeposit: Number.isFinite(Number(body.securityDeposit)) && Number(body.securityDeposit) >= 0 ? Number(body.securityDeposit) : 0,
      } });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "vehicle.updated", targetType: "vehicle", targetId: id,
        details: { make, model, plateNumber, branchId },
      });
      return true;
    });
    if (!result) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });
    return NextResponse.json({ vehicle: { id, make, model, plateNumber } });
  } catch {
    return NextResponse.json({ error: "A vehicle with this plate number may already exist in this workspace." }, { status: 409 });
  }
}
