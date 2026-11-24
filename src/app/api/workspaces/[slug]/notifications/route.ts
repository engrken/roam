import { NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });

  const rows = await prisma.appNotification.findMany({
    where: { tenantId: access.tenant.id, audience: "TENANT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, type: true, title: true, message: true, actionUrl: true,
      createdAt: true, acknowledgedAt: true, acknowledgedByLabel: true,
    },
  });

  // Staff can acknowledge shared notices, but their allowed landing page is the workspace overview.
  return NextResponse.json({
    notifications: rows.map(row => ({
      ...row,
      actionUrl: access.role === "STAFF" ? `/workspace/${encodeURIComponent(slug)}` : row.actionUrl,
      createdAt: row.createdAt.toISOString(),
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
