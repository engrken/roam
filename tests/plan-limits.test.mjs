import test from "node:test";
import assert from "node:assert/strict";
import { isPlanLimitReached } from "../src/lib/plan-limits.ts";

test("unlimited plan limits do not block additions", () => {
  assert.equal(isPlanLimitReached(null, 100), false);
  assert.equal(isPlanLimitReached(undefined, 100), false);
});

test("a finite limit blocks when the current count reaches the limit", () => {
  assert.equal(isPlanLimitReached(3, 3), true);
  assert.equal(isPlanLimitReached(3, 4), true);
});

test("a finite limit permits additions below the limit", () => {
  assert.equal(isPlanLimitReached(3, 2), false);
});
