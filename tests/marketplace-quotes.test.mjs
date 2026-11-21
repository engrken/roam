import test from "node:test";
import assert from "node:assert/strict";
import {
  isMarketplaceInquiryStatus,
  marketplaceAvailabilityBlockSchema,
  marketplaceAvailabilityRange,
  marketplaceDateRange,
  marketplaceInquirySchema,
  marketplaceHandoffChecksSchema,
  marketplaceQuoteSchema,
  marketplaceQuoteApprovalSchema,
  marketplaceQuoteTotals,
} from "../src/lib/marketplace-operations.ts";

const validInquiry = {
  listingId: "listing_1",
  requesterName: "Alex Renter",
  requesterEmail: " ALEX@EXAMPLE.COM ",
  requesterPhone: "+63 917 000 0000",
  startDate: "2027-01-10",
  endDate: "2027-01-12",
  message: "Is pickup available?",
  contactConsent: true,
};

test("availability blocks validate inclusive Manila-local date ranges", () => {
  assert.equal(marketplaceAvailabilityBlockSchema.safeParse({
    listingId: "listing_1", startDate: "2027-01-10", endDate: "2027-01-10",
  }).success, true);
  assert.equal(marketplaceAvailabilityBlockSchema.safeParse({
    listingId: "listing_1", startDate: "2027-01-12", endDate: "2027-01-10",
  }).success, false);
});

test("inquiry validation requires contact permission and normalizes email", () => {
  const parsed = marketplaceInquirySchema.parse(validInquiry);
  assert.equal(parsed.requesterEmail, "alex@example.com");
  assert.equal(marketplaceInquirySchema.safeParse({ ...validInquiry, contactConsent: false }).success, false);
  assert.equal(marketplaceInquirySchema.safeParse({ ...validInquiry, requesterEmail: "invalid" }).success, false);
});

test("date ranges use Manila midnight and exclude the return date", () => {
  const range = marketplaceDateRange("2027-01-10", "2027-01-12");
  assert.ok(range);
  assert.equal(range.nights, 2);
  assert.equal(range.startAt.toISOString(), "2027-01-09T16:00:00.000Z");
  assert.equal(range.endAt.toISOString(), "2027-01-11T16:00:00.000Z");
});

test("date ranges reject invalid calendar dates and spans longer than 30 days", () => {
  assert.equal(marketplaceDateRange("2027-02-30", "2027-03-01"), null);
  assert.equal(marketplaceDateRange("2027-01-01", "2027-02-01"), null);
  assert.equal(marketplaceDateRange("2027-01-10", "2027-01-10"), null);
  assert.equal(marketplaceAvailabilityRange("2027-01-10", "2027-01-10")?.nights, 1);
  assert.equal(marketplaceDateRange("2027-01-12", "2027-01-10"), null);
});

test("host inquiry workflow only accepts terminal follow-up statuses", () => {
  assert.equal(isMarketplaceInquiryStatus("CONTACTED"), true);
  assert.equal(isMarketplaceInquiryStatus("DECLINED"), true);
  assert.equal(isMarketplaceInquiryStatus("CLOSED"), true);
  assert.equal(isMarketplaceInquiryStatus("NEW"), true);
  assert.equal(isMarketplaceInquiryStatus("CONFIRMED"), false);
});


test("Marketplace inquiry handoff follows an explicit non-booking transition path", async () => {
  const { canTransitionMarketplaceInquiryStatus, isMarketplaceInquiryStatus } = await import("../src/lib/marketplace-operations.ts");
  assert.equal(isMarketplaceInquiryStatus("QUALIFIED"), true);
  assert.equal(isMarketplaceInquiryStatus("READY_FOR_MANUAL_BOOKING"), true);
  assert.equal(canTransitionMarketplaceInquiryStatus("NEW", "CONTACTED"), true);
  assert.equal(canTransitionMarketplaceInquiryStatus("CONTACTED", "QUALIFIED"), true);
  assert.equal(canTransitionMarketplaceInquiryStatus("QUALIFIED", "READY_FOR_MANUAL_BOOKING"), true);
  assert.equal(canTransitionMarketplaceInquiryStatus("NEW", "READY_FOR_MANUAL_BOOKING"), false);
  assert.equal(canTransitionMarketplaceInquiryStatus("CLOSED", "CONTACTED"), false);
  assert.equal(canTransitionMarketplaceInquiryStatus("NEW", "NEW"), true);
  assert.equal(canTransitionMarketplaceInquiryStatus("NEW", "CONFIRMED"), false);
});


test("manual booking readiness requires every operational check", () => {
  const complete = {
    availabilityRechecked: true,
    finalPriceAndFeesReviewed: true,
    pickupAndReturnConfirmed: true,
    renterRequirementsReviewed: true,
    rentalTermsReviewed: true,
  };
  assert.equal(marketplaceHandoffChecksSchema.safeParse(complete).success, true);
  assert.equal(marketplaceHandoffChecksSchema.safeParse({ ...complete, rentalTermsReviewed: false }).success, false);
  assert.equal(marketplaceHandoffChecksSchema.safeParse({ ...complete, availabilityRechecked: undefined }).success, false);
});


test("Marketplace quote drafts validate itemized charges and expiry", () => {
  const valid = {
    inquiryId: "inquiry_1", dailyRate: 1500, addOns: [{ label: "Delivery", amount: 500 }],
    discountAmount: 100, fees: [{ label: "Cleaning", amount: 200 }], validUntil: "2027-01-20",
  };
  assert.equal(marketplaceQuoteSchema.safeParse(valid).success, true);
  assert.equal(marketplaceQuoteSchema.safeParse({ ...valid, addOns: [{ label: "", amount: -1 }] }).success, false);
  assert.equal(marketplaceQuoteApprovalSchema.safeParse({ quoteId: "q1", agreementReference: "Renter Terms v1", agreementReviewed: true }).success, true);
  assert.equal(marketplaceQuoteApprovalSchema.safeParse({ quoteId: "q1", agreementReference: "", agreementReviewed: false }).success, false);
});

test("Marketplace quote totals use cent arithmetic and reject discounts beyond subtotal", () => {
  const totals = marketplaceQuoteTotals({
    dailyRate: 1500, rentalDays: 3, addOns: [{ amount: 250.25 }],
    discountAmount: 100.25, fees: [{ amount: 50 }],
  });
  assert.deepEqual(totals, { baseAmount: "4500.00", discountAmount: "100.25", totalAmount: "4700.00" });
  assert.equal(marketplaceQuoteTotals({ dailyRate: 100, rentalDays: 1, addOns: [], discountAmount: 101, fees: [] }), null);
});
