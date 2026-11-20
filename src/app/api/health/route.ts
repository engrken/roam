import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      database: "ok",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "unknown",
      checkedAt,
    }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch {
    return NextResponse.json({
      status: "degraded",
      database: "unavailable",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "unknown",
      checkedAt,
    }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  }
}
