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

  const [pickups, returns, overdue] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "CONFIRMED", startAt: { gte: windowStart, lt: windowEnd }, customer: { email: { not: null } } },
      select: { id: true, reference: true, startAt: true, endAt: true, tenant: { select: { name: true, timezone: true } }, customer: { select: { email: true } } },
      take: 200,
    }),
    prisma.booking.findMany({
      where: { status: "ACTIVE", endAt: { gte: windowStart, lt: windowEnd }, customer: { email: { not: null } } },
      select: { id: true, reference: true, startAt: true, endAt: true, tenant: { select: { name: true } }, customer: { select: { email: true } } },
      take: 200,
    }),
    prisma.booking.findMany({
      where: { status: "ACTIVE", endAt: { lte: now }, customer: { email: { not: null } } },
      orderBy: { endAt: "desc" },
      select: { id: true, reference: true, startAt: true, endAt: true, tenant: { select: { name: true } }, customer: { select: { email: true } } },
      take: 200,
    }),
  ]);

  const localDateKey = (value: Date, timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  };

  const candidates = [
    ...pickups.map((booking) => ({ ...booking, type: "PICKUP" as const, scheduledFor: booking.startAt })),
    ...returns.map((booking) => ({ ...booking, type: "RETURN" as const, scheduledFor: booking.endAt })),
    ...overdue.map((booking) => ({ ...booking, type: "OVERDUE" as const, scheduledFor: booking.endAt })),
  ];

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const booking of candidates) {
    const timeZone = booking.tenant.timezone || "Asia/Manila";
    // Pickup/return notices are keyed to the scheduled local date. Overdue reminders recur once per local calendar day.
    const dayKey = localDateKey(booking.type === "OVERDUE" ? now : booking.scheduledFor, timeZone);
    const noticeKey = `${booking.type}:${booking.id}:${dayKey}`;
    await prisma.bookingAutomationNotice.createMany({
      data: [{ bookingId: booking.id, noticeKey, noticeType: booking.type, scheduledFor: booking.scheduledFor }],
      skipDuplicates: true,
    });
    // Recover a claim abandoned by a timed-out or interrupted cron invocation.
    const staleProcessingBefore = new Date(now.getTime() - 10 * 60 * 1000);
    const claim = await prisma.bookingAutomationNotice.updateMany({
      where: {
        noticeKey,
        OR: [
          { status: { in: ["PENDING", "FAILED"] } },
          { status: "PROCESSING", updatedAt: { lt: staleProcessingBefore } },
        ],
      },
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
        timeZone,
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
