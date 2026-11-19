import { NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localDayBounds(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = nextDay.getUTCFullYear();
  const nextMonth = nextDay.getUTCMonth() + 1;
  const nextDate = nextDay.getUTCDate();
  const toUtc = (y: number, m: number, d: number) => {
    const guess = Date.UTC(y, m - 1, d);
    const localParts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const local = Object.fromEntries(localParts.map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(
      Number(local.year), Number(local.month) - 1, Number(local.day),
      Number(local.hour), Number(local.minute), Number(local.second),
    );
    return new Date(guess - (representedAsUtc - guess));
  };
  return {
    start: toUtc(year, month, day),
    end: toUtc(nextYear, nextMonth, nextDate),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const tenantId = access.tenant.id;
  const timeZone = access.tenant.timezone || "Asia/Manila";
  const { start: todayStart, end: tomorrowStart } = localDayBounds(now, timeZone);

  const [
    vehicleCounts, bookingCounts, customerCount, branchCount, completedValue,
    upcoming, recent, fleetTotal, pendingItems, pickupItems, returnItems,
    overdueItems, openBookings, recentPaymentTotals,
  ] = await Promise.all([
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
    prisma.booking.findMany({
      where: { tenantId, status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 5,
      select: { id: true, reference: true, startAt: true, endAt: true, totalAmount: true, customer: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { tenantId, status: "CONFIRMED", startAt: { gte: todayStart, lt: tomorrowStart } },
      orderBy: { startAt: "asc" }, take: 5,
      select: { id: true, reference: true, startAt: true, endAt: true, customer: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { tenantId, status: "ACTIVE", endAt: { gte: todayStart, lt: tomorrowStart } },
      orderBy: { endAt: "asc" }, take: 5,
      select: { id: true, reference: true, startAt: true, endAt: true, customer: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { tenantId, status: "ACTIVE", endAt: { lt: now } },
      orderBy: { endAt: "asc" }, take: 5,
      select: { id: true, reference: true, startAt: true, endAt: true, customer: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { tenantId, status: { in: ["CONFIRMED", "ACTIVE"] } },
      select: { totalAmount: true, payments: { select: { amount: true, kind: true } } },
    }),
    prisma.rentalPayment.groupBy({
      by: ["kind"], where: { tenantId, receivedAt: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    }),
  ]);

  const vehicleMap = Object.fromEntries(vehicleCounts.map((x) => [x.status.toLowerCase(), x._count._all]));
  const bookingMap = Object.fromEntries(bookingCounts.map((x) => [x.status.toLowerCase(), x._count._all]));
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sevenDaysAgo);
    day.setDate(day.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    const items = recent.filter((x) => x.createdAt.toISOString().slice(0, 10) === key);
    return { date: key, label: day.toLocaleDateString("en-PH", { weekday: "short", timeZone }), bookings: items.length };
  });
  const utilization = fleetTotal ? Math.round(((vehicleMap.rented || 0) + (vehicleMap.reserved || 0)) / fleetTotal * 100) : 0;
  const collected30d = recentPaymentTotals.reduce((sum, row) => {
    const amount = Number(row._sum.amount || 0);
    return sum + (row.kind === "REFUND" ? -amount : amount);
  }, 0);
  const outstandingBalance = openBookings.reduce((sum, booking) => {
    const netPaid = booking.payments.reduce((paid, payment) => paid + (payment.kind === "REFUND" ? -Number(payment.amount) : Number(payment.amount)), 0);
    return sum + Math.max(0, Number(booking.totalAmount) - netPaid);
  }, 0);

  const actionItem = (booking: { id: string; reference: string; startAt: Date; endAt: Date; customer: { name: string }; totalAmount?: unknown }) => ({
    id: booking.id, reference: booking.reference, customer: booking.customer.name,
    startAt: booking.startAt.toISOString(), endAt: booking.endAt.toISOString(),
    ...(booking.totalAmount !== undefined ? { totalAmount: Number(booking.totalAmount) } : {}),
  });

  return NextResponse.json({
    workspace: { name: access.tenant.name, slug: access.tenant.slug, role: access.role, currency: access.tenant.currency, trial: access.tenant.subscription?.trialPolicyVersion === 1 && access.tenant.subscription.status === "trialing" ? { endsAt: access.tenant.subscription.trialEndsAt?.toISOString() || null, graceEndsAt: access.tenant.subscription.trialGraceEndsAt?.toISOString() || null, readOnly: access.trialReadOnly } : null },
    metrics: {
      totalVehicles: fleetTotal, availableVehicles: vehicleMap.available || 0, rentedVehicles: vehicleMap.rented || 0,
      reservedVehicles: vehicleMap.reserved || 0, maintenanceVehicles: vehicleMap.maintenance || 0,
      activeBookings: (bookingMap.active || 0) + (bookingMap.confirmed || 0),
      pendingBookings: bookingMap.pending || 0, completedBookings: bookingMap.completed || 0,
      customers: customerCount, branches: branchCount, utilization,
      completedValue30d: Number(completedValue._sum.totalAmount || 0),
      collected30d, outstandingBalance,
      bookings7d: recent.length,
    },
    actionCenter: {
      pendingCount: bookingMap.pending || 0,
      pendingItems: pendingItems.map(actionItem),
      pickupsToday: pickupItems.map(actionItem),
      returnsToday: returnItems.map(actionItem),
      overdueReturns: overdueItems.map(actionItem),
      outstandingCount: openBookings.filter((booking) => {
        const netPaid = booking.payments.reduce((paid, payment) => paid + (payment.kind === "REFUND" ? -Number(payment.amount) : Number(payment.amount)), 0);
        return Number(booking.totalAmount) - netPaid > 0.005;
      }).length,
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
