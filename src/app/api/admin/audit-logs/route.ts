import { NextRequest, NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  const limitParam = Number(request.nextUrl.searchParams.get("limit") || "50");
  const take = Number.isInteger(limitParam) ? Math.min(100, Math.max(1, limitParam)) : 50;
  const logs = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, actorUserId: true, actorEmail: true, action: true, entityType: true, entityId: true, details: true, createdAt: true },
  });
  return NextResponse.json({ logs });
}
