ALTER TABLE "Subscription"
  ADD COLUMN "renewalReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "renewalOverdueNoticeSentAt" TIMESTAMP(3);
