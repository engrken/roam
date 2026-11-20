import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { addCalendarMonths, grantReferralMonth } from "@/lib/referrals";
import { expirePendingSubscriptionPayments, notifySubscriptionPayment } from "@/lib/subscription-payments";
import { sendReferralRewardEmail } from "@/lib/email";

export const runtime = "nodejs";

const defaultMethods = [
  { key: "GCASH", label: "GCash", sortOrder: 1 },
  { key: "MAYA", label: "Maya", sortOrder: 2 },
  { key: "BANK", label: "Bank transfer / QR", sortOrder: 3 },
];

async function ensureMethods() {
  for (const method of defaultMethods) {
    await prisma.subscriptionPaymentMethod.upsert({
      where: { key: method.key },
      create: { ...method, enabled: false },
      update: {},
    });
  }
}

export async function GET() {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  await expirePendingSubscriptionPayments();
  await ensureMethods();
  const [methods, submissions] = await Promise.all([
    prisma.subscriptionPaymentMethod.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.subscriptionPaymentSubmission.findMany({
      orderBy: { createdAt: "desc" }, take: 100,
      include: { tenant: { select: { id: true, name: true, slug: true, email: true } } },
    }),
  ]);
  return NextResponse.json({
    methods,
    submission¶»§q«^