ALTER TABLE "Tenant" ADD COLUMN "rentalTerms" TEXT;
ALTER TABLE "Booking" ADD COLUMN "rentalTermsSnapshot" TEXT;
ALTER TABLE "Booking" ADD COLUMN "rentalTermsVersion" TEXT;
ALTER TABLE "Booking" ADD COLUMN "rentalTermsAcceptedAt" TIMESTAMP(3);
