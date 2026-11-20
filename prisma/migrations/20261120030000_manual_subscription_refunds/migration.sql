CREATE TABLE "SubscriptionRefund" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "billingRecordId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "method" TEXT NOT NULL,
  "reference" TEXT,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "recordedById" TEXT NOT NULL,
  "completedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionRefund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionRefund_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionRefund_billingRecordId_fkey" FOREIGN KEY ("billingRecordId") REFERENCES "BillingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SubscriptionRefund_tenantId_createdAt_idx" ON "SubscriptionRefund"("tenantId", "createdAt");
CREATE INDEX "SubscriptionRefund_status_createdAt_idx" ON "SubscriptionRefund"("status", "createdAt");
CREATE INDEX "SubscriptionRefund_billingRecordId_status_idx" ON "SubscriptionRefund"("billingRecordId", "status");
