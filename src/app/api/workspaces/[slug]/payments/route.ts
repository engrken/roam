import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot view financial records." }, { status: 403 });

  const [payments, bookings, paymentTotals] = await Promise.all([
    prisma.rentalPayment.findMany({
      where: { tenantId: access.tenant.id },
      orderBy: { receivedAt: "desc" },
      take: 200,
      include: { booking: { select: { reference: true, customer: { select: { name: true } } } } },
    }),
    prisma.booking.findMany({
      where: { tenantId: access.tenant.id, status: { notIn: ["CANCELLED", "REJECTED"] } },
      orderBy: { updatedAt: "desc" },
      include: { customer: { select: { name: true } }, payments: { select: { amount: true, kind: true } } },
    }),
    prisma.rentalPayment.groupBy({
      by: ["kind"],
      where: { tenantId: access.tenant.id },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const bookingBalances = bookings.map((booking) => {
    const paid = booking.payments.reduce((sum, payment) => sum + (payment.kind === "REFUND" ? -Number(payment.amount) : Number(payment.amount)), 0);
    const total = Number(booking.totalAmount) + Number(booking.securityDeposit || 0);
    return { reference: booking.reference, customer: booking.customer.name, status: booking.status, rentalTotal: Number(booking.totalAmount), total, collected: paid, outstanding: Math.max(0, total - paid) };
  });
  const collected = paymentTotals.reduce((sum, row) => {
    const amount = Number(row._sum.amount || 0);
    return sum + (row.kind === "REFUND" ? -amount : amount);
  }, 0);
  const paymentCount = paymentTotals.find((row) => row.kind === "PAYMENT")?._count._all || 0;
  const refundCount = paymentTotals.find((row) => row.kind === "REFUND")?._count._all || 0;
  const outstanding = bookingBalances.reduce((sum, booking) => sum + booking.outstanding, 0);
  const billableBalances = bookingBalances.filter(booking => ["CONFIRMED", "ACTIVE", "COMPLETED"].includes(booking.status));
  const rentDue = billableBalances.reduce((sum, booking) => sum + booking.rentalTotal, 0);
  const rentPaid = billableBalances.reduce((sum, booking) => sum + Math.max(0, booking.collected), 0);
  const balanceByReference = new Map(bookingBalances.map(booking => [booking.reference, booking]));
  const now = new Date();
  const overdueBookings = bookings.filter(booking => booking.status === "ACTIVE" && booking.endAt < now && (balanceByReference.get(booking.reference)?.outstanding || 0) > 0);
  const overdueRent = overdueBookings.reduce((sum, booking) => sum + (balanceByReference.get(booking.reference)?.outstanding || 0), 0);

  return NextResponse.json({
    summary: { collected, outstanding, rentDue, rentPaid, overdueRent, overdueBookings: overdueBookings.length, payments: paymentCount, refunds: refundCount },
    payments: payments.map((payment) => ({
      id: payment.id, amount: Number(payment.amount), currency: payment.currency, method: payment.method, kind: payment.kind,
      reference: payment.reference, notes: payment.notes, receivedAt: payment.receivedAt,
      bookingReference: payment.booking.reference, customer: payment.booking.customer.name,
    })),
    bookings: bookingBalances.filter((booking) => booking.outstanding > 0 || booking.collected > 0),
    openBookings: bookingBalances.filter((booking) => booking.outstanding > 0),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot record financial transactions." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const bookingReference = typeof body?.bookingReference === "string" ? body.bookingReference.trim() : "";
  const amount = Number(body?.amount);
  const kind = body?.kind === "REFUND" ? "REFUND" : "PAYMENT";
  const method = typeof body?.method === "string" ? body.method : "CASH";
  const allowedMethods = ["CASH", "BANK_TRANSFER", "CARD", "E_WALLET", "OTHER"];
  if (!bookingReference || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || !allowedMethods.includes(method)) {
    return NextResponse.json({ error: "Enter a valid booking, amount, and payment method." }, { status: 400 });
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2)) IS NULL AS locked",
        access.tenant.id,
        bookingReference,
      );
      const booking = await tx.booking.findFirst({
        where: { tenantId: access.tenant.id, reference: bookingReference, status: { notIn: ["CANCELLED", "REJECTED"] } },
        include: { payments: { select: { amount: true, kind: true } } },
      });
      if (!booking) throw new Error("BOOKING_NOT_FOUND");
      const netPaid = booking.payments.reduce((sum, row) => sum + (row.kind === "REFUND" ? -Number(row.amount) : Number(row.amount)), 0);
      const total = Number(booking.totalAmount) + Number(booking.securityDeposit || 0);
      if (kind === "PAYMENT" && amount > total - netPaid + 0.005) throw new Error("PAYMENT_EXCEEDS_BALANCE");
      if (kind === "REFUND" && amount > netPaid + 0.005) throw new Error("REFUND_EXCEEDS_COLLECTED");
      const created = await tx.rentalPayment.create({
        data: {
          tenantId: access.tenant.id, bookingId: booking.id, amount, kind, method,
          currency: access.tenant.currency || "PHP",
          reference: typeof body.reference === "string" ? body.reference.trim().slice(0, 120) || null : null,
          notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) || null : null,
        },
      });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: kind === "REFUND" ? "payment.refund_recorded" : "payment.recorded",
        targetType: "rentalPayment", targetId: created.id,
        details: { bookingReference, amount, kind, method, currency: access.tenant.currency || "PHP" },
      });
      return created;
    });
    return NextResponse.json({ saved: true, payment: { id: payment.id, amount: Number(payment.amount), kind: payment.kind } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "BOOKING_NOT_FOUND") return NextResponse.json({ error: "Booking not found or not eligible for payment recording." }, { status: 404 });
    if (message === "PAYMENT_EXCEEDS_BALANCE") return NextResponse.json({ error: "That amount exceeds the booking's outstanding balance." }, { status: 400 });
    if (message === "REFUND_EXCEEDS_COLLECTED") return NextResponse.json({ error: "That refund exceeds the amount recorded as collected." }, { status: 400 });
    throw error;
  }
}
