import test from "node:test";
import assert from "node:assert/strict";
import { isWithinPickupReminderWindow } from "../src/lib/booking-reminder.ts";

const now = new Date("2026-11-20T00:00:00.000Z");

test("sends immediately for a confirmed pickup within 24 hours", () => {
  assert.equal(isWithinPickupReminderWindow(new Date("2026-11-20T12:00:00.000Z"), now), true);
});

test("does not send immediately for past pickups", () => {
  assert.equal(isWithinPickupReminderWindow(new Date("2026-11-19T23:59:59.000Z"), now), false);
});

test("does not send immediately at or beyond the 24-hour boundary", () => {
  assert.equal(isWithinPickupReminderWindow(new Date("2026-11-21T00:00:00.000Z"), now), false);
});
