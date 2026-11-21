CREATE TYPE "MarketplaceHostEmailStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

CREATE TABLE "MarketplaceHostNotification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "emailStatus" "MarketplaceHostEmailStatus" NOT NULL DEFAULT 'PENDING',
  "emailSentAt" TIMESTAMP(3),
  "emailError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceHostNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketplaceHostNotification_tenantId_createdAt_idx" ON "MarketplaceHostNotification"("tenantId", "createdAt");
CREATE INDEX "MarketplaceHostNotification_emailStatus_createdAt_idx" ON "MarketplaceHostNotification"("emailStatus", "createdAt");
CREATE INDEX "MarketplaceHostNotification_targetType_targetId_createdAt_idx" ON "MarketplaceHostNotification"("targetType", "targetId", "createdAt");

ALTER TABLE "MarketplaceHostNotification"
  ADD CONSTRAINT "MarketplaceHostNotification_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
