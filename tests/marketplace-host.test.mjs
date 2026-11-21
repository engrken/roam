import test from "node:test";
import assert from "node:assert/strict";
import {
  canEditMarketplaceStatus,
  canSubmitMarketplaceListing,
  isMarketplaceReviewStatus,
  marketplaceHostProfileSchema,
  marketplaceListingSchema,
} from "../src/lib/marketplace-host.ts";

const validHost = {
  providerType: "INDIVIDUAL",
  displayName: "Island Ride Rentals",
  description: "Local vehicle rental provider.",
  email: "host@example.com",
  phone: "+63 917 123 4567",
  city: "Cebu City",
  province: "Cebu",
};

test("marketplace Host profile accepts valid non-sensitive onboarding details", () => {
  assert.equal(marketplaceHostProfileSchema.safeParse(validHost).success, true);
});

test("marketplace Host profile normalizes the email address", () => {
  const parsed = marketplaceHostProfileSchema.parse({ ...validHost, email: " HOST@EXAMPLE.COM " });
  assert.equal(parsed.email, "host@example.com");
});

test("marketplace Host profile rejects invalid email, short names, and unknown provider types", () => {
  assert.equal(marketplaceHostProfileSchema.safeParse({ ...validHost, email: "not-an-email" }).success, false);
  assert.equal(marketplaceHostProfileSchema.safeParse({ ...validHost, displayName: "A" }).success, false);
  assert.equal(marketplaceHostProfileSchema.safeParse({ ...validHost, providerType: "UNREGISTERED" }).success, false);
});

test("marketplace listing requires a title and vehicle reference", () => {
  assert.equal(marketplaceListingSchema.safeParse({ vehicleId: "vehicle_1", headline: "A comfortable sedan" }).success, true);
  assert.equal(marketplaceListingSchema.safeParse({ vehicleId: "", headline: "A comfortable sedan" }).success, false);
  assert.equal(marketplaceListingSchema.safeParse({ vehicleId: "vehicle_1", headline: "Car" }).success, false);
});

test("Host can edit drafts, information requests, and declined submissions only", () => {
  assert.equal(canEditMarketplaceStatus("DRAFT"), true);
  assert.equal(canEditMarketplaceStatus("NEEDS_INFORMATION"), true);
  assert.equal(canEditMarketplaceStatus("DECLINED"), true);
  assert.equal(canEditMarketplaceStatus("SUBMITTED"), false);
  assert.equal(canEditMarketplaceStatus("IN_REVIEW"), false);
  assert.equal(canEditMarketplaceStatus("PREQUALIFIED"), false);
  assert.equal(canEditMarketplaceStatus("SUSPENDED"), false);
});

test("vehicle listings can be submitted only after the Host profile enters review", () => {
  assert.equal(canSubmitMarketplaceListing("DRAFT"), false);
  assert.equal(canSubmitMarketplaceListing("DECLINED"), false);
  assert.equal(canSubmitMarketplaceListing("SUSPENDED"), false);
  assert.equal(canSubmitMarketplaceListing("SUBMITTED"), true);
  assert.equal(canSubmitMarketplaceListing("IN_REVIEW"), true);
  assert.equal(canSubmitMarketplaceListing("NEEDS_INFORMATION"), true);
  assert.equal(canSubmitMarketplaceListing("PREQUALIFIED"), true);
});

test("admin review status helper excludes draft and submitted states", () => {
  assert.equal(isMarketplaceReviewStatus("PREQUALIFIED"), true);
  assert.equal(isMarketplaceReviewStatus("SUSPENDED"), true);
  assert.equal(isMarketplaceReviewStatus("DRAFT"), false);
  assert.equal(isMarketplaceReviewStatus("SUBMITTED"), false);
});
