/**
 * Convert a wall-clock date/time entered for a rental business into a UTC Date.
 * Values with an explicit Z/offset are already instants and are parsed directly.
 * Values from datetime-local inputs are interpreted in the tenant's timezone.
 */
export function rentalDateTimeToUtc(value: unknown, timeZone: string): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const input = value.trim();
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(input)) {
    const parsed = new Date(input);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0"] = match;
  const desired = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText),
  };
  const wallClockEpoch = Date.UTC(
    desired.year, desired.month - 1, desired.day,
    desired.hour, desired.minute, desired.second,
  );

  const check = new Date(wallClockEpoch);
  if (
    check.getUTCFullYear() !== desired.year ||
    check.getUTCMonth() + 1 !== desired.month ||
    check.getUTCDate() !== desired.day ||
    desired.hour > 23 || desired.minute > 59 || desired.second > 59
  ) return null;

  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric"¶»§q«^