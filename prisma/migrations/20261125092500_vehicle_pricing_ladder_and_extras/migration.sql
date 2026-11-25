ALTER TABLE "Vehicle"
  ADD COLUMN "hourlyRate" DECIMAL(12,2),
  ADD COLUMN "weeklyRate" DECIMAL(12,2),
  ADD COLUMN "monthlyRate" DECIMAL(12,2),
  ADD COLUMN "withDriverHourlyRate" DECIMAL(12,2),
  ADD COLUMN "withDriverWeeklyRate" DECIMAL(12,2),
  ADD COLUMN "withDriverMonthlyRate" DECIMAL(12,2),
  ADD COLUMN "deliveryAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "includedKmPerDay" INTEGER,
  ADD COLUMN "excessMileageRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "overtimeGraceMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overtimeHourlyRate" DECIMAL(12,2),
  ADD COLUMN "withDriverOvertimeHourlyRate" DECIMAL(12,2);

ALTER TABLE "BookingItem"
  ADD COLUMN "rateUnit" VARCHAR(10) NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "ratePeriods" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "deliveryRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryAddress" TEXT,
  ADD COLUMN "deliveryFeeSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "includedKmPerDaySnapshot" INTEGER,
  ADD COLUMN "excessMileageRateSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "overtimeGraceMinutesSnapshot" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overtimeHourlyRateSnapshot" DECIMAL(12,2);

UPDATE "BookingItem" AS item
SET "ratePeriods" = GREATEST(1, CEIL(EXTRACT(EPOCH FROM (booking."endAt" - booking."startAt")) / 86400)::INTEGER)
FROM "Booking" AS booking
WHERE item."bookingId" = booking."id";

ALTER TABLE "MarketplaceBookingInquiry"
  ADD COLUMN "rateUnit" VARCHAR(10) NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "ratePeriods" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "deliveryRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryAddress" TEXT,
  ADD COLUMN "deliveryFeeSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "securityDepositSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "includedKmPerDaySnapshot" INTEGER,
  ADD COLUMN "excessMileageRateSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "overtimeGraceMinutesSnapshot" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "overtimeHourlyRateSnapshot" DECIMAL(12,2);

UPDATE "MarketplaceBookingInquiry"
SET "ratePeriods" = GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("endAt" - "startAt")) / 86400)::INTEGER);

ALTER TABLE "MarketplaceRentalQuote"
  ADD COLUMN "rateUnit" VARCHAR(10) NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "securityDeposit" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "Booking"
  ADD COLUMN "returnChargesAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "returnChargesBreakdown" JSONB,
  ADD COLUMN "returnChargesCalculatedAt" TIMESTAMP(3);
