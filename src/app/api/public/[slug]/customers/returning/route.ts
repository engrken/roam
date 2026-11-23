import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || phone.length < 7 || phone.length > 30) {
    return NextResponse.json({ error: "Enter a valid email address and mobile number." }, { status: 400 });
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, status: true } });
  if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) return NextResponse.json({ error: "Rental business is unavailable." }, { status: 404 });
  const allowed = await consumeRateLimit("returning-customer-lookup", getClientIp(request.headers), 12, 60 * 60 * 1000);
  if (!allowed) return NextResponse.json({ error: "Too many lookup attempts. Please try again later." }, { status: 429 });
  const customer = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, email: { equals: email, mode: "insensitive" }, phone },
    select: { name: true },
  });
  return NextResponse.json(customer ? { found: true, customer: { name: customer.name } } : { found: false });
}
