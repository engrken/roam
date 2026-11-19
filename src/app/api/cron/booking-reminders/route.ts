import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendBookingReminder } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const windowStart = now;
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const overdueStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [pickups, returns, overdue] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "CONFIRMED", startAt: { gte: windowStart, lt: windowEnd }, customer: { email: { not: null } } },
      select: { id: true, reference: true, startAt: true, endAt: true, tenant: { select: { name: true } }, customer: { select: { email: true } } },
      take: 200,
    }),
    prisma.booking.findMany({
      where: { status: "ACTIVE", endAt: { gte: windowStart, lt: windowEnd }, customer: { email: { not: null } } },
      select: { id: true, reference: true, startAt: true, endAt: true, tenant: { select: { name: true } }, customer: { select: { email: true } } },
      take: 200,
    }),
    prisma.booking.findMany({
      where: { status: "ACTIVE", endAt: { gt: overdueStart, lte: now }, customer: { email: { not: null } } },
      select: { id: true, reference: true, startAt: true, endAt: true, tenant: { select: { name: true } }, customer: { select: { email: true } } },
      take: 200,
    }),
  ]);

  const candidates = [
    ...pickups.map((booking) => ({ ...booking, type: "PICKUP" as const, scheduledFor: booking.startAt })),
    ...returns.map((booking) => ({ ...booking, type: "RETURN" as const, scheduledFor: booking.endAt })),
    ...overdue.map((booking) => ({ ...booking, type: "OVERDUE" as const, scheduledFor: booking.endAt })),
  ];

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const booking of candidates) {
    const dayKey = booking.scheduledFor.toISOString().slice(0, 10);
    const noticeKey = `${booking.type}:${booking.id}:${dayKey}`;
    await prisma.bookingAutomationNotice.createMany({
      data: [{ bookingId: booking.id, noticeKey, noticeType: booking.type, scheduledFor: booking.scheduledFor }],
      skipDuplicates: true,
    });
    const claim = await prisma.bookingAutomationNotice.updateMany({
      where: { noticeKey, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "PROCESSING", lastError: null },
    });
    if (claim.count === 0) { skipped++; continue; }

    try {
      if (!booking.customer.email) {
        await prisma.bookingAutomationNotice.update({ where: { noticeKey }, data: { status: "SKIPPED" } });
        skipped++;
        continue;
      }
      await sendBookingReminder({
        recipient: booking.customer.email,
        tenantName: booking.tenant.name,
        bookingReference: booking.reference,
        reminderType: booking.type,
        startAt: booking.startAt,
        endAt: booking.endAt,
      });
      await prisma.bookingAutomationNotice.update({ where: { noticeKey }, data: { status: "SENT", sentAt: new Date() } });
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Email delivery failed.";
      await prisma.bookingAutomationNotice.update({ where: { noticeKey }, data: { status: "FAILED", lastError: message.slice(0, 1000) } });
      failed++;
    }
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, sent, skipped, failed, checkedAt: now.toISOString() });
}
