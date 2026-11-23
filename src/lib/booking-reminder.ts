const PICKUP_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export type BookingReminderType = "PICKUP" | "RETURN" | "OVERDUE";

export function isWithinPickupReminderWindow(startAt: Date, now: Date) {
  return startAt.getTime() > now.getTime()
    && startAt.getTime() < now.getTime() + PICKUP_REMINDER_WINDOW_MS;
}

function localDateKey(value: Date, timeZone: string) {
  const options: Intl.DateTimeFormatOptions = {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };

  try {
    const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(value);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    // A bad tenant timezone must not stop the daily reminder job.
    const parts = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "Asia/Manila" }).formatToParts(value);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
}

/**
 * Pickup and return reminders are sent once for the scheduled local date.
 * Overdue reminders recur once per tenant-local calendar day.
 */
export function getBookingReminderNoticeKey(
  type: BookingReminderType,
  bookingId: string,
  scheduledFor: Date,
  now: Date,
  timeZone: string,
) {
  const date = type === "OVERDUE" ? now : scheduledFor;
  return `${type}:${bookingId}:${localDateKey(date, timeZone || "Asia/Manila")}`;
}
