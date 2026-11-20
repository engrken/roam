import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { expirePendingSubscriptionPayments, notifySubscriptionPayment } from "@/lib/subscription-payments";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (access.role !== "OWNER") return NextResponse.json({ error: "Only the workspace owner can manage subscription payments." }, { status: 403 });
  await expirePendingSubscriptionPayments();
  const [methods, submissions, subscription] = await Promise.all([
    prisma.subscriptionPaymentMethod.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" }, select: { id: true, key: true, label: true, accountName: true, instructions: true, qrImageData: true, qrContentType: true } }),
    prisma.subscriptionPaymentSubmission.findMany({ where: { tenantId: access.tenant.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, methodLabel: true, reference: true, amount: true, paidAt: true, status: true, provisionalUntil: true, rejectionReason: true, createdAt: true } }),
    prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, include: { plan: { select: { name: true, monthlyPrice: true ¶»§q«^