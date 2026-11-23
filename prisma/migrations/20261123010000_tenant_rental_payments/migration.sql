CREATE TABLE "TenantPaymentMethod" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "accountName" TEXT,
  "accountNumber" TEXT,
  "bankName" TEXT,
  "instructions" TEXT,
  "qrImageData" TEXT,
  "qrContentType" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantPaymentMethod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantPaymentMethod_tenantId_method_key" ON "TenantPaymentMethod"("tenantId","method");
CREATE INDEX "TenantPaymentMethod_tenantId_enabled_sortOrder_idx" ON "TenantPaymentMethod"("tenantId","enabled","sortOrder");
ALTER TABLE "TenantPaymentMethod" ADD CONSTRAINT "TenantPaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RentalPaymentSubmission" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "paymentMethodId" TEXT NOT NULL,
  "methodLabelSnapshot" TEXT NOT NULL,
  "accountNameSnapshot" TEXT,
  "accountNumberSnapshot" TEXT,
  "bankNameSnapshot" TEXT,
  "reference" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PHP',
  "paidAt" TIMESTAMP(3) NOT NULL,
  "proofPathname" TEXT,
  "customerNote" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "rentalPaymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalPaymentSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RentalPaymentSubmission_paymentMethodId_reference_key" ON "RentalPaymentSubmission"("paymentMethodId","reference");
CREATE UNIQUE INDEX "RentalPaymentSubmission_rentalPaymentId_key" ON "RentalPaymentSubmission"("rentalPaymentId");
CREATE INDEX "RentalPaymentSubmission_tenantId_status_createdAt_idx" ON "RentalPaymentSubmission"("tenantId","status","createdAt");
CREATE INDEX "RentalPaymentSubmission_bookingId_createdAt_idx" ON "RentalPaymentSubmission"("bookingId","createdAt");
ALTER TABLE "RentalPaymentSubmission" ADD CONSTRAINT "RentalPaymentSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalPaymentSubmission" ADD CONSTRAINT "RentalPaymentSubmission_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalPaymentSubmission" ADD CONSTRAINT "RentalPaymentSubmission_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "TenantPaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalPaymentSubmission" ADD CONSTRAINT "RentalPaymentSubmission_rentalPaymentId_fkey" FOREIGN KEY ("rentalPaymentId") REFERENCES "RentalPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
