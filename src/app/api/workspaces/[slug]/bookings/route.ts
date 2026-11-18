import { NextResponse } from "next/server";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot manage bookings." }, { status: 403 });
  const bookings = await prisma.booking.findMany({
    where: { tenantId: access.tenant.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { customer: { select: { name: true, email: true, phone: true } }, items: { include: { vehicle: { select: { make: true, model: true, plateNumber: true } } } }, _count: { select: { documents: true, messages: true } } },
  });
  return NextResponse.json({ bookings: bookings.map(b => ({
    id: b.id, reference: b.reference, status: b.status, startAt: b.startAt, endAt: b.endAt,
    totalAmount: Number(b.totalAmount), createdAt: b.createdAt, customer: b.customer,
    vehicles: b.items.map(i => `${i.vehicle.make} ${i.vehicle.model} · ${i.vehicle.plateNumber}`),
    documentsCount: b._count.documents, messagesCount: b._count.messages,
  })) });
}
