import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function tokenFrom(request: NextRequest) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]
    || request.nextUrl.searchParams.get("token")
    || "";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const token = tokenFrom(request);
  if (token.length < 20) return NextResponse.json({ error: "A valid booking access link is required." }, { status: 401 });

  const booking = await prisma.booking.findFirst({
    where: { reference, publicTokenHash: hash(token) },
    select: { id: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const notificationSelect = {
    id: true, type: true, title: true, message: true, actionUrl: true,
    createdAt: true, acknowledgedAt: true, acknowledgedByLabel: true,
  } as const;
  const [pending, acknowledged] = await Promise.all([
    prisma.appNotification.findMany({
      where: { bookingId: booking.id, audience: "CLIENT", acknowledgedAt: null },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: notificationSelect,
    }),
    prisma.appNotification.findMany({
      where: { bookingId: booking.id, audience: "CLIENT", acknowledgedAt: { not: null } },
      orderBy: { acknowledgedAt: "desc" },
      take: 50,
      select: notificationSelect,
    }),
  ]);
  const rows = [...pending, ...acknowledged].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json({
    notifications: rows.map(row => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
