import { NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const tenantId = access.tenant.id;
  const [vehicleCounts, bookingCounts, customerCount, branchCount, revenue, upcoming, recent, fleetTotal] = await Promise.all([
    prisma.vehicle.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
    prisma.customer.count({ where: { tenantId } }),
    prisma.branch.count({ where: { tenantId, isActive: true } }),
    prisma.booking.aggregate({ where: { tenantId, status: "COMPLETED", endAt: { gte: thirtyDaysAgo } }, _sum: { totalAmount: true } }),
    prisma.booking.findMany({
      where: { tenantId, status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] }, endAt: { gte: now } },
      orderBy: { startAt: "asc" }, take: 6,
      select: { id: true, reference: true, status: true, startAt: true, endAt: true, totalAmount: true, customer: { select: { name: true } }, items: { select: { vehicle: { select: { make: true, model: true, plateNumber: true } } } } },
    }),
    prisma.booking.findMany({ where: { tenantId, createdAt: { gte: sevenDaysAgo } }, select: { createdAt: true, totalAmount: true, status: true } }),
    prisma.vehicle.count({ where: { tenantId, status: { not: "INACTIVE" } } }),
  ]);
  const vehicleMap = Object.fromEntries(vehicleCounts.map((x) => [x.status.toLowerCase(), x._count._all]));
  const bookingMap = Object.fromEntries(bookingCounts.map((x) => [x.status.toLowerCase(), x._count._all]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sevenDaysAgo);
    day.setDate(day.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    const items = recent.filter((x) => x.createdAt.toISOString().slice(0, 10) === key);
    return { date: key, label: day.toLocaleDateString("en-PH", { weekday: "short" }), bookings: items.length };
  });
  const utilization = fleetTotal ? Math.round(((vehicleMap.rented || 0) + (vehicleMap.reserved || 0)) / fleetTotal * 100) : 0;
  return NextResponse.json({
    workspace: { name: access.tenant.name, slug: access.tenant.slug, role: access.role, currency: access.tenant.currency, trial: access.tenant.subscription?.trialPolicyVersion === 1 && access.tenant.subscription.status === "trialing" ? { endsAt: access.tenant.subscription.trialEndsAt?.toISOString() || null, graceEndsAt: access.tenant.subscription.trialGraceEndsAt?.toISOString() || null, readOnly: access.trialReadOnly } : null },
    metrics: {
      totalVehicles: fleetTotal, availableVehicles: vehicleMap.available || 0, rentedVehicles: vehicleMap.rented || 0,
      reservedVehicles: vehicleMap.reserved || 0, maintenanceVehicles: vehicleMap.maintenance || 0,
      activeBookings: (bookingMap.active || 0) + (bookingMap.confirmed || 0),
      pendingBookings: bookingMap.pending || 0, completedBookings: bookingMap.completed || 0,
      customers: customerCount, branches: branchCount, utilization,
      revenue30d: Number(revenue._sum.totalAmount || 0),
      bookings7d: recent.length,
    },
    bookingTrend: days,
    upcoming: upcoming.map((booking) => ({
      id: booking.id, reference: booking.reference, status: booking.status,
      startAt: booking.startAt, endAt: booking.endAt, totalAmount: Number(booking.totalAmount),
      customer: booking.customer.name,
      vehicles: booking.items.map((item) => `${item.vehicle.make} ${item.vehicle.model} · ${item.vehicle.plateNumber}`),
    })),
  });
}
