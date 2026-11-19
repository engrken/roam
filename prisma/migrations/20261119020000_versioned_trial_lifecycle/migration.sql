ALTER TABLE "Subscription"
  ADD COLUMN "trialPolicyVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "trialGraceEndsAt" TIMESTAMP(3),
  ADD COLUMN "trialReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "trialExpiredNoticeSentAt" TIMESTAMP(3),
  ADD COLUMN "trialReadOnlyNoticeSentAt" TIMESTAMP(3);
