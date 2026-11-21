import test from "node:test";
import assert from "node:assert/strict";
import {
  marketplaceQuoteSchema,
  marketplaceQuoteApprovalSchema,
  marketplaceQuoteTotals,
} from "../src/lib/marketplace-operations.ts";

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
