import test from "node:test";
import assert from "node:assert/strict";
import { rentalDateTimeToUtc } from "../src/lib/datetime.ts";

test("interprets Manila wall-clock times in the tenant timezone", () => {
  const value = rentalDateTimeToUtc("2026-11-20T09:30", "Asia/Manila");
  assert.equal(value?.toISOString(), "2026-11-20T01:30:00.000Z");
});

test("rejects invalid calendar dates", () => {
  assert.equal(rentalDateTimeToUtc("2026-02-30T09:30", "Asia/Manila"), null);
});

test("rejects nonexistent local times during daylight-saving transitions", () => {
  assert.equal(rentalDateTimeToUtc("2026-03-08T02:30", "America/New_York"), null);
});

test("preserves explicit UTC instants", () => {
  assert.equal(rentalDateTimeToUtc("2026-11-20T01:30:00.000Z", "Asia/Manila")?.toISOString(), "2026-11-20T01:30:00.000Z");
});
