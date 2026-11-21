import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function findQuote(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  return prisma.marketplaceRentalQuote.findFirst({
    where: { acceptanceTokenHash: hashToken(token) },
    select: {
      id: true, tenantId: true, status: true, currency: true, dailyRate: true,
      rentalDays: true, baseAmount: true, addOns: true, discountAmount: true,
      fees: true, totalAmount: true, validUntil: true, snapshot: true,
      agreementReference: true, renterAcceptedAt: true,
    },
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await findQuote(token);
  if (!quote) return NextResponse.json({ error: "This quote link is invalid or has been replaced." }, { status: 404 });
  if (quote.status !== "APPROVED" || quote.validUntil.getTime() < Date.now() || quote.renterAcceptedAt) {
    return NextResponse.json({ error: "This quote is expired or unavailable." }, { status: 410 });
  }
  return NextResponse.json({
    quote: {
      id: quote.id, currency: quote.currency, dailyRate: Number(quote.dailyRate),
      rentalDays: quote.rentalDays, baseAmount: Number(quote.baseAmount),
      addOns: quote.addOns, discountAmount: Number(quote.discountAmount),
      fees: quote.fees, totalAmount: Number(quote.totalAmount),
      validUntil: quote.validUntil, agreementReference: quote.agreementReference,
      snapshot: quote.snapshot,
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const quote = await findQuote(token);
  if (!quote) return NextResponse.json({ error: "This quote link is invalid or has been replaced." }, { status: 404 });
  if (quote.status !== "APPROVED" || quote.validUntil.getTime() < Date.now() || quote.renterAcceptedAt) {
    return NextResponse.json({ error: "This quote is expired or already accepted." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const snapshot = quote.snapshot as { requester?: { email?: string } };
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || email !== snapshot.requester?.email?.toLowerCase() || body?.accept !== true) {
    return NextResponse.json({ error: "Enter the inquiry email and explicitly accept the quotation." }, { status: 400 });
  }

  const now = new Date();
  const accepted = await prisma.$transaction(async (tx) => {
    const changed = await tx.marketplaceRentalQuote.updateMany({
      where: { id: quote.id, tenantId: quote.tenantId, acceptanceTokenHash: hashToken(token), status: "APPROVED", renterAcceptedAt: null, validUntil: { gte: now } },
      data: { renterAcceptedAt: now, renterAcceptedName: name, renterAcceptedEmail: email, acceptanceTokenHash: null },
    });
    if (changed.count !== 1) return false;
    await recordWorkspaceAudit(tx, {
      tenantId: quote.tenantId, actorUserId: "marketplace-renter", actorEmail: email,
      action: "marketplace.quote.renter_accepted", targetType: "marketplace_rental_quote",
      targetId: quote.id, details: { acceptedAt: now.toISOString(), acceptedName: name, acceptedEmail: email },
    });
    return true;
  });
  if (!accepted) return NextResponse.json({ error: "This quote was accepted or changed by another request. Refresh to see its current status." }, { status: 409 });
  return NextResponse.json({ accepted: true, acceptedAt: now.toISOString(), message: "Acceptance recorded. Host confirmation and booking remain separate." });
}
