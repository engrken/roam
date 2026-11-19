ALTER TABLE "Tenant" ADD COLUMN "referralCode" TEXT;
UPDATE "Tenant" SET "referralCode" = upper(substr(md5("id" || clock_timestamp()::text), 1, 12)) WHERE "referralCode" IS NULL;
ALTER TABLE "Tenant" ALTER COLUMN "referralCode" SET NOT NULL;
CREATE UNIQUE INDEX "Tenant_referralCode_key" ON "Tenant"("referralCode");

ALTER TABLE "User" ADD COLUMN "referredByTenantId" TEXT;
CREATE INDEX "User_referredByTenantId_idx" ON "User"("referredByTenantId");
ALTER TABLE "User" ADD CONSTRAINT "User_referredByTenantId_fkey"
  FOREIGN KEY ("referredByTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailOtp" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "referralCreditMonths" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Referral" (
  "id" TEXT NOT NULL,
  "referrerTenantId" TEXT NOT NULL,
  "referredTenantId" TEXT NOT NULL,
  "referredOwnerUserId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "registeredAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "qualifiedAt" TIMESTAMP(3),
  "rewardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Referral_referredTenantId_key" ON "Referral"("referredTenantId");
CREATE UNIQUE INDEX "Referral_referredOwnerUserId_key" ON "Referral"("referredOwnerUserId");
CREATE INDEX "Referral_referrerTenantId_status_createdAt_idx" ON "Referral"("referrerTenantId","status","createdAt");
CREATE INDEX "Referral_status_expiresAt_idx" ON "Referral"("status","expiresAt");
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerTenantId_fkey"
  FOREIGN KEY ("referrerTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredTenantId_fkey"
  FOREIGN KEY ("referredTenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredOwnerUserId_fkey"
  FOREIGN KEY ("referredOwnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
