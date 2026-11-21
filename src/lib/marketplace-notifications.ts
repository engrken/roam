import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMarketplaceHostReviewUpdate } from "@/lib/email";

import { marketplaceHostReviewTitle, marketplaceHostReviewMessage, type MarketplaceHostNotificationTarget } from "@/lib/marketplace-notification-copy";
export { marketplaceHostReviewTitle, marketplaceHostReviewMessage } from "@/lib/marketplace-notification-copy";

export async function createMarketplaceHostNotification(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    targetType: MarketplaceHostNotificationTarget;
    targetId: string;
    status: string;
    recipientEmail: string;
    recipientName: string;
    hostMessage?: string | null;
  },
) {
  const title = marketplaceHostReviewTitle(input.targetType, input.status);
  const message = marketplaceHostReviewMessage(input.status, input.hostMessage);
  return tx.marketplaceHostNotification.create({
    data: {
      tenantId: input.tenantId,
      targetType: input.targetType,
      targetId: input.targetId,
      status: input.status,
      title,
      message,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
    },
    select: { id: true, emailStatus: true },
  });
}

export async function deliverMarketplaceHostNotification(id: string) {
  const notification = await prisma.marketplaceHostNotification.findUnique({
    where: { id },
    include: { tenant: { select: { name: true, slug: true } } },
  });
  if (!notification) return { found: false as const, emailStatus: null };

  const claim = await prisma.marketplaceHostNotification.updateMany({
    where: { id, emailStatus: { in: ["PENDING", "FAILED"] } },
    data: { emailStatus: "SENDING", emailError: null },
  });
  if (claim.count !== 1) return { found: true as const, emailStatus: notification.emailStatus };

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/+$/, "");
  const workspaceUrl = baseUrl + "/workspace/" + encodeURIComponent(notification.tenant.slug) + "/marketplace";
  try {
    await sendMarketplaceHostReviewUpdate({
      recipient: notification.recipientEmail,
      recipientName: notification.recipientName,
      workspaceName: notification.tenant.name,
      targetLabel: notification.targetType === "HOST_PROFILE" ? "Host profile" : "Vehicle listing",
      status: notification.status,
      message: notification.message,
      workspaceUrl,
    });
    await prisma.marketplaceHostNotification.update({
      where: { id },
      data: { emailStatus: "SENT", emailSentAt: new Date(), emailError: null },
    });
    return { found: true as const, emailStatus: "SENT" as const };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Email delivery failed.";
    await prisma.marketplaceHostNotification.update({
      where: { id },
      data: { emailStatus: "FAILED", emailError: detail.slice(0, 1000) },
    });
    return { found: true as const, emailStatus: "FAILED" as const };
  }
}
