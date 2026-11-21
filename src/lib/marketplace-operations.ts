import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const marketplaceAvailabilityBlockSchema = z.object({
  listingId: z.string().trim().min(1).max(100),
  startDate: dateOnly,
  endDate: dateOnly,
  label: z.string().trim().max(100).optional().or(z.literal("")),
}).refine((value) => value.startDate <= value.endDate, {
  message: "End date must be on or after start date.",
  path: ["endDate"],
});

export const marketplaceInquirySchema = z.object({
  listingId: z.string().trim().min(1).max(100),
  requesterName: z.string().trim().min(2).max(120),
  requesterEmail: z.string().trim().toLowerCase().email().max(254),
  requesterPhone: z.string().trim().max(40).optional().or(z.literal("")),
  startDate: dateOnly,
  endDate: dateOnly,
  message: z.string().trim().max(1500).optional().or(z.literal("")),
  contactConsent: z.literal(true),
}).refine((value) => value.startDate < value.endDate, {
  message: "End date must be on or after start date.",
  path: ["endDate"],
});

export function marketplaceDateRange(startDate: string, endDate: string) {
  const startCheck = new Date(`${startDate}T00:00:00.000Z`);
  const endCheck = new Date(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(startCheck.getTime()) || !Number.isFinite(endCheck.getTime())) return null;
  if (startCheck.toISOString().slice(0, 10) !== startDate || endCheck.toISOString().slice(0, 10) !== endDate) return null;
  const startAt = new Date(`${startDate}T00:00:00+08:00`);
  const endAt = new Date(`${endDate}T00:00:00+08:00`);
  const durationMs = endAt.getTime() - startAt.getTime();
  const nights = Math.round(durationMs / 86_400_000);
  if (nights < 1 || nights > 30) return null;
  return { startAt, endAt, nights };
}

export function marketplaceAvailabilityRange(startDate: string, inclusiveEndDate: string) {
  const startCheck = new Date(`${startDate}T00:00:00.000Z`);
  const endCheck = new Date(`${inclusiveEndDate}T00:00:00.000Z`);
  if (!Number.isFinite(startCheck.getTime()) || !Number.isFinite(endCheck.getTime())) return null;
  if (startCheck.toISOString().slice(0, 10) !== startDate || endCheck.toISOString().slice(0, 10) !== inclusiveEndDate || inclusiveEndDate < startDate) return null;
  endCheck.setUTCDate(endCheck.getUTCDate() + 1);
  return marketplaceDateRange(startDate, endCheck.toISOString().slice(0, 10));
}

export function isMarketplaceInquiryStatus(status: string) {
  return ["CONTACTED", "DECLINED", "CLOSED"].includes(status);
}
