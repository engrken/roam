CREATE TYPE "MarketplaceHostStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFORMATION', 'PREQUALIFIED', 'DECLINED', 'SUSPENDED');
CREATE TYPE "MarketplaceListingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEEDS_INFORMATION', 'PREQUALIFIED', 'DECLINED', 'SUSPENDED');

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_id_tenantId_key" UNIQUE ("id", "tenantId");

CREATE TABLE "MarketplaceHostProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "providerType" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "city" TEXT NOT NULL,
  "province" TEXT,
  "status" "MarketplaceHostStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "internalNotes" TEXT,
  "hostMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceHostProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceListing" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "hostProfileId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "headline" TEXT NOT NULL,
  "description" TEXT,
  "status" "MarketplaceListingStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "internalNotes" TEXT,
  "hostMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceHostProfile_tenantId_key" ON "MarketplaceHostProfile"("tenantId");
CREATE UNIQUE INDEX "MarketplaceHostProfile_id_tenantId_key" ON "MarketplaceHostProfile"("id", "tenantId");
CREATE INDEX "MarketplaceHostProfile_status_submittedAt_idx" ON "MarketplaceHostProfile"("status", "submittedAt");

CREATE UNIQUE INDEX "MarketplaceListing_vehicleId_key" ON "MarketplaceListing"("vehicleId");
CREATE INDEX "MarketplaceListing_tenantId_status_createdAt_idx" ON "MarketplaceListing"("tenantId", "status", "createdAt");
CREATE INDEX "MarketplaceListing_status_submittedAt_idx" ON "MarketplaceListing"("status", "submittedAt");

ALTER TABLE "MarketplaceHostProfile"
  ADD CONSTRAINT "MarketplaceHostProfile_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketplaceListing"
  ADD CONSTRAINT "MarketplaceListing_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MarketplaceListing_hostProfileId_tenantId_fkey"
  FOREIGN KEY ("hostProfileId", "tenantId") REFERENCES "MarketplaceHostProfile"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MarketplaceListing_vehicleId_tenantId_fkey"
  FOREIGN KEY ("vehicleId", "tenantId") REFERENCES "Vehicle"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
