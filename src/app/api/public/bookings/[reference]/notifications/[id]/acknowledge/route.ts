import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string; id: string }> }) {
  const { reference, id } = await params;
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string"
    ? body.token
    : request.headers.get("authorization")?.match(/^Bearer\\s+(.+)$/i)?.[1] || "";
  if (token.length < 20) return NextResponse.json({ error: "A valid booking access link is required." }, { status: 401 });

  const booking = await prisma.booking.findFirst({
    where: { reference, publicTokenHash: hash(token) },
    select: { id: true, customer: { select: { name: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const updated = await prisma.appNotification.updateMany({
    where: { id, bookingId: booking.id, audience: "CLIENT", acknowledgedAt: null },
    data: { acknowledgedAt: new Date(), acknowledgedByLabel: booking.customer.name },
  });
  if (updated.count === 1) return NextResponse.json({ acknowledged: true });

  const existing = await prisma.appNotification.findFirst({
    where: { id, bookingId: booking.id, audience: "CLIENT" },
    select: { acknowledgedAt: true },
  });
  if (!existing) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  return NextResponse.json({ acknowledged: true, alreadyAcknowledged: true });
}
