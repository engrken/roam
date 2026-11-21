import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMarketplaceHostReviewUpdate } from "@/lib/email";

export type MarketplaceHostNotificationTarget = "HOST_PROFILE" | "LISTING";

const statusLabels: Record<string, string> = {
  IN_REVIEW: "in review",
  NEEDS_INFORMATION: "needs information",
  PREQUALIFIED: "prequalified",
  DECLINED: "declined",
  SUSPENDED: "suspended",
};

const defaultMessages: Record<string, string> = {
  IN_REVIEW: "The ROAM team is reviewing the information you submitted. We will update you when the review progresses.",
  NEEDS_INFORMATION: "ROAM needs more information before the review can continue. Please read the review message and update your submission in your Host workspace.",
  PREQUALIFIED: "Your submission has passed preliminary screening. This is not a certification of identity, vehicle ownership, registration, safety, insurance, or legal authority, and it does not make a listing public.",
  DECLINED: "ROAM is unable to proceed with this submission at this time. Please read the review message for any additional context.",
  SUSPENDED: "This Host submission has been suspended. Marketplace listing activity is paused. Contact ROAM support if you need assistance.",
};

export function marketplaceHostReviewTitle(targetType: MarketplaceHostNotificationTarget, status: string) {
  const targetLabel = targetType === "HOST_PROFILE" ? "Host profile" : "Vehicle listing";
  return targetLabel + " " + (statusLabels[status] || "updated");
}

export function marketplaceHostReviewMessage(status: string, hostMessage?: string | null) {
  const custom = hostMessage?.trim();
  return custom || defaultMessages[status] || "Your marketplace submission has been updated. Sign in to your ROAM workspace to review the latest status.";
}

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
