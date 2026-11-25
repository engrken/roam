import test from "node:test";
import assert from "node:assert/strict";
import { marketplaceDateRange } from "../src/lib/marketplace-operations.ts";

test("marketplace rental dates preserve Manila pickup and return times", () => {
  const range = marketplaceDateRange("2026-12-10", "2026-12-10", "09:30", "13:15");
  assert.ok(range);
  assert.equal(range.hours, 3.75);
  assert.equal(range.startAt.toISOString(), "2026-12-10T01:30:00.000Z");
  assert.equal(range.endAt.toISOString(), "2026-12-10T05:15:00.000Z");
});

test("marketplace rental dates reject non-positive, invalid, and over-30-day ranges", () => {
  assert.equal(marketplaceDateRange("2026-12-10", "2026-12-10", "14:00", "13:00"), null);
  assert.equal(marketplaceDateRange("2026-12-10", "2026-12-10", "25:00", "13:00"), null);
  assert.equal(marketplaceDateRange("2026-12-01", "2027-01-01", "09:00", "09:00"), null);
});
