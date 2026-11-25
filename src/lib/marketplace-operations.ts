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
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("09:00"),
  rentalMode: z.enum(["SELF_DRIVE", "WITH_DRIVER"]).default("SELF_DRIVE"),
  rateUnit: z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY"]).default("DAILY"),
  deliveryRequested: z.boolean().default(false),
  deliveryAddress: z.string().trim().max(300).optional().or(z.literal("")),
  message: z.string().trim().max(1500).optional().or(z.literal("")),
  contactConsent: z.literal(true),
}).refine((value) => value.startDate < value.endDate || (value.startDate === value.endDate && value.startTime < value.endTime), {
  message: "End date must be on or after start date.",
  path: ["endDate"],
});

export function marketplaceDateRange(startDate: string, endDate: string, startTime = "00:00", endTime = "00:00") {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!datePattern.test(startDate) || !datePattern.test(endDate) || !timePattern.test(startTime) || !timePattern.test(endTime)) return null;
  const startCheck = new Date(`${startDate}T00:00:00.000Z`);
  const endCheck = new Date(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(startCheck.getTime()) || !Number.isFinite(endCheck.getTime())) return null;
  if (startCheck.toISOString().slice(0, 10) !== startDate || endCheck.toISOString().slice(0, 10) !== endDate) return null;
  const startAt = new Date(`${startDate}T${startTime}:00+08:00`);
  const endAt = new Date(`${endDate}T${endTime}:00+08:00`);
  const durationMs = endAt.getTime() - startAt.getTime();
  const hours = durationMs / 3_600_000;
  const nights = Math.max(1, Math.ceil(hours / 24));
  if (!Number.isFinite(hours) || hours <= 0 || hours > 30 * 24) return null;
  return { startAt, endAt, nights, hours };
}

export function marketplaceAvailabilityRange(startDate: string, inclusiveEndDate: string) {
  const startCheck = new Date(`${startDate}T00:00:00.000Z`);
  const endCheck = new Date(`${inclusiveEndDate}T00:00:00.000Z`);
  if (!Number.isFinite(startCheck.getTime()) || !Number.isFinite(endCheck.getTime())) return null;
  if (startCheck.toISOString().slice(0, 10) !== startDate || endCheck.toISOString().slice(0, 10) !== inclusiveEndDate || inclusiveEndDate < startDate) return null;
  endCheck.setUTCDate(endCheck.getUTCDate() + 1);
  return marketplaceDateRange(startDate, endCheck.toISOString().slice(0, 10), "00:00", "00:00");
}

export type MarketplaceInquiryStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "READY_FOR_MANUAL_BOOKING"
  | "DECLINED"
  | "CLOSED";

const marketplaceInquiryTransitions: Record<MarketplaceInquiryStatus, MarketplaceInquiryStatus[]> = {
  NEW: ["CONTACTED", "QUALIFIED", "DECLINED", "CLOSED"],
  CONTACTED: ["QUALIFIED", "DECLINED", "CLOSED"],
  QUALIFIED: ["CONTACTED", "READY_FOR_MANUAL_BOOKING", "DECLINED", "CLOSED"],
  READY_FOR_MANUAL_BOOKING: ["DECLINED", "CLOSED"],
  DECLINED: ["CLOSED"],
  CLOSED: [],
};

export function isMarketplaceInquiryStatus(status: string): status is MarketplaceInquiryStatus {
  return Object.prototype.hasOwnProperty.call(marketplaceInquiryTransitions, status);
}

export function canTransitionMarketplaceInquiryStatus(from: string, to: string) {
  if (!isMarketplaceInquiryStatus(from) || !isMarketplaceInquiryStatus(to)) return false;
  return from === to || marketplaceInquiryTransitions[from].includes(to);
}


export const marketplaceHandoffChecksSchema = z.object({
  availabilityRechecked: z.literal(true),
  finalPriceAndFeesReviewed: z.literal(true),
  pickupAndReturnConfirmed: z.literal(true),
  renterRequirementsReviewed: z.literal(true),
  rentalTermsReviewed: z.literal(true),
});


export const marketplaceQuoteLineItemSchema = z.object({
  label: z.string().trim().min(1).max(100),
  amount: z.number().finite().min(0).max(1_000_000),
});

export const marketplaceQuoteSchema = z.object({
  inquiryId: z.string().trim().min(1).max(100),
  dailyRate: z.number().finite().min(0).max(1_000_000),
  addOns: z.array(marketplaceQuoteLineItemSchema).max(12),
  discountAmount: z.number().finite().min(0).max(1_000_000),
  fees: z.array(marketplaceQuoteLineItemSchema).max(12),
  validUntil: dateOnly,
});

export const marketplaceQuoteApprovalSchema = z.object({
  quoteId: z.string().trim().min(1).max(100),
  agreementReference: z.string().trim().min(1).max(160),
  agreementReviewed: z.literal(true),
});

export function marketplaceQuoteTotals(input: {
  dailyRate: number;
  rentalDays: number;
  addOns: Array<{ amount: number }>;
  discountAmount: number;
  fees: Array<{ amount: number }>;
}) {
  const cents = (value: number) => Math.round(value * 100);
  const baseCents = cents(input.dailyRate) * input.rentalDays;
  const addOnCents = input.addOns.reduce((sum, item) => sum + cents(item.amount), 0);
  const feeCents = input.fees.reduce((sum, item) => sum + cents(item.amount), 0);
  const discountCents = cents(input.discountAmount);
  const totalCents = baseCents + addOnCents + feeCents - discountCents;
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || totalCents > 100_000_000_000) return null;
  return {
    baseAmount: (baseCents / 100).toFixed(2),
    discountAmount: (discountCents / 100).toFixed(2),
    totalAmount: (totalCents / 100).toFixed(2),
  };
}
