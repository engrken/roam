import { prisma } from "@/lib/prisma";
import { sendSubscriptionPaymentEmail } from "@/lib/email";
import { createAppNotification } from "@/lib/app-notifications";

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
  await createAppNotification({
    tenantId: input.tenantId,
    audience: "TENANT",
    type: "SUBSCRIPTION_PAYMENT",
    title: input.status === "APPROVED" ? "Subscription payment approved"
      : input.status === "REJECTED" ? "Subscription payment needs attention"
      : input.status === "EXPIRED" ? "Provisional subscription access expired"
      : "Subscription payment submitted",
    message: input.status === "APPROVED"
      ? "Your subscription payment reference " + input.reference + " was approved."
      : input.status === "REJECTED"
        ? "Your subscription payment reference " + input.reference + " was rejected. " + (input.reason || "Review the payment details and resubmit.")
        : input.status === "EXPIRED"
          ? "The provisional access period for subscription payment " + input.reference + " expired before approval."
          : "Your subscription payment reference " + input.reference + " was submitted for review.",
    actionUrl: "/workspace/" + encodeURIComponent(tenant.slug) + "/account",
    dedupeKey: "subscription-payment:" + input.tenantId + ":" + input.reference + ":" + input.status,
  });
}

export async function expireTenantPendingSubscriptionPayment(tenantId: string, now = new Date()) {
  const item = await prisma.subscriptionPaymentSubmission.findFirst({
    where: { tenantId, status: "PENDING", provisionalUntil: { lte: now } },
    select: { id: true, tenantId: true, reference: true, amount: true, previousTenantStatus: true, previousSubscriptionStatus: true, previousCurrentPeriodStart: true, previousCurrentPeriodEnd: true, previousTrialEndsAt: true, previousTrialGraceEndsAt: true },
  });
  if (!item) return false;
  const claimed = await prisma.$transaction(async tx => {
    const update = await tx.subscriptionPaymentSubmission.updateMany({
      where: { id: item.id, status: "PENDING", provisionalUntil: { lte: now } },
      data: { status: "EXPIRED", reviewedAt: now, rejectionReason: "The 3-day provisional access period expired before payment confirmation." },
    });
    if (!update.count) return false;
    await tx.subscription.updateMany({
      where: { tenantId: item.tenantId, status: "payment_pending" },
      data: {
        status: item.previousSubscriptionStatus, currentPeriodStart: item.previousCurrentPeriodStart,
        currentPeriodEnd: item.previousCurrentPeriodEnd, trialEndsAt: item.previousTrialEndsAt,
        trialGraceEndsAt: item.previousTrialGraceEndsAt,
      },
    });
    await tx.tenant.update({ where: { id: item.tenantId }, data: { status: item.previousTenantStatus } });
    return true;
  });
  if (claimed) await notifySubscriptionPayment({ tenantId: item.tenantId, status: "EXPIRED", reference: item.reference, amount: Number(item.amount) });
  return claimed;
}

export async function expirePendingSubscriptionPayments(now = new Date()) {
  const expired = await prisma.subscriptionPaymentSubmission.findMany({
    where: { status: "PENDING", provisionalUntil: { lte: now } },
    select: { id: true, tenantId: true, reference: true, amount: true, previousTenantStatus: true, previousSubscriptionStatus: true, previousCurrentPeriodStart: true, previousCurrentPeriodEnd: true, previousTrialEndsAt: true, previousTrialGraceEndsAt: true },
    take: 100,
  });
  let count = 0;
  for (const item of expired) {
    const claimed = await prisma.$transaction(async tx => {
      const update = await tx.subscriptionPaymentSubmission.updateMany({
        where: { id: item.id, status: "PENDING", provisionalUntil: { lte: now } },
        data: { status: "EXPIRED", reviewedAt: now, rejectionReason: "The 3-day provisional access period expired before payment confirmation." },
      });
      if (!update.count) return false;
      await tx.subscription.updateMany({
        where: { tenantId: item.tenantId, status: "payment_pending" },
        data: {
          status: item.previousSubscriptionStatus,
          currentPeriodStart: item.previousCurrentPeriodStart,
          currentPeriodEnd: item.previousCurrentPeriodEnd,
          trialEndsAt: item.previousTrialEndsAt,
          trialGraceEndsAt: item.previousTrialGraceEndsAt,
        },
      });
      await tx.tenant.update({ where: { id: item.tenantId }, data: { status: item.previousTenantStatus } });
      return true;
    });
    if (claimed) {
      count++;
      await notifySubscriptionPayment({ tenantId: item.tenantId, status: "EXPIRED", reference: item.reference, amount: Number(item.amount) });
    }
  }
  return count;
}
