import { NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });

  const subscription = await prisma.subscription.findUnique({
    where: { tenantId: access.tenant.id },
    select: { tier: true, status: true },
  });

  return NextResponse.json({
    tier: subscription?.tier || "FREE",
    subscriptionStatus: subscription?.status || "inactive",
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
