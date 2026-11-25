export const rentalRateUnits = ["HOURLY", "DAILY", "WEEKLY", "MONTHLY"] as const;
export type RentalRateUnit = (typeof rentalRateUnits)[number];
export type RentalMode = "SELF_DRIVE" | "WITH_DRIVER";

const hoursPerRateUnit: Record<RentalRateUnit, number> = {
  HOURLY: 1,
  DAILY: 24,
  WEEKLY: 24 * 7,
  MONTHLY: 24 * 30,
};

const unitLabels: Record<RentalRateUnit, string> = {
  HOURLY: "hour",
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
};

export function isRentalRateUnit(value: unknown): value is RentalRateUnit {
  return typeof value === "string" && rentalRateUnits.includes(value as RentalRateUnit);
}

export function rentalRateUnitLabel(unit: RentalRateUnit): string {
  return unitLabels[unit];
}

export function rentalPeriodsForRange(startAt: Date | string, endAt: Date | string, unit: RentalRateUnit): number | null {
  const start = startAt instanceof Date ? startAt.getTime() : new Date(startAt).getTime();
  const end = endAt instanceof Date ? endAt.getTime() : new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const hours = (end - start) / 3_600_000;
  const periods = Math.max(1, Math.ceil(hours / hoursPerRateUnit[unit]));
  return Number.isSafeInteger(periods) && periods <= 8_760 ? periods : null;
}

export function rentalRateForMode(
  vehicle: Record<string, unknown>,
  mode: RentalMode,
  unit: RentalRateUnit,
): number | null {
  const prefix = mode === "WITH_DRIVER" ? "withDriver" : "";
  const suffix = unit[0] + unit.slice(1).toLowerCase() + "Rate";
  const field = unit === "DAILY"
    ? (mode === "WITH_DRIVER" ? "withDriverDailyRate" : "dailyRate")
    : prefix + suffix;
  const raw = vehicle[field];
  if (raw === null || raw === undefined) return null;
  const rate = Number(raw);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
}

export function availableRentalRateUnits(vehicle: Record<string, unknown>, mode: RentalMode): RentalRateUnit[] {
  return rentalRateUnits.filter((unit) => rentalRateForMode(vehicle, mode, unit) !== null);
}

export function rentalAmountCents(rate: number, periods: number): number | null {
  if (!Number.isFinite(rate) || rate < 0 || !Number.isSafeInteger(periods) || periods < 1) return null;
  const cents = Math.round(rate * 100) * periods;
  return Number.isSafeInteger(cents) && cents <= 100_000_000_000 ? cents : null;
}

export function calculateRentalPrice(input: {
  startAt: Date | string;
  endAt: Date | string;
  rate: number;
  rateUnit: RentalRateUnit;
}) {
  const periods = rentalPeriodsForRange(input.startAt, input.endAt, input.rateUnit);
  if (periods === null) return null;
  const amountCents = rentalAmountCents(input.rate, periods);
  if (amountCents === null) return null;
  return { periods, amount: (amountCents / 100).toFixed(2) };
}

export type ReturnChargeBreakdown = {
  vehicleId: string;
  actualKm: number;
  includedKm: number | null;
  excessKm: number;
  excessMileageCharge: string;
  overtimeMinutes: number;
  overtimeHours: number;
  overtimeCharge: string;
  totalCharge: string;
};

export function calculateReturnCharges(input: {
  vehicleId: string;
  handoverOdometerKm: number;
  returnOdometerKm: number;
  startAt: Date | string;
  endAt: Date | string;
  returnedAt: Date | string;
  includedKmPerDay: number | null;
  excessMileageRate: number;
  overtimeGraceMinutes: number;
  overtimeHourlyRate: number | null;
}): ReturnChargeBreakdown | null {
  const start = input.startAt instanceof Date ? input.startAt.getTime() : new Date(input.startAt).getTime();
  const end = input.endAt instanceof Date ? input.endAt.getTime() : new Date(input.endAt).getTime();
  const returned = input.returnedAt instanceof Date ? input.returnedAt.getTime() : new Date(input.returnedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(returned) || end <= start
    || !Number.isSafeInteger(input.handoverOdometerKm) || !Number.isSafeInteger(input.returnOdometerKm)
    || input.handoverOdometerKm < 0 || input.returnOdometerKm < input.handoverOdometerKm
    || !Number.isFinite(input.excessMileageRate) || input.excessMileageRate < 0
    || !Number.isSafeInteger(input.overtimeGraceMinutes) || input.overtimeGraceMinutes < 0
    || (input.includedKmPerDay !== null && (!Number.isSafeInteger(input.includedKmPerDay) || input.includedKmPerDay < 0))
    || (input.overtimeHourlyRate !== null && (!Number.isFinite(input.overtimeHourlyRate) || input.overtimeHourlyRate < 0))) return null;

  const actualKm = input.returnOdometerKm - input.handoverOdometerKm;
  const rentalDays = Math.max(1, Math.ceil((end - start) / 86_400_000));
  const includedKm = input.includedKmPerDay === null ? null : input.includedKmPerDay * rentalDays;
  const excessKm = includedKm === null ? 0 : Math.max(0, actualKm - includedKm);
  const mileageCents = Math.round(input.excessMileageRate * 100) * excessKm;

  const overtimeMs = Math.max(0, returned - end - input.overtimeGraceMinutes * 60_000);
  const overtimeMinutes = Math.ceil(overtimeMs / 60_000);
  const overtimeHours = input.overtimeHourlyRate === null || overtimeMinutes === 0
    ? 0 : Math.ceil(overtimeMinutes / 60);
  const overtimeCents = input.overtimeHourlyRate === null
    ? 0 : Math.round(input.overtimeHourlyRate * 100) * overtimeHours;
  const totalCents = mileageCents + overtimeCents;
  if (![mileageCents, overtimeCents, totalCents].every(Number.isSafeInteger) || totalCents < 0 || totalCents > 100_000_000_000) return null;

  return {
    vehicleId: input.vehicleId,
    actualKm,
    includedKm,
    excessKm,
    excessMileageCharge: (mileageCents / 100).toFixed(2),
    overtimeMinutes,
    overtimeHours,
    overtimeCharge: (overtimeCents / 100).toFixed(2),
    totalCharge: (totalCents / 100).toFixed(2),
  };
}
