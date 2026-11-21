import test from "node:test";
import assert from "node:assert/strict";
import {
  isMarketplaceInquiryStatus,
  marketplaceAvailabilityBlockSchema,
  marketplaceAvailabilityRange,
  marketplaceDateRange,
  marketplaceInquirySchema,
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

test("date ranges use Manila midnight and include the selected return date", () => {
  const range = marketplaceDateRange("2027-01-10", "2027-01-12");
  assert.ok(range);
  assert.equal(range.nights, 2);
  assert.equal(range.startAt.toISOString(), "2027-01-09T16:00:00.000Z");
  assert.equal(range.endAt.toISOString(), "2027-01-11T16:00:00.000Z");
});

test("date ranges reject invalid calendar dates and spans longer than 30 days", () => {
  assert.equal(marketplaceDateRange("2027-02-30", "2027-03-01"), null);
  assert.equal(marketplaceDateRange("2027-01-01", "2027-01-31"), null);
  assert.equal(marketplaceDateRange("2027-01-10", "2027-01-10"), null);
  assert.equal(marketplaceAvailabilityRange("2027-01-10", "2027-01-10")?.nights, 1);
  assert.equal(marketplaceDateRange("2027-01-12", "2027-01-10"), null);
});

test("host inquiry workflow only accepts terminal follow-up statuses", () => {
  assert.equal(isMarketplaceInquiryStatus("CONTACTED"), true);
  assert.equal(isMarketplaceInquiryStatus("DECLINED"), true);
  assert.equal(isMarketplaceInquiryStatus("CLOSED"), true);
  assert.equal(isMarketplaceInquiryStatus("NEW"), false);
  assert.equal(isMarketplaceInquiryStatus("CONFIRMED"), false);
});
