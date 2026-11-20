import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function payMongoAuth(secret: string) {
  return "Basic " + Buffer.from(secret + ":").toString("base64");
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (access.role !== "OWNER") return NextResponse.json({ error: "Only the workspace owner can pay for a subscription." }, { status: 403 });

  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  const publicKey = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY;
  if (!secretKey || !publicKey) {
    return NextResponse.json({ error: "Online subscription payments are not configured yet. Please contact ROAM support." }, { status: 503 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: access.tenant.id },
    include: { plan: { select: { id: true, tier: true, name: true, monthlyPrice: true, active: true } } },
  });
  if (!subscription || !subscription.plan.active) return NextResponse.json({ error: "No active subscription plan is available for payment." }, { status: 404 });
  if (subscription.tier === "FREE") return NextResponse.json({ error: "Your workspace is on the complimentary plan. No subscription payment is due." }, { status: 400 });
  if (subscription.tier === "ENTERPRISE") return NextResponse.json({ error: "Enterprise subscriptions are billed by custom arrangement. Please contact ROAM support." }, { status: 400 });

  const amount = Number(subscription.plan.monthlyPrice);
  const amountInCentavos = Math.round(amount * 100);
  if (!Number.isSafeInteger(amountInCentavos) || amountInCentavos < 100 || amountInCentavos > 999999999) {
    return NextResponse.json({ error: "The configured subscription amount cannot be processed online." }, { status: 400 });
  }

  const reference = "ROAM-SUB-" + randomBytes(8).toString("hex").toUpperCase();
  let intent: { data?: { id?: string; attributes?: { client_key?: string; status?: string } }; errors?: { detail?: string }[] };
  try {
    const response = await fetch("https://api.paymongo.com/v1/payment_intents", {
      method: "POST",
      headers: { Authorization: payMongoAuth(secretKey), "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amountInCentavos,
            currency: "PHP",
            payment_method_allowed: ["qrph"],
            description: "ROAM subscription · " + subscription.plan.name + " · " + reference,
            metadata: { tenant_id: access.tenant.id, subscription_payment_reference: reference },
          },
        },
      }),
      cache: "no-store",
    });
    intent = await response.json();
    if (!response.ok || !intent.data?.id || !intent.data.attributes?.client_key) {
      console.error("PayMongo payment intent creation failed", intent.errors?.[0]?.detail || response.status);
      return NextResponse.json({ error: "Unable to create a QR payment request. Please try again." }, { status: 502 });
    }
  } catch (error) {
    console.error("PayMongo payment intent request failed", error);
    return NextResponse.json({ error: "Payment service is temporarily unavailable. Please try again." }, { status: 502 });
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId: access.tenant.id,
      planId: subscription.plan.id,
      amount,
      currency: "PHP",
      provider: "PAYMONGO",
      providerPaymentIntentId: intent.data.id,
      reference,
      status: "PENDING",
      expiresAt,
    },
    select: { id: true, reference: true, amount: true, currency: true, status: true, expiresAt: true },
  });

  return NextResponse.json({
    payment: { ...payment, amount: Number(payment.amount), expiresAt: payment.expiresAt?.toISOString() || null },
    paymentIntentId: intent.data.id,
    clientKey: intent.data.attributes.client_key,
    publicKey,
  }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (access.role !== "OWNER") return NextResponse.json({ error: "Only the workspace owner can update payment details." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
  const qrCodeData = typeof body?.qrCodeData === "string" ? body.qrCodeData : "";
  if (!paymentId || !qrCodeData.startsWith("data:image/") || qrCodeData.length > 300000) {
    return NextResponse.json({ error: "Invalid QR payment data." }, { status: 400 });
  }

  const updated = await prisma.subscriptionPayment.updateMany({
    where: { id: paymentId, tenantId: access.tenant.id, status: "PENDING", expiresAt: { gt: new Date() } },
    data: { qrCodeData },
  });
  if (updated.count !== 1) return NextResponse.json({ error: "This payment request has expired or is no longer available." }, { status: 409 });
  return NextResponse.json({ saved: true });
}
