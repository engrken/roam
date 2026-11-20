import { NextRequest, NextResponse } from "next/server";
import { expirePendingSubscriptionPayments } from "@/lib/subscription-payments";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const expired = await expirePendingSubscriptionPayments();
  return NextResponse.json({ expired });
}
