import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { rentalDateTimeToUtc } from "@/lib/datetime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot view fleet availability." }, { status: 403 });

  const from = request.nextUrl.searchParams.get("from") || "";
  const to = request.nextUrl.searchParams.get("to") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Choose a valid calendar date range." }, { status: 400 });
  }
  const timeZone = access.tenant.timezone || "Asia/Manila";
  const startAt = rentalDateTimeToUtc(from + "T00:00", timeZone);
  const endDate = new Date(to + "T12:00:00.000Z");
  if (!startAt || !Number.isFinite(endDate.getTime())) {
    return NextResponse.json({ error: "The selected calendar range is invalid." }, { status: 400 });
  }
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const endAt = rentalDateTimeToUtc(endDate.toISOString().slice(0, 10) + "T00:00", timeZone);
  if (!endAt || endAt <= startAt) return NextResponse.json({ error: "The selected calendar range is invalid." }, { status: 400 });

  const [vehicles, bookings] = await Promise.all([
    prisma.vehicle.findMany({
      where: { tenantId: access.tenant.id, status: { not: "INACTIVE" } },
      orderBy: [{ branch: { name: "asc" } }, { make: "asc" }, { model: "asc" }],
      select: { id: true, make: true, model: true, plateNumber: true, status: true, branch: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: {
        tenantId: access.tenant.id,
        status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true, reference: true, status: true, startAt: true, endAt: true,
        customer: { select: { name: true } },
        items: { select: { vehicleId: true } },
      },
    }),
  ]);

  return NextResponse.json({
    timeZone,
    vehicles: vehicles.map(vehicle => ({
      id: vehicle.id, make: vehicle.make, model: vehicle.model,
      plateNumber: vehicle.plateNumber, status: vehicle.status,
      branch: vehicle.branch?.name || "Unassigned",
    })),
    bookings: bookings.map(booking => ({
      id: booking.id, reference: booking.reference, status: booking.status,
      startAt: booking.startAt.toISOString(), endAt: booking.endAt.toISOString(),
      customer: booking.customer.name, vehicleIds: booking.items.map(item => item.vehicleId),
    })),
  });
}
