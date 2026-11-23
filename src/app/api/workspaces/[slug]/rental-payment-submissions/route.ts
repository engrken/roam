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
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot review rental payments." }, { status: 403 });
  const submissions = await prisma.rentalPaymentSubmission.findMany({
    where: { tenantId: access.tenant.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100,
    include: { booking: { select: { reference: true, customer: { select: { name: true, phone: true } }, documents: { where: { kind: "PAYMENT_EVIDENCE" }, select: { id: true, pathname: true } } } }, paymentMethod: { select: { method: true } } },
  });
  return NextResponse.json({ submissions: submissions.map(row => ({
    id: row.id, bookingReference: row.booking.reference, customer: row.booking.customer.name,
    customerPhone: row.booking.customer.phone, method: row.methodLabelSnapshot, methodKey: row.paymentMethod.method,
    accountName: row.accountNameSnapshot, accountNumber: row.accountNumberSnapshot, bankName: row.bankNameSnapshot,
    reference: row.reference, amount: Number(row.amount), paidAt: row.paidAt.toISOString(),
    proofPathname: row.proofPathname, proofDocumentId: row.booking.documents.find(doc => doc.pathname === row.proofPathname)?.id || null, status: row.status, customerNote: row.customerNote,
    rejectionReason: row.rejectionReason, createdAt: row.createdAt.toISOString(),
  })) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot review rental payments." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : "";
  const action = body?.action === "APPROVE" ? "APPROVE" : body?.action === "REJECT" ? "REJECT" : "";
  const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason.trim().slice(0, 1000) : "";
  if (!submissionId || !action || (action === "REJECT" && rejectionReason.length < 3)) return NextResponse.json({ error: "Choose approve or provide a rejection reason." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async tx => {
      const initial = await tx.rentalPaymentSubmission.findFirst({ where: { id: submissionId, tenantId: access.tenant.id }, select: { bookingId: true } });
      if (!initial) throw new Error("SUBMISSION_NOT_FOUND");
      await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2)) IS NULL AS locked", access.tenant.id, initial.bookingId);
      const row = await tx.rentalPaymentSubmission.findFirst({ where: { id: submissionId, tenantId: access.tenant.id }, include: { booking: { include: { payments: { select: { amount: true, kind: true } } } }, paymentMethod: { select: { method: true } } } });
      if (!row) throw new Error("SUBMISSION_NOT_FOUND");
      if (row.status !== "PENDING") throw new Error("ALREADY_REVIEWED");
      if (action === "REJECT") {
        await tx.rentalPaymentSubmission.update({ where: { id: row.id }, data: { status: "REJECTED", reviewedById: access.user.id, reviewedAt: new Date(), rejectionReason } });
        await recordWorkspaceAudit(tx, { tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email, action: "rental_payment.rejected", targetType: "rentalPaymentSubmission", targetId: row.id, details: { bookingReference: row.booking.reference, reference: row.reference, amount: Number(row.amount) } });
        return { status: "REJECTED" };
      }
      const paid = row.booking.payments.reduce((sum, payment) => sum + (payment.kind === "REFUND" ? -Number(payment.amount) : Number(payment.amount)), 0);
      const remaining = Number(row.booking.totalAmount) + Number(row.booking.securityDeposit || 0) - paid;
      if (Number(row.amount) > remaining + 0.005) throw new Error("BALANCE_CHANGED");
      const payment = await tx.rentalPayment.create({ data: {
        tenantId: access.tenant.id, bookingId: row.bookingId, amount: row.amount,
        currency: row.currency, method: row.paymentMethod.method, kind: "PAYMENT",
        reference: row.reference, notes: "Customer-submitted payment approved · " + row.methodLabelSnapshot,
        receivedAt: row.paidAt,
      } });
      await tx.rentalPaymentSubmission.update({ where: { id: row.id }, data: { status: "APPROVED", reviewedById: access.user.id, reviewedAt: new Date(), rentalPaymentId: payment.id } });
      await recordWorkspaceAudit(tx, { tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email, action: "rental_payment.approved", targetType: "rentalPayment", targetId: payment.id, details: { submissionId: row.id, bookingReference: row.booking.reference, amount: Number(row.amount), method: row.paymentMethod.method } });
      return { status: "APPROVED", paymentId: payment.id };
    });
    return NextResponse.json({ reviewed: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SUBMISSION_NOT_FOUND") return NextResponse.json({ error: "Payment submission not found." }, { status: 404 });
    if (code === "ALREADY_REVIEWED") return NextResponse.json({ error: "This payment submission has already been reviewed." }, { status: 409 });
    if (code === "BALANCE_CHANGED") return NextResponse.json({ error: "The remaining booking balance changed. Review the balance before approving." }, { status: 409 });
    console.error("Rental payment review failed", error);
    return NextResponse.json({ error: "Unable to review payment submission." }, { status: 500 });
  }
}
