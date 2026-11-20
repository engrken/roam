import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, hasWorkspaceTier } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (!await hasWorkspaceTier(access.tenant.id, "PRO")) return NextResponse.json({ error: "Operational reports are available on the Pro plan and above. Upgrade your workspace to continue." }, { status: 403 });
  const now = new Date();
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const defaultFrom = new Date(defaultTo.getTime() - 29 * 86400000);
  const from = parseDate(request.nextUrl.searchParams.get("from"), defaultFrom);
  const to = parseDate(request.nextUrl.searchParams.get("to"), defaultTo);
  if (!from || !to || from > to) return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
  if (to.getTime() - from.getTime() > 365 * 86400000) return NextResponse.json({ error: "Report range cannot exceed 366 days." }, { status: 400 });
  const endExclusive = new Date(to.getTime() + 86400000);
  const tenantId = access.tenant.id;
  const requestedBranchId = request.nextUrl.searchParams.get("branchId")?.trim() || null;
  if (requestedBranchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: requestedBranchId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!branch) return NextResponse.json({ error: "That branch is unavailable in this workspace." }, { status: 404 });
  }
  const branchFilter = requestedBranchId ? { branchId: requestedBranchId } : {};
  const [bookings, fleetCount, rentalTransactions, operatingExpenses, serviceRecords] = await Promise.all([
    prisma.booking.findMany({
      where: { tenantId, ...branchFilter, startAt: { gte: from, lt: endExclusive } },
      select: { id: true, reference: true, status: true, startAt: true, endAt: true, totalAmount: true, customer: { select: { name: true } }, branch: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    }),
    prisma.vehicle.count({ where: { tenantId, ...branchFilter, status: { not: "INACTIVE" } } }),
    prisma.rentalPayment.findMany({
      where: { tenantId, receivedAt: { gte: from, lt: endExclusive }, ...(requestedBranchId ? { booking: { branchId: requestedBranchId } } : {}) },
      select: { amount: true, kind: true },
    }),
    prisma.operatingExpense.findMany({
      where: { tenantId, incurredAt: { gte: from, lt: endExclusive }, ...branchFilter },
      select: { amount: true },
    }),
    prisma.vehicleServiceRecord.findMany({
      where: { tenantId, performedAt: { gte: from, lt: endExclusive }, ...(requestedBranchId ? { vehicle: { branchId: requestedBranchId } } : {}) },
      select: { cost: true },
    }),
  ]);
  const byDay = new Map<string, { date: string; bookings: number; completed: number; revenue: number }>();
  for (let cursor = new Date(from); cursor < endExclusive; cursor = new Date(cursor.getTime() + 86400000)) {
    const key = cursor.toISOString().slice(0, 10);
    byDay.set(key, { date: key, bookings: 0, completed: 0, revenue: 0 });
  }
  const recordedPayments = rentalTransactions.filter((item) => item.kind !== "REFUND").reduce((sum, item) => sum + Number(item.amount), 0);
  const recordedRefunds = rentalTransactions.filter((item) => item.kind === "REFUND").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenseTotal = operatingExpenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const serviceCostTotal = serviceRecords.reduce((sum, item) => sum + Number(item.cost), 0);
  const statusCounts: Record<string, number> = {};
  let completedRevenue = 0;
  let pendingValue = 0;
  for (const booking of bookings) {
    const key = booking.startAt.toISOString().slice(0, 10);
    const day = byDay.get(key);
    if (day) {
      day.bookings += 1;
      if (booking.status === "COMPLETED") {
        day.completed += 1;
        day.revenue += Number(booking.totalAmount);
      }
    }
    statusCounts[booking.status] = (statusCounts[booking.status] || 0) + 1;
    if (booking.status === "COMPLETED") completedRevenue += Number(booking.totalAmount);
    if (["PENDING", "CONFIRMED", "ACTIVE"].includes(booking.status)) pendingValue += Number(booking.totalAmount);
  }
  return NextResponse.json({
    range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), branchId: requestedBranchId },
    summary: {
      bookings: bookings.length,
      completed: statusCounts.COMPLETED || 0,
      cancelled: statusCounts.CANCELLED || 0,
      pending: statusCounts.PENDING || 0,
      confirmed: statusCounts.CONFIRMED || 0,
      active: statusCounts.ACTIVE || 0,
      rejected: statusCounts.REJECTED || 0,
      completedRevenue: Math.round(completedRevenue * 100) / 100,
      openBookingValue: Math.round(pendingValue * 100) / 100,
      fleetCount,
      recordedPayments: Math.round(recordedPayments * 100) / 100,
      recordedRefunds: Math.round(recordedRefunds * 100) / 100,
      operatingExpenses: Math.round(expenseTotal * 100) / 100,
      serviceCosts: Math.round(serviceCostTotal * 100) / 100,
      netRecordedCashFlow: Math.round((recordedPayments - recordedRefunds - expenseTotal - serviceCostTotal) * 100) / 100,
    },
    statusCounts,
    daily: Array.from(byDay.values()),
    bookings: bookings.map(booking => ({
      reference: booking.reference,
      customer: booking.customer.name,
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
      totalAmount: Number(booking.totalAmount),
      branch: booking.branch?.name || "Unassigned",
    })),
  });
}
