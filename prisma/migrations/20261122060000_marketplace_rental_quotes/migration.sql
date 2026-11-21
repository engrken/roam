CREATE TABLE "MarketplaceRentalQuote" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "inquiryId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currency" VARCHAR(3) NOT NULL DEFAULT 'PHP',
  "dailyRate" DECIMAL(12,2) NOT NULL,
  "rentalDays" INTEGER NOT NULL,
  "baseAmount" DECIMAL(12,2) NOT NULL,
  "addOns" JSONB NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL,
  "fees" JSONB NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "snapshot" JSONB NOT NULL,
  "agreementReference" VARCHAR(160),
  "agreementReviewedAt" TIMESTAMP(3),
  "agreementReviewedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceRentalQuote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceBookingInquiry_id_tenantId_key" ON "MarketplaceBookingInquiry"("id", "tenantId");
CREATE UNIQUE INDEX "MarketplaceRentalQuote_inquiryId_tenantId_version_key" ON "MarketplaceRentalQuote"("inquiryId", "tenantId", "version");
CREATE UNIQUE INDEX "MarketplaceRentalQuote_id_tenantId_key" ON "MarketplaceRentalQuote"("id", "tenantId");
CREATE INDEX "MarketplaceRentalQuote_tenantId_status_createdAt_idx" ON "MarketplaceRentalQuote"("tenantId", "status", "createdAt");

ALTER TABLE "MarketplaceRentalQuote"
  ADD CONSTRAINT "MarketplaceRentalQuote_inquiryId_tenantId_fkey"
  FOREIGN KEY ("inquiryId", "tenantId") REFERENCES "MarketplaceBookingInquiry"("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceRentalQuote"
  ADD CONSTRAINT "MarketplaceRentalQuote_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
