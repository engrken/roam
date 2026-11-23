import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getTenantAccess } from "@/lib/tenant-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const sub = body?.subscription;
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (!endpoint.startsWith("https://") || endpoint.length > 2048 || p256dh.length < 40 || auth.length < 16) return NextResponse.json({ error: "Invalid browser push subscription." }, { status: 400 });
  let tenantId: string | null = null; let bookingId: string | null = null;
  if (typeof body?.slug === "string") {
    const access = await getTenantAccess(body.slug);
    if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
    tenantId = access.tenant.id;
  } else {
    const reference = typeof body?.reference === "string" ? body.reference : "";
    const token = typeof body?.token === "string" ? body.token : "";
    if (token.length < 20) return NextResponse.json({ error: "A valid private booking link is required." }, { status: 401 });
    const booking = await prisma.booking.findFirst({ where: { reference, publicTokenHash: hash(token) }, select: { id: true } });
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    bookingId = booking.id;
  }
  await prisma.webPushSubscription.upsert({ where: { endpoint }, create: { endpoint, p256dh, auth, tenantId, bookingId }, update: { p256dh, auth, tenantId, bookingId } });
  return NextResponse.json({ subscribed: true });
}
export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "Subscription endpoint is required." }, { status: 400 });
  if (typeof body?.slug === "string") {
    const access = await getTenantAccess(body.slug);
    if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
    await prisma.webPushSubscription.deleteMany({ where: { endpoint, tenantId: access.tenant.id } });
  } else {
    const reference = typeof body?.reference === "string" ? body.reference : "";
    const token = typeof body?.token === "string" ? body.token : "";
    const booking = await prisma.booking.findFirst({ where: { reference, publicTokenHash: hash(token) }, select: { id: true } });
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    await prisma.webPushSubscription.deleteMany({ where: { endpoint, bookingId: booking.id } });
  }
  return NextResponse.json({ unsubscribed: true });
}
