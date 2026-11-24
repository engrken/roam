import { NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });

  const notificationSelect = {
    id: true, type: true, title: true, message: true, actionUrl: true,
    createdAt: true, acknowledgedAt: true, acknowledgedByLabel: true,
  } as const;
  const [pending, acknowledged] = await Promise.all([
    prisma.appNotification.findMany({
      where: { tenantId: access.tenant.id, audience: "TENANT", acknowledgedAt: null },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: notificationSelect,
    }),
    prisma.appNotification.findMany({
      where: { tenantId: access.tenant.id, audience: "TENANT", acknowledgedAt: { not: null } },
      orderBy: { acknowledgedAt: "desc" },
      take: 50,
      select: notificationSelect,
    }),
  ]);
  const rows = [...pending, ...acknowledged].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Staff can acknowledge shared notices, but their allowed landing page is the workspace overview.
  return NextResponse.json({
    notifications: rows.map(row => ({
      ...row,
      actionUrl: access.role === "STAFF" || (row.type === "SUBSCRIPTION_PAYMENT" && access.role !== "OWNER") ? `/workspace/${encodeURIComponent(slug)}` : row.actionUrl,
      createdAt: row.createdAt.toISOString(),
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
