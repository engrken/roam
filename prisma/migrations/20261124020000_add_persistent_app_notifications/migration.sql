CREATE TYPE "AppNotificationAudience" AS ENUM ('TENANT', 'CLIENT');

CREATE TABLE "AppNotification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT,
  "audience" "AppNotificationAudience" NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actionUrl" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedByUserId" TEXT,
  "acknowledgedByLabel" TEXT,
  CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppNotification_dedupeKey_key" ON "AppNotification"("dedupeKey");
CREATE INDEX "AppNotification_tenantId_audience_createdAt_idx" ON "AppNotification"("tenantId", "audience", "createdAt");
CREATE INDEX "AppNotification_tenantId_audience_acknowledgedAt_createdAt_idx" ON "AppNotification"("tenantId", "audience", "acknowledgedAt", "createdAt");
CREATE INDEX "AppNotification_bookingId_audience_createdAt_idx" ON "AppNotification"("bookingId", "audience", "createdAt");
CREATE INDEX "AppNotification_bookingId_audience_acknowledgedAt_createdAt_idx" ON "AppNotification"("bookingId", "audience", "acknowledgedAt", "createdAt");

ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
