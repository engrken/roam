import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyPayMongoSignature } from "../src/lib/paymongo-signature.ts";

const secret = "webhook-test-secret";
const now = 1_800_000_000_000;
const timestamp = String(Math.floor(now / 1000));
const body = JSON.stringify({ data: { id: "evt_test", attributes: { type: "payment.paid" } } });
const signature = createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");

test("accepts a valid test-mode PayMongo signature", () => {
  assert.equal(verifyPayMongoSignature(body, `t=${timestamp},te=${signature},li=`, secret, false, now), true);
});

test("accepts a valid live-mode PayMongo signature", () => {
  assert.equal(verifyPayMongoSignature(body, `t=${timestamp},te=,li=${signature}`, secret, true, now), true);
});

test("rejects a modified webhook body", () => {
  assert.equal(verifyPayMongoSignature(body + " ", `t=${timestamp},te=${signature},li=`, secret, false, now), false);
});

test("rejects a stale webhook timestamp", () => {
  assert.equal(verifyPayMongoSignature(body, `t=${timestamp},te=${signature},li=`, secret, false, now + 301_000), false);
});

test("rejects a missing signature", () => {
  assert.equal(verifyPayMongoSignature(body, "", secret, false, now), false);
});
