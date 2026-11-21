import { z } from "zod";

export const marketplaceHostStatusValues = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "NEEDS_INFORMATION",
  "PREQUALIFIED",
  "DECLINED",
  "SUSPENDED",
] as const;

export const marketplaceListingStatusValues = marketplaceHostStatusValues;

export const marketplaceHostProfileSchema = z.object({
  providerType: z.enum(["INDIVIDUAL", "BUSINESS"]),
  displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1500).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().max(100).optional().or(z.literal("")),
});

export const marketplaceListingSchema = z.object({
  vehicleId: z.string().trim().min(1).max(100),
  headline: z.string().trim().min(5).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export function canEditMarketplaceStatus(status: string) {
  return status === "DRAFT" || status === "NEEDS_INFORMATION" || status === "DECLINED";
}

export function canSubmitMarketplaceListing(hostStatus: string) {
  return ["SUBMITTED", "IN_REVIEW", "PREQUALIFIED"].includes(hostStatus);
}

export function isMarketplaceReviewStatus(status: string) {
  return ["IN_REVIEW", "NEEDS_INFORMATION", "PREQUALIFIED", "DECLINED", "SUSPENDED"].includes(status);
}
