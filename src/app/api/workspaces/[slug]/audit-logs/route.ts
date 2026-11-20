import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageTeam } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageTeam(access.role)) return NextResponse.json({ error: "Only workspace owners and admins can view audit history." }, { status: 403 });

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || "50");
  const take = Number.isInteger(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 50;
  const logs = await prisma.platformAuditLog.findMany({
    where: { entityType: "workspace", entityId: access.tenant.id },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, actorUserId: true, actorEmail: true, action: true, details: true, createdAt: true },
  });
  return NextResponse.json({ logs });
}
