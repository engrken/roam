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
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

    const partsAt = (instant: number) => {
      const parts = formatter.formatToParts(new Date(instant));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return {
        year: Number(values.year), month: Number(values.month), day: Number(values.day),
        hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second),
      };
    };

    let instant = wallClockEpoch;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const local = partsAt(instant);
      const representedEpoch = Date.UTC(
        local.year, local.month - 1, local.day, local.hour, local.minute, local.second,
      );
      instant = wallClockEpoch - (representedEpoch - instant);
    }

    const resolved = partsAt(instant);
    if (
      resolved.year !== desired.year || resolved.month !== desired.month ||
      resolved.day !== desired.day || resolved.hour !== desired.hour ||
      resolved.minute !== desired.minute || resolved.second !== desired.second
    ) return null;

    return new Date(instant);
  } catch {
    return null;
  }
}
