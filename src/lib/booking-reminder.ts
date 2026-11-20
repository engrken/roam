const PICKUP_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinPickupReminderWindow(startAt: Date, now: Date) {
  return startAt.getTime() > now.getTime()
    && startAt.getTime() < now.getTime() + PICKUP_REMINDER_WINDOW_MS;
}
