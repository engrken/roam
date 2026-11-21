ALTER TABLE "MarketplaceListing"
ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "MarketplaceListing_isPublished_status_idx"
ON "MarketplaceListing"("isPublished", "status");
