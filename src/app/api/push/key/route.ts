import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/web-push";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publicKey = getVapidPublicKey();
    return NextResponse.json(
      { publicKey },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Browser notifications are not configured.";
    console.error("Browser push key endpoint is not ready", error);
    return NextResponse.json(
      { error: message },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
