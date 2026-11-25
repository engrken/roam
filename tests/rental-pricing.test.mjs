import test from "node:test";
import assert from "node:assert/strict";
import {
  availableRentalRateUnits,
  calculateRentalPrice,
  calculateReturnCharges,
  rentalPeriodsForRange,
  rentalRateForMode,
} from "../src/lib/rental-pricing.ts";

test("rental periods round up partial hourly, daily, weekly, and monthly units", () => {
  const start = new Date("2026-11-25T00:00:00.000Z");
  assert.equal(rentalPeriodsForRange(start, new Date(start.getTime() + 1), "HOURLY"), 1);
  assert.equal(rentalPeriodsForRange(start, new Date(start.getTime() + 25 * 60 * 60 * 1000), "DAILY"), 2);
  assert.equal(rentalPeriodsForRange(start, new Date(start.getTime() + 8 * 24 * 60 * 60 * 1000), "WEEKLY"), 2);
  assert.equal(rentalPeriodsForRange(start, new Date(start.getTime() + 31 * 24 * 60 * 60 * 1000), "MONTHLY"), 2);
});

test("rate lookup isolates self-drive and with-driver schedules", () => {
  const vehicle = { dailyRate: 2500, hourlyRate: 250, weeklyRate: 15000, monthlyRate: 50000,
    withDriverDailyRate: 3500, withDriverHourlyRate: 400, withDriverWeeklyRate: null, withDriverMonthlyRate: null };
  assert.equal(rentalRateForMode(vehicle, "SELF_DRIVE", "WEEKLY"), 15000);
  assert.equal(rentalRateForMode(vehicle, "WITH_DRIVER", "HOURLY"), 400);
  assert.equal(rentalRateForMode(vehicle, "WITH_DRIVER", "WEEKLY"), null);
  assert.deepEqual(availableRentalRateUnits(vehicle, "WITH_DRIVER"), ["HOURLY", "DAILY"]);
});

test("rental totals use cents and reject invalid ranges or amounts", () => {
  assert.deepEqual(calculateRentalPrice({
    startAt: "2026-11-25T09:00:00+08:00",
    endAt: "2026-11-26T10:00:00+08:00",
    rate: 2500.25,
    rateUnit: "DAILY",
  }), { periods: 2, amount: "5000.50" });
  assert.equal(calculateRentalPrice({ startAt: "2026-11-26", endAt: "2026-11-25", rate: 500, rateUnit: "HOURLY" }), null);
});

test("return settlement calculates excess mileage and grace-adjusted overtime", () => {
  const result = calculateReturnCharges({
    vehicleId: "vehicle-1",
    handoverOdometerKm: 1000,
    returnOdometerKm: 1450,
    startAt: "2026-11-20T09:00:00+08:00",
    endAt: "2026-11-22T09:00:00+08:00",
    returnedAt: "2026-11-22T10:31:00+08:00",
    includedKmPerDay: 200,
    excessMileageRate: 12.5,
    overtimeGraceMinutes: 30,
    overtimeHourlyRate: 300,
  });
  assert.deepEqual(result, {
    vehicleId: "vehicle-1",
    actualKm: 450,
    includedKm: 400,
    excessKm: 50,
    excessMileageCharge: "625.00",
    overtimeMinutes: 61,
    overtimeHours: 2,
    overtimeCharge: "600.00",
    totalCharge: "1225.00",
  });
});

test("return settlement rejects an odometer rollback", () => {
  const result = calculateReturnCharges({
    vehicleId: "vehicle-1",
    handoverOdometerKm: 1000,
    returnOdometerKm: 900,
    startAt: "2026-11-20T09:00:00+08:00",
    endAt: "2026-11-22T09:00:00+08:00",
    returnedAt: "2026-11-22T09:00:00+08:00",
    includedKmPerDay: 200,
    excessMileageRate: 12.5,
    overtimeGraceMinutes: 30,
    overtimeHourlyRate: 300,
  });
  assert.equal(result, null);
});
