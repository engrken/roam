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
