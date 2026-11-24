import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });

  const updated = await prisma.appNotification.updateMany({
    where: { id, tenantId: access.tenant.id, audience: "TENANT", acknowledgedAt: null },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedByUserId: access.user.id,
      acknowledgedByLabel: access.user.name || access.user.email,
    },
  });
  if (updated.count === 1) return NextResponse.json({ acknowledged: true });

  const existing = await prisma.appNotification.findFirst({
    where: { id, tenantId: access.tenant.id, audience: "TENANT" },
    select: { acknowledgedAt: true },
  });
  if (!existing) return NextResponse.json({ error: "Notification not found." }, { status: 404 });
  if (!existing.acknowledgedAt) return NextResponse.json({ error: "Notification acknowledgement could not be saved. Please try again." }, { status: 409 });
  return NextResponse.json({ acknowledged: true, alreadyAcknowledged: true });
}
