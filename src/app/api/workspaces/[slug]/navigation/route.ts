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
    trial: access.tenant.subscription?.trialPolicyVersion === 1 && access.tenant.subscription.status === "trialing" ? {
      endsAt: access.tenant.subscription.trialEndsAt?.toISOString() || null,
      graceEndsAt: access.tenant.subscription.trialGraceEndsAt?.toISOString() || null,
      readOnly: access.trialReadOnly,
    } : null,
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
