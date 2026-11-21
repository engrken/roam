CREATE TABLE "MarketplaceAvailabilityBlock" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "label" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceAvailabilityBlock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceBookingInquiry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "requesterName" VARCHAR(120) NOT NULL,
  "requesterEmail" VARCHAR(254) NOT NULL,
  "requesterPhone" VARCHAR(40),
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "dailyRateSnapshot" DECIMAL(12,2) NOT NULL,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "hostNote" TEXT,
  "contactConsentAt" TIMESTAMP(3) NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceBookingInquiry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceListing_id_tenantId_key" ON "MarketplaceListing"("id", "tenantId");

CREATE INDEX "MarketplaceAvailabilityBlock_tenantId_startAt_endAt_idx" ON "MarketplaceAvailabilityBlock"("tenantId", "startAt", "endAt");
CREATE INDEX "MarketplaceAvailabilityBlock_listingId_startAt_endAt_idx" ON "MarketplaceAvailabilityBlock"("listingId", "startAt", "endAt");
CREATE INDEX "MarketplaceBookingInquiry_tenantId_status_createdAt_idx" ON "MarketplaceBookingInquiry"("tenantId", "status", "createdAt");
CREATE INDEX "MarketplaceBookingInquiry_listingId_startAt_endAt_idx" ON "MarketplaceBookingInquiry"("listingId", "startAt", "endAt");
CREATE INDEX "MarketplaceBookingInquiry_listingId_requesterEmail_createdAt_idx" ON "MarketplaceBookingInquiry"("listingId", "requesterEmail", "createdAt");

ALTER TABLE "MarketplaceAvailabilityBlock" ADD CONSTRAINT "MarketplaceAvailabilityBlock_listingId_tenantId_fkey" FOREIGN KEY ("listingId", "tenantId") REFERENCES "MarketplaceListing"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceBookingInquiry" ADD CONSTRAINT "MarketplaceBookingInquiry_listingId_tenantId_fkey" FOREIGN KEY ("listingId", "tenantId") REFERENCES "MarketplaceListing"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
