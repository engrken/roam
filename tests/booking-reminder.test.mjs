import test from "node:test";
import assert from "node:assert/strict";
import {
  getBookingReminderNoticeKey,
  isWithinPickupReminderWindow,
} from "../src/lib/booking-reminder.ts";

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

test("pickup and return notices are keyed to the scheduled Manila date", () => {
  const scheduledFor = new Date("2026-11-24T18:00:00.000Z");
  assert.equal(
    getBookingReminderNoticeKey("PICKUP", "booking-1", scheduledFor, now, "Asia/Manila"),
    "PICKUP:booking-1:2026-11-25",
  );
  assert.equal(
    getBookingReminderNoticeKey("RETURN", "booking-1", scheduledFor, now, "Asia/Manila"),
    "RETURN:booking-1:2026-11-25",
  );
});

test("overdue reminders get one distinct key per tenant-local calendar day", () => {
  const endAt = new Date("2026-11-20T00:00:00.000Z");
  const dayOne = new Date("2026-11-24T15:59:00.000Z");
  const dayTwo = new Date("2026-11-24T16:01:00.000Z");

  assert.equal(
    getBookingReminderNoticeKey("OVERDUE", "booking-2", endAt, dayOne, "Asia/Manila"),
    "OVERDUE:booking-2:2026-11-24",
  );
  assert.equal(
    getBookingReminderNoticeKey("OVERDUE", "booking-2", endAt, dayTwo, "Asia/Manila"),
    "OVERDUE:booking-2:2026-11-25",
  );
});

test("an invalid tenant timezone falls back to Asia/Manila", () => {
  const scheduledFor = new Date("2026-11-24T18:00:00.000Z");
  assert.equal(
    getBookingReminderNoticeKey("PICKUP", "booking-3", scheduledFor, now, "Not/A-Timezone"),
    "PICKUP:booking-3:2026-11-25",
  );
});
