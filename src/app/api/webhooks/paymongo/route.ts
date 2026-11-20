import { verifyPayMongoSignature } from "@/lib/paymongo-signature";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCalendarMonths, grantReferralMonth } from "@/lib/referrals";
import { sendReferralRewardEmail } from "@/lib/email";

export const runtime = "nodejs";

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature") || request.headers.get("Paymongo-Signature") || "";
  let event: {
    data?: { id?: string; attributes?: { type?: string; livemode?: boolean; data?: { id?: string; attributes?: { payment_intent_id?: string; amount?: number; currency?: string; status?: string } } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const attributes = event.data?.attributes;
  const eventId = event.data?.id || "";
  const eventType = attributes?.type || "";
  const paymentData = attributes?.data;
  if (!eventId || !eventType || !verifyPayMongoSignature(rawBody, signature, webhookSecret, attributes?.livemode === true)) {
    return NextResponse.json({ error: "Invalid webhook signature or event." }, { status: 401 });
  }

  if (eventType !== "payment.paid" && eventType !== "payment.failed") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const paymentIntentId = paymentData?.attributes?.payment_intent_id || "";
  if (!paymentIntentId) return NextResponse.json({ received: true, ignored: true });

  let referralReward: { referredTenantId: string; referrerTenantId: string } | null = null;
  try {
    await prisma.$transaction(async tx => {
      await tx.paymentWebhookEvent.create({
        data: { provider: "PAYMONGO", eventId, eventType },
      });

      const payment = await tx.subscriptionPayment.findUnique({
        where: { providerPaymentIntentId: paymentIntentId },
        include: { plan: { select: { id: true, tier: true, name: true } }, tenant: { select: { id: true, currency: true } } },
      });
      if (!payment) return;

      if (eventType === "payment.failed") {
        if (payment.status === "PENDING") {
          await tx.subscriptionPayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
        }
        return;
      }

      const receivedAmount = Number(paymentData?.attributes?.amount || 0);
      const receivedCurrency = (paymentData?.attributes?.currency || "").toUpperCase();
      const expectedAmount = Math.round(Number(payment.amount) * 100);
      if (receivedAmount !== expectedAmount || receivedCurrency !== payment.currency) {
        await tx.subscriptionPayment.update({ where: { id: payment.id }, data: { status: "REVIEW_REQUIRED", providerPaymentId: paymentData?.id || null } });
        return;
      }
      if (payment.status === "PAID") return;

      const now = new Date();
      const previousPaidCount = await tx.billingRecord.count({ where: { tenantId: payment.tenantId, status: "PAID" } });
      await tx.billingRecord.create({
        data: {
          tenantId: payment.tenantId,
          description: "Subscription payment · " + payment.plan.name,
          reference: payment.reference,
          amount: payment.amount,
          currency: payment.currency,
          status: "PAID",
          issuedAt: now,
          paidAt: now,
        },
      });

      const subscription = await tx.subscription.findUnique({ where: { tenantId: payment.tenantId } });
      if (!subscription) {
        await tx.subscriptionPayment.update({ where: { id: payment.id }, data: { status: "REVIEW_REQUIRED", providerPaymentId: paymentData?.id || null, paidAt: now } });
        return;
      }

      const periodStart = subscription.currentPeriodEnd && subscription.currentPeriodEnd > now ? subscription.currentPeriodEnd : now;
      let periodEnd = addCalendarMonths(periodStart, 1 + subscription.referralCreditMonths);
      if (previousPaidCount === 0) {
        const referral = await tx.referral.findUnique({ where: { referredTenantId: payment.tenantId } });
        if (referral && referral.status === "PENDING") {
          if (referral.registeredAt <= now && referral.expiresAt >= now) {
            const claim = await tx.referral.updateMany({
              where: { id: referral.id, status: "PENDING", expiresAt: { gte: now } },
              data: { status: "REWARDED", qualifiedAt: now, rewardedAt: now },
            });
            if (claim.count === 1) {
              periodEnd = addCalendarMonths(periodEnd, 1);
              await grantReferralMonth(tx, referral.referrerTenantId);
              referralReward = { referredTenantId: payment.tenantId, referrerTenantId: referral.referrerTenantId };
            }
          } else {
            await tx.referral.updateMany({ where: { id: referral.id, status: "PENDING" }, data: { status: "EXPIRED" } });
          }
        }
      } else {
        await tx.referral.updateMany({ where: { referredTenantId: payment.tenantId, status: "PENDING" }, data: { status: "EXPIRED" } });
      }

      await tx.subscription.update({
        where: { tenantId: payment.tenantId },
        data: {
          planId: payment.planId,
          tier: payment.plan.tier,
          status: "active",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
          trialGraceEndsAt: null,
          referralCreditMonths: 0,
        },
      });
      await tx.tenant.update({ where: { id: payment.tenantId }, data: { status: "ACTIVE" } });
      await tx.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: "PAID", providerPaymentId: paymentData?.id || null, paidAt: now },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ received: true, duplicate: true });
    console.error("PayMongo webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  const confirmedReferralReward = referralReward as { referredTenantId: string; referrerTenantId: string } | null;
  if (confirmedReferralReward) {
    try {
      const tenants = await prisma.tenant.findMany({
        where: { id: { in: [confirmedReferralReward.referredTenantId, confirmedReferralReward.referrerTenantId] } },
        select: { id: true, name: true, slug: true, memberships: { where: { role: "OWNER" }, select: { user: { select: { email: true } } }, take: 1 } },
      });
      const referred = tenants.find(item => item.id === confirmedReferralReward.referredTenantId);
      const referrer = tenants.find(item => item.id === confirmedReferralReward.referrerTenantId);
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/+$/, "");
      await Promise.allSettled([
        ...(referred?.memberships[0]?.user.email && referrer ? [sendReferralRewardEmail({
          recipient: referred.memberships[0].user.email, businessName: referred.name,
          referredBusinessName: referrer.name, accountUrl: baseUrl + "/workspace/" + encodeURIComponent(referred.slug) + "/account",
        })] : []),
        ...(referrer?.memberships[0]?.user.email && referred ? [sendReferralRewardEmail({
          recipient: referrer.memberships[0].user.email, businessName: referrer.name,
          referredBusinessName: referred.name, accountUrl: baseUrl + "/workspace/" + encodeURIComponent(referrer.slug) + "/account",
        })] : []),
      ]);
    } catch (error) {
      console.error("Referral reward notification after QR payment failed", error);
    }
  }

  return NextResponse.json({ received: true });
}
