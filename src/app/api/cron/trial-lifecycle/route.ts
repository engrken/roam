import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTrialLifecycleEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const expiredReferrals = await prisma.referral.updateMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  const reminderCutoff = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const subscriptions = await prisma.subscription.findMany({
    where: {
      trialPolicyVersion: 1,
      status: "trialing",
      trialEndsAt: { not: null },
      OR: [
        { trialReminderSentAt: null, trialEndsAt: { gt: now, lte: reminderCutoff } },
        { trialExpiredNoticeSentAt: null, trialEndsAt: { lte: now } },
        { trialReadOnlyNoticeSentAt: null, trialGraceEndsAt: { lte: now } },
      ],
    },
    select: {
      tenantId: true, trialEndsAt: true, trialGraceEndsAt: true,
      trialReminderSentAt: true, trialExpiredNoticeSentAt: true, trialReadOnlyNoticeSentAt: true,
      tenant: { select: { name: true, slug: true, memberships: { where: { role: "OWNER" }, select: { user: { select: { email: true } } }, take: 1 } } },
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const subscription of subscriptions) {
    const ownerEmail = subscription.tenant.memberships[0]?.user.email;
    if (!ownerEmail || !subscription.trialEndsAt) { skipped++; continue; }
    const accountUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/+$/, "")
      + "/workspace/" + encodeURIComponent(subscription.tenant.slug) + "/account";
    const stages = [
      { stage: "REMINDER" as const, field: "trialReminderSentAt" as const, due: !subscription.trialReminderSentAt && subscription.trialEndsAt > now && subscription.trialEndsAt <= reminderCutoff },
      { stage: "EXPIRED" as const, field: "trialExpiredNoticeSentAt" as const, due: !subscription.trialExpiredNoticeSentAt && subscription.trialEndsAt <= now },
      { stage: "READ_ONLY" as const, field: "trialReadOnlyNoticeSentAt" as const, due: !subscription.trialReadOnlyNoticeSentAt && !!subscription.trialGraceEndsAt && subscription.trialGraceEndsAt <= now },
    ];
    for (const item of stages) {
      if (!item.due) continue;
      const claim = await prisma.subscription.updateMany({
        where: { tenantId: subscription.tenantId, [item.field]: null, trialPolicyVersion: 1, status: "trialing" },
        data: { [item.field]: now },
      });
      if (!claim.count) { skipped++; continue; }
      try {
        await sendTrialLifecycleEmail({
          recipient: ownerEmail,
          tenantName: subscription.tenant.name,
          stage: item.stage,
          trialEndsAt: subscription.trialEndsAt,
          accountUrl,
        });
        sent++;
      } catch (error) {
        await prisma.subscription.updateMany({
          where: { tenantId: subscription.tenantId, [item.field]: now },
          data: { [item.field]: null },
        });
        console.error("Trial lifecycle email failed", { tenantId: subscription.tenantId, stage: item.stage, error });
        failed++;
      }
    }
  }
  return NextResponse.json({ ok: true, scanned: subscriptions.length, sent, skipped, failed, expiredReferrals: expiredReferrals.count, checkedAt: now.toISOString() });
}
