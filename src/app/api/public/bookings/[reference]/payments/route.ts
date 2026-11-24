import { after, NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { notifyTenant } from "@/lib/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const tokenFrom = (request: NextRequest) => request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] || request.nextUrl.searchParams.get("token") || "";
const balanceOf = (booking: { totalAmount: unknown; securityDeposit: unknown; payments: { amount: unknown; kind: string }[] }) => {
  const paid = booking.payments.reduce((sum, row) => sum + (row.kind === "REFUND" ? -Number(row.amount) : Number(row.amount)), 0);
  return Math.max(0, Number(booking.totalAmount) + Number(booking.securityDeposit || 0) - paid);
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const token = tokenFrom(request);
  if (token.length < 20) return NextResponse.json({ error: "A valid booking access link is required." }, { status: 401 });
  const booking = await prisma.booking.findFirst({
    where: { reference, publicTokenHash: hash(token) },
    include: { tenant: { select: { name: true, currency: true } }, payments: { select: { amount: true, kind: true } }, rentalPaymentSubmissions: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, amount: true, methodLabelSnapshot: true, status: true, reference: true, createdAt: true, rejectionReason: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const methods = await prisma.tenantPaymentMethod.findMany({
    where: { tenantId: booking.tenantId, enabled: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, method: true, label: true, accountName: true, accountNumber: true, bankName: true, instructions: true, qrImageData: true, qrContentType: true },
  });
  return NextResponse.json({
    businessName: booking.tenant.name, currency: booking.tenant.currency || "PHP", status: booking.status, canPay: ["CONFIRMED","ACTIVE","COMPLETED"].includes(booking.status),
    rentalAmount: Number(booking.totalAmount), securityDeposit: Number(booking.securityDeposit || 0), totalPayable: Number(booking.totalAmount) + Number(booking.securityDeposit || 0),
    balanceDue: balanceOf(booking), methods: ["CONFIRMED","ACTIVE","COMPLETED"].includes(booking.status) ? methods : [],
    submissions: booking.rentalPaymentSubmissions.map(row => ({ ...row, amount: Number(row.amount), createdAt: row.createdAt.toISOString() })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const paymentMethodId = typeof body?.paymentMethodId === "string" ? body.paymentMethodId : "";
  const paymentReference = typeof body?.reference === "string" ? body.reference.trim().slice(0, 120) : "";
  const amount = Number(body?.amount);
  const paidAt = new Date(body?.paidAt);
  const proofPathname = typeof body?.proofPathname === "string" ? body.proofPathname : null;
  const customerNote = typeof body?.customerNote === "string" ? body.customerNote.trim().slice(0, 1000) : null;
  if (token.length < 20 || !paymentMethodId || paymentReference.length < 3 || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || !Number.isFinite(paidAt.getTime()) || paidAt > new Date(Date.now() + 5 * 60 * 1000) || paidAt < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Enter a valid payment method, amount, reference and payment date." }, { status: 400 });
  }
  const booking = await prisma.booking.findFirst({ where: { reference, publicTokenHash: hash(token) }, select: { id: true, tenantId: true, tenant: { select: { slug: true } }, totalAmount: true, securityDeposit: true, status: true, payments: { select: { amount: true, kind: true } } } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!["CONFIRMED","ACTIVE","COMPLETED"].includes(booking.status)) return NextResponse.json({ error: "Payment will be available after the rental business confirms your booking." }, { status: 409 });
  const clientIp = getClientIp(request.headers);
  const [bookingAllowed, ipAllowed] = await Promise.all([
    consumeRateLimit("customer-rental-payment", booking.id, 8, 60 * 60 * 1000),
    consumeRateLimit("customer-rental-payment-ip", clientIp, 20, 60 * 60 * 1000),
  ]);
  if (!bookingAllowed || !ipAllowed) return NextResponse.json({ error: "Too many payment submissions. Please try again later." }, { status: 429 });
  const method = await prisma.tenantPaymentMethod.findFirst({ where: { id: paymentMethodId, tenantId: booking.tenantId, enabled: true } });
  if (!method) return NextResponse.json({ error: "That payment method is no longer available." }, { status: 404 });
  if (proofPathname) {
    const proof = await prisma.bookingDocument.findFirst({ where: { bookingId: booking.id, pathname: proofPathname, kind: "PAYMENT_EVIDENCE" }, select: { id: true } });
    if (!proof) return NextResponse.json({ error: "The uploaded payment proof could not be verified. Please upload it again." }, { status: 400 });
  }
  try {
    const submission = await prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2)) IS NULL AS locked", booking.tenantId, booking.id);
      const current = await tx.booking.findFirst({ where: { id: booking.id, tenantId: booking.tenantId }, include: { payments: { select: { amount: true, kind: true } }, rentalPaymentSubmissions: { where: { status: "PENDING" }, select: { amount: true } } } });
      if (!current || !["CONFIRMED","ACTIVE","COMPLETED"].includes(current.status)) throw new Error("BOOKING_NOT_PAYABLE");
      const verifiedPaid = current.payments.reduce((sum, row) => sum + (row.kind === "REFUND" ? -Number(row.amount) : Number(row.amount)), 0);
      const pending = current.rentalPaymentSubmissions.reduce((sum, row) => sum + Number(row.amount), 0);
      const remaining = Number(current.totalAmount) + Number(current.securityDeposit || 0) - verifiedPaid - pending;
      if (amount > remaining + 0.005) throw new Error("AMOUNT_EXCEEDS_BALANCE");
      const created = await tx.rentalPaymentSubmission.create({ data: {
        tenantId: booking.tenantId, bookingId: booking.id, paymentMethodId: method.id,
        methodLabelSnapshot: method.label, accountNameSnapshot: method.accountName,
        accountNumberSnapshot: method.accountNumber, bankNameSnapshot: method.bankName,
        reference: paymentReference, amount, currency: "PHP", paidAt, proofPathname, customerNote,
      }, select: { id: true, amount: true, status: true, reference: true } });
      return created;
    });
    after(() => notifyTenant(booking.tenantId, "New payment submitted", "A customer submitted payment proof for booking " + reference + ".", "/workspace/" + encodeURIComponent(booking.tenant.slug) + "/payment-review").catch(error => console.error("Payment push notification failed", error)));
    return NextResponse.json({ submitted: true, submission: { ...submission, amount: Number(submission.amount) } }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "BOOKING_NOT_PAYABLE") return NextResponse.json({ error: "This booking is no longer eligible for payment." }, { status: 409 });
    if (code === "AMOUNT_EXCEEDS_BALANCE") return NextResponse.json({ error: "The amount exceeds the remaining balance after verified and pending payments." }, { status: 400 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "That transaction reference has already been submitted for this payment method." }, { status: 409 });
    console.error("Rental payment submission failed", error);
    return NextResponse.json({ error: "Unable to submit payment details." }, { status: 500 });
  }
}
