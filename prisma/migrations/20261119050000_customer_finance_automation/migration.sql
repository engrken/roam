CREATE TABLE "RentalPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "method" TEXT NOT NULL DEFAULT 'CASH',
  "kind" TEXT NOT NULL DEFAULT 'PAYMENT',
  "reference" TEXT,
  "notes" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentalPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RentalPayment_tenantId_receivedAt_idx" ON "RentalPayment"("tenantId", "receivedAt");
CREATE INDEX "RentalPayment_bookingId_receivedAt_idx" ON "RentalPayment"("bookingId", "receivedAt");
ALTER TABLE "RentalPayment" ADD CONSTRAINT "RentalPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalPayment" ADD CONSTRAINT "RentalPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BookingAutomationNotice" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "noticeKey" TEXT NOT NULL,
  "noticeType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingAutomationNotice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingAutomationNotice_noticeKey_key" ON "BookingAutomationNotice"("noticeKey");
CREATE INDEX "BookingAutomationNotice_status_scheduledFor_idx" ON "BookingAutomationNotice"("status", "scheduledFor");
ALTER TABLE "BookingAutomationNotice" ADD CONSTRAINT "BookingAutomationNotice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
