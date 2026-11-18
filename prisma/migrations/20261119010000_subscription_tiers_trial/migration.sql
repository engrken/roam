-- Add paid subscription tiers and record the end of each trial.
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'STARTER';
ALTER TYPE "SubscriptionTier" ADD VALUE IF NOT EXISTS 'BUSINESS';
ALTER TABLE "Subscription" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
