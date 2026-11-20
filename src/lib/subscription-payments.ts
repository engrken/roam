import { prisma } from "@/lib/prisma";
import { sendSubscriptionPaymentEmail } from "@/lib/email";

export async function notifySubscriptionPayment(input: {
  tenantId: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED" | "EXPIRED";
  reference: string;
  amount: number;
  provisionalUntil?: Date;
  reason?: string;
}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { name: true, slug: true, memberships: { where: { role: "OWNER" }, take: 1, select: { user: { select: { email: true } } } } },
  });
  const recipient = tenant?.memberships[0]?.user.email;
  if (!tenant || !recipient) return;
  const accountUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/+$/, "") + "/workspace/" + encodeURIComponent(tenant.slug) + "/payments";
  try {
    await sendSubscriptionPaymentEmail({
      recipient, businessName: tenant.name, status: input.status, reference: input.reference,
      amount: input.amount, accountUrl, provisionalUntil: input.provisionalUntil, reason: input.reason,
    });
  } catch (error) {
    console.error("Subscription payment tenant notification failed", error);
  }
}

export async function expireTenantPendingSubscriptionPayment(tenantId: string, now = new Date()) {
  const item = await prisma.subscriptionPaymentSubmission.findFirst({
    where: { tenantId, status: "PENDING", provisionalUntil: { lte: now } },
    select: { id: true, tenantId: true, reference: true, amount: true, pre¶»§q«^