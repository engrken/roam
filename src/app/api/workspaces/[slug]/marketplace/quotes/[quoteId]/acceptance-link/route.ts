import { randomBytes, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { canManageFleet, getTenantAccess, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string; quoteId: string }> }) {
  const { slug, quoteId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to issue quote acceptance links." }, { status: 403 });

  const quote = await prisma.marketplaceRentalQuote.findFirst({
    where: { id: quoteId, tenantId: access.tenant.id },
    select: { id: true, status: true, validUntil: true, renterAcceptedAt: true, inquiry: { select: { status: true } } },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  if (quote.status !== "APPROVED" || quote.validUntil.getTime() < Date.now() || quote.renterAcceptedAt) {
    return NextResponse.json({ error: "Only an unexpired, approved, not-yet-accepted quote can receive a link." }, { status: 409 });
  }
  if (quote.inquiry.status !== "READY_FOR_MANUAL_BOOKING") {
    return NextResponse.json({ error: "Complete the staff handoff readiness checks first." }, { status: 409 });
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const issued = await prisma.$transaction(async (tx) => {
    const changed = await tx.marketplaceRentalQuote.updateMany({
      where: { id: quote.id, tenantId: access.tenant.id, status: "APPROVED", renterAcceptedAt: null, validUntil: { gte: now } },
      data: { acceptanceTokenHash: tokenHash, acceptanceLinkCreatedAt: now },
    });
    if (changed.count !== 1) return false;
    await recordWorkspaceAudit(tx, {
      tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
      action: "marketplace.quote.acceptance_link_created", targetType: "marketplace_rental_quote",
      targetId: quote.id, details: { issuedAt: now.toISOString(), expiresAt: quote.validUntil.toISOString() },
    });
    return true;
  });
  if (!issued) return NextResponse.json({ error: "Quote changed. Refresh and retry." }, { status: 409 });
  return NextResponse.json({ url: new URL("/marketplace/quote/" + token, request.url).toString(), expiresAt: quote.validUntil.toISOString() });
}
