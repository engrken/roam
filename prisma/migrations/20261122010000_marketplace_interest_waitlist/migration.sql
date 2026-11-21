CREATE TYPE "MarketplaceLeadType" AS ENUM ('HOST', 'RENTER');
CREATE TYPE "MarketplaceLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WAITLISTED', 'ARCHIVED');
CREATE TABLE "MarketplaceLead" (
  "id" TEXT NOT NULL,
  "type" "MarketplaceLeadType" NOT NULL,
  "status" "MarketplaceLeadStatus" NOT NULL DEFAULT 'NEW',
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "city" TEXT NOT NULL,
  "providerType" TEXT,
  "vehicleCategory" TEXT,
  "contactConsentAt" TIMESTAMP(3) NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceLead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MarketplaceLead_type_email_key" ON "MarketplaceLead"("type", "email");
CREATE INDEX "MarketplaceLead_type_status_createdAt_idx" ON "MarketplaceLead"("type", "status", "createdAt");
CREATE INDEX "MarketplaceLead_createdAt_idx" ON "MarketplaceLead"("createdAt");
