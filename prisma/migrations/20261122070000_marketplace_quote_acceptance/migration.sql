ALTER TABLE "MarketplaceRentalQuote"
  ADD COLUMN "acceptanceTokenHash" TEXT,
  ADD COLUMN "acceptanceLinkCreatedAt" TIMESTAMP(3),
  ADD COLUMN "renterAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "renterAcceptedName" VARCHAR(120),
  ADD COLUMN "renterAcceptedEmail" VARCHAR(254);
CREATE UNIQUE INDEX "MarketplaceRentalQuote_acceptanceTokenHash_key"
  ON "MarketplaceRentalQuote"("acceptanceTokenHash");