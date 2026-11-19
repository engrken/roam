CREATE TABLE "BillingRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingRecord_reference_key" ON "BillingRecord"("reference");
CREATE INDEX "BillingRecord_tenantId_issuedAt_idx" ON "BillingRecord"("tenantId", "issuedAt");
CREATE INDEX "BillingRecord_tenantId_status_idx" ON "BillingRecord"("tenantId", "status");
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubscriptionChangeRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requestedTier" "SubscriptionTier" NOT NULL,
  "currentTier" "SubscriptionTier" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubscriptionChangeRequest_tenantId_createdAt_idx" ON "SubscriptionChangeRequest"("tenantId", "createdAt");
CREATE INDEX "SubscriptionChangeRequest_status_createdAt_idx" ON "SubscriptionChangeRequest"("status", "createdAt");
ALTER TABLE "SubscriptionChangeRequest" ADD CONSTRAINT "SubscriptionChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
