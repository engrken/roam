import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot view customer records." }, { status: 403 });
  const q = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const customers = await prisma.customer.findMany({
    where: { tenantId: access.tenant.id, ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { licenseNo: { contains: q, mode: "insensitive" } },
    ] } : {}) },
    orderBy: { updatedAt: "desc" }, take: 200,
    select: { id: true, name: true, email: true, phone: true, licenseNo: true, address: true, createdAt: true, updatedAt: true, _count: { select: { bookings: true } } },
  });
  const totals = await prisma.booking.groupBy({
    by: ["customerId"], where: { tenantId: access.tenant.id, customerId: { in: customers.map(c => c.id) } },
    _sum: { totalAmount: true },
  });
  const lifetime = new Map(totals.map(x => [x.customerId, Number(x._sum.totalAmount || 0)]));
  return NextResponse.json({ customers: customers.map(c => ({ ...c, bookingsCount: c._count.bookings, lifetimeValue: lifetime.get(c.id) || 0 })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot manage customer records." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const licenseNo = typeof body?.licenseNo === "string" ? body.licenseNo.trim().toUpperCase() : "";
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (name.length < 2 || name.length > 120 || phone.length < 5 || phone.length > 30 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || licenseNo.length > 60 || address.length > 300) {
    return NextResponse.json({ error: "Enter a valid customer name, phone, email, license number and address." }, { status: 400 });
  }
  const customer = await prisma.customer.create({ data: { tenantId: access.tenant.id, name, phone, email: email || null, licenseNo: licenseNo || null, address: address || null } });
  return NextResponse.json({ customer }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot manage customer records." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const licenseNo = typeof body?.licenseNo === "string" ? body.licenseNo.trim().toUpperCase() : "";
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (!id || name.length < 2 || name.length > 120 || phone.length < 5 || phone.length > 30 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || licenseNo.length > 60 || address.length > 300) {
    return NextResponse.json({ error: "Enter valid customer details." }, { status: 400 });
  }
  const result = await prisma.customer.updateMany({ where: { id, tenantId: access.tenant.id }, data: { name, phone, email: email || null, licenseNo: licenseNo || null, address: address || null } });
  if (!result.count) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  return NextResponse.json({ updated: true });
}
