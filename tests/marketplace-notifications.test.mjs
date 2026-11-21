import test from "node:test";
import assert from "node:assert/strict";
import {
  marketplaceHostReviewTitle,
  marketplaceHostReviewMessage,
} from "../src/lib/marketplace-notification-copy.ts";

test("Host notification titles identify both target and review status", () => {
  assert.equal(marketplaceHostReviewTitle("HOST_PROFILE", "NEEDS_INFORMATION"), "Host profile needs information");
  assert.equal(marketplaceHostReviewTitle("LISTING", "PREQUALIFIED"), "Vehicle listing prequalified");
});

test("information requests explain that the Host must update their submission", () => {
  const message = marketplaceHostReviewMessage("NEEDS_INFORMATION");
  assert.match(message, /needs more information/i);
  assert.match(message, /update your submission/i);
});

test("prequalification notice explicitly avoids promising verification or publication", () => {
  const message = marketplaceHostReviewMessage("PREQUALIFIED");
  assert.match(message, /not a certification/i);
  assert.match(message, /does not make a listing public/i);
});

test("a specific review message takes precedence over the default status message", () => {
  assert.equal(
    marketplaceHostReviewMessage("NEEDS_INFORMATION", "Please clarify the vehicle pickup area."),
    "Please clarify the vehicle pickup area.",
  );
});

test("blank Host messages fall back to a safe status explanation", () => {
  assert.match(marketplaceHostReviewMessage("DECLINED", "  "), /unable to proceed/i);
});
