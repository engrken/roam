CREATE TABLE "SubscriptionPaymentMethod" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "accountName" TEXT,
  "instructions" TEXT,
  "qrImageData" TEXT,
  "qrContentType" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPaymentMethod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPaymentMethod_key_key" ON "SubscriptionPaymentMethod"("key");

CREATE TABLE "SubscriptionPaymentSubmission" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "methodId" TEXT NOT NULL,
  "methodLabel" TEXT NOT NULL,
  "accountName" TEXT,
  "reference" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "receiptData" TEXT,
  "receiptContentType" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "provisionalUntil" TIMESTAMP(3) NOT NULL,
  "previousTenantStatus" "TenantStatus" NOT NULL,
  "previousSubscriptionStatus" TEXT NOT NULL,
  "previousCurrentPeriodStart" TIMESTAMP(3),
  "previousCurrentPeriodEnd" TIMESTAMP(3),
  "previousTrialEndsAt" TIMESTAMP(3),
  "previousTrialGraceEndsAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPaymentSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE IN¶»§q«^