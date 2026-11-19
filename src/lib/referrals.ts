import type { Prisma } from "@prisma/client";

export function addCalendarMonths(value: Date, months: number) {
  const result = new Date(value);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export async function grantReferralMonth(tx: Prisma.TransactionClient, tenantId: string) {
  const subscription = await tx.subscription.findUnique({
    where: { tenantId },
    select: { status: true, currentPeriodEnd: true },
  });
  if (!subscription) return "QUEUED" as const;
  if (subscription.status === "active" && subscription.currentPeriodEnd) {
    await tx.subscription.update({
      where: { tenantId },
      data: { currentPeriodEnd: addCalendarMonths(subscription.currentPeriodEnd > new Date() ? subscription.currentPeriodEnd : new Date(), 1) },
    });
    return "APPLIED" as const;
  }
  await tx.subscription.update({ where: { tenantId }, data: { referralCreditMonths: { increment: 1 } } });
  return "QUEUED" as const;
}
