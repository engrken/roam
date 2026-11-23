import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/web-push";
export const dynamic = "force-dynamic";
export async function GET() {
  const key = getVapidPublicKey();
  if (!key) return NextResponse.json({ error: "Browser notifications are not configured yet." }, { status: 503 });
  return NextResponse.json({ publicKey: key }, { headers: { "Cache-Control": "no-store" } });
}
