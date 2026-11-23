CREATE TABLE "WebPushSubscription" (
  "id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "tenantId" TEXT,
  "bookingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");
CREATE INDEX "WebPushSubscription_tenantId_idx" ON "WebPushSubscription"("tenantId");
CREATE INDEX "WebPushSubscription_bookingId_idx" ON "WebPushSubscription"("bookingId");
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
