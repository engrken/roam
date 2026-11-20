import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const refundMethods = ["GCASH", "MAYA", "BANK_TRANSFER", "CASH", "OTHER"] as const;

export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });

  const [payments, refunds] = await Promise.all([
    prisma.billingRecord.findMany({
      where: { status: "PAID", description: { contains: "subscription", mode: "insensitive" } },
      orderBy: { paidAt: "desc" }, take: 200,
      include: { tenant: { select: { id: true, name: true, slug: true, email: true } }, refunds: { where: { status: { not: "CANCELLED" } }, select: { amount: true } } },
    }),
    prisma.subscriptionRefund.findMany({
      orderBy: { createdAt: "desc" }, take: 200,
      include: { tenant: { select: { id: true, name: true, slug: true } }, billingRecord: { select: { reference: true, description: true, amount: true, paidAt: true } } },
    }),
  ]);

  return NextResponse.json({
    payments: payments.map(payment => {
      const refunded = payment.refunds.reduce((sum, refund) => sum + Number(refund.amount), 0);
      return {
        id: payment.id, tenantId: payment.tenantId, tenantName: payment.tenant.name, tenantSlug: payment.tenant.slug,
        tenantEmail: payment.tenant.email, description: payment.description, reference: payment.reference,
        amount: Number(payment.amount), currency: payment.currency, paidAt: payment.paidAt?.toISOString() || null,
        reservedRefundAmount: refunded, remainingRefundable: Math.max(0, Number(payment.amount) - refunded),
      };
    }),
    refunds: refunds.map(refund => ({
      id: refund.id, tenantId: refund.tenantId, tenantName: refund.tenant.name, tenantSlug: refund.tenant.slug,
      billingRecordId: refund.billingRecordId, paymentReference: refund.billingRecord.reference,
      paymentDescription: refund.billingRecord.description, paymentAmount: Number(refund.billingRecord.amount),
      amount: Number(refund.amount), currency: refund.currency, method: refund.method, reference: refund.reference,
      reason: refund.reason, status: refund.status, recordedById: refund.recordedById,
      completedById: refund.completedById, completedAt: refund.completedAt?.toISOString() || null,
      createdAt: refund.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const billingRecordId = typeof body?.billingRecordId === "string" ? body.billingRecordId : "";
  const amount = Number(body?.amount);
  const method = typeof body?.method === "string" ? body.method : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (!billingRecordId || !Number.isFinite(amount) || amount <= 0 || amount > 100000000 || !refundMethods.includes(method as typeof refundMethods[number]) || reason.length < 3) {
    return NextResponse.json({ error: "Choose a paid subscription payment, a valid refund amount and method, and provide a reason." }, { status: 400 });
  }

  try {
    const refund = await prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1)) IS NULL AS locked", "subscription-refund:" + billingRecordId);
      const payment = await tx.billingRecord.findFirst({
        where: { id: billingRecordId, status: "PAID", description: { contains: "subscription", mode: "insensitive" } },
        select: { id: true, tenantId: true, amount: true, currency: true },
      });
      if (!payment) throw new Error("PAYMENT_NOT_FOUND");
      const reserved = await tx.subscriptionRefund.aggregate({
        where: { billingRecordId, status: { not: "CANCELLED" } }, _sum: { amount: true },
      });
      const remaining = Number(payment.amount) - Number(reserved._sum.amount || 0);
      if (amount > remaining + 0.000001) throw new Error("REFUND_EXCEEDS_BALANCE");
      const created = await tx.subscriptionRefund.create({
        data: { tenantId: payment.tenantId, billingRecordId, amount, currency: payment.currency, method, reason, recordedById: admin.id, status: "PENDING" },
      });
      await tx.platformAuditLog.create({ data: {
        actorUserId: admin.id, actorEmail: admin.email, action: "subscription.refund.recorded",
        entityType: "subscriptionRefund", entityId: created.id,
        details: { tenantId: payment.tenantId, billingRecordId, amount, currency: payment.currency, method, status: "PENDING" },
      } });
      return created;
    });
    return NextResponse.json({ refund: { id: refund.id, amount: Number(refund.amount), status: refund.status }, message: "Refund ledger entry created. Send the funds outside ROAM, then mark the refund completed with its transaction reference." }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYMENT_NOT_FOUND") return NextResponse.json({ error: "Paid subscription payment not found." }, { status: 404 });
    if (error instanceof Error && error.message === "REFUND_EXCEEDS_BALANCE") return NextResponse.json({ error: "This refund exceeds the payment's remaining refundable balance." }, { status: 409 });
    console.error("Subscription refund creation failed", error);
    return NextResponse.json({ error: "Unable to record this subscription refund." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const refundId = typeof body?.refundId === "string" ? body.refundId : "";
  const decision = body?.decision === "complete" ? "COMPLETED" : body?.decision === "cancel" ? "CANCELLED" : "";
  const reference = typeof body?.reference === "string" ? body.reference.trim().slice(0, 120) : "";
  if (!refundId || !decision || (decision === "COMPLETED" && !reference)) {
    return NextResponse.json({ error: "Choose a valid refund action and provide the external transaction reference when completing a refund." }, { status: 400 });
  }
  try {
    const result = await prisma.$transaction(async tx => {
      const item = await tx.subscriptionRefund.findUnique({ where: { id: refundId }, select: { id: true, billingRecordId: true, tenantId: true, amount: true, status: true } });
      if (!item) throw new Error("REFUND_NOT_FOUND");
      await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1)) IS NULL AS locked", "subscription-refund:" + item.billingRecordId);
      const update = await tx.subscriptionRefund.updateMany({
        where: { id: refundId, status: "PENDING" },
        data: decision === "COMPLETED"
          ? { status: "COMPLETED", reference, completedById: admin.id, completedAt: new Date() }
          : { status: "CANCELLED", completedById: admin.id, completedAt: new Date() },
      });
      if (update.count !== 1) throw new Error("REFUND_ALREADY_REVIEWED");
      await tx.platformAuditLog.create({ data: {
        actorUserId: admin.id, actorEmail: admin.email, action: "subscription.refund." + decision.toLowerCase(),
        entityType: "subscriptionRefund", entityId: refundId,
        details: { tenantId: item.tenantId, billingRecordId: item.billingRecordId, amount: Number(item.amount), reference: decision === "COMPLETED" ? reference : null },
      } });
      return { status: decision };
    });
    return NextResponse.json({ status: result.status, message: result.status === "COMPLETED" ? "Refund marked completed. ROAM has recorded the external refund reference." : "Pending refund entry cancelled." });
  } catch (error) {
    if (error instanceof Error && error.message === "REFUND_NOT_FOUND") return NextResponse.json({ error: "Refund record not found." }, { status: 404 });
    if (error instanceof Error && error.message === "REFUND_ALREADY_REVIEWED") return NextResponse.json({ error: "This refund has already been completed or cancelled." }, { status: 409 });
    console.error("Subscription refund update failed", error);
    return NextResponse.json({ error: "Unable to update this refund record." }, { status: 500 });
  }
}
