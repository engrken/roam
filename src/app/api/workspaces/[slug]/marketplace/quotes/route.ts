import { NextRequest, NextResponse } from "next/server";
import { canManageFleet, getTenantAccess, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";
import { marketplaceQuoteApprovalSchema, marketplaceQuoteSchema, marketplaceQuoteTotals } from "@/lib/marketplace-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const todayInManila = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
const tenantCurrency = (value?: string | null) => {
  const code = (value || "PHP").toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : "PHP";
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage Marketplace quotes." }, { status: 403 });

  const inquiries = await prisma.marketplaceBookingInquiry.findMany({
    where: { tenantId: access.tenant.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, requesterName: true, requesterEmail: true, requesterPhone: true,
      startAt: true, endAt: true, dailyRateSnapshot: true, status: true, message: true,
      listing: { select: { headline: true, vehicle: { select: { make: true, model: true, year: true } } } },
      rentalQuotes: {
        orderBy: { version: "desc" },
        take: 10,
        select: {
          id: true, version: true, status: true, currency: true, dailyRate: true,
          rentalDays: true, baseAmount: true, addOns: true, discountAmount: true,
          fees: true, totalAmount: true, validUntil: true, snapshot: true,
          agreementReference: true, agreementReviewedAt: true, agreementReviewedById: true,
          approvedAt: true, approvedById: true, createdAt: true, createdById: true,
        },
      },
    },
  });

  return NextResponse.json({
    currency: tenantCurrency(access.tenant.currency),
    inquiries: inquiries.map((item) => ({
      ...item,
      dailyRateSnapshot: Number(item.dailyRateSnapshot),
      rentalQuotes: item.rentalQuotes.map((quote) => ({
        ...quote,
        dailyRate: Number(quote.dailyRate),
        baseAmount: Number(quote.baseAmount),
        discountAmount: Number(quote.discountAmount),
        totalAmount: Number(quote.totalAmount),
      })),
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to prepare Marketplace quotes." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = marketplaceQuoteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid daily rate, line items, discount and quote expiry date." }, { status: 400 });
  const inquiry = await prisma.marketplaceBookingInquiry.findFirst({
    where: { id: parsed.data.inquiryId, tenantId: access.tenant.id },
    select: {
      id: true, status: true, startAt: true, endAt: true, requesterName: true,
      requesterEmail: true, requesterPhone: true, dailyRateSnapshot: true,
      listing: { select: { headline: true, vehicle: { select: { make: true, model: true, year: true } } } },
    },
  });
  if (!inquiry) return NextResponse.json({ error: "Renter inquiry not found." }, { status: 404 });
  if (!["QUALIFIED", "READY_FOR_MANUAL_BOOKING"].includes(inquiry.status)) {
    return NextResponse.json({ error: "Qualify the inquiry before preparing a rental quote." }, { status: 409 });
  }

  const startDate = new Date(inquiry.startAt).toISOString().slice(0, 10);
  const endDate = new Date(inquiry.endAt).toISOString().slice(0, 10);
  const rentalDays = Math.round((inquiry.endAt.getTime() - inquiry.startAt.getTime()) / 86_400_000);
  const validUntilDate = new Date(`${parsed.data.validUntil}T00:00:00.000Z`);
  const maxExpiryDate = new Date(`${todayInManila()}T00:00:00.000Z`);
  maxExpiryDate.setUTCDate(maxExpiryDate.getUTCDate() + 30);
  if (!Number.isFinite(validUntilDate.getTime()) || validUntilDate.toISOString().slice(0, 10) !== parsed.data.validUntil
    || parsed.data.validUntil < todayInManila()
    || parsed.data.validUntil > maxExpiryDate.toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "Quote expiry must be today or within the next 30 days." }, { status: 400 });
  }
  const totals = marketplaceQuoteTotals({
    dailyRate: parsed.data.dailyRate,
    rentalDays,
    addOns: parsed.data.addOns,
    discountAmount: parsed.data.discountAmount,
    fees: parsed.data.fees,
  });
  if (!totals) return NextResponse.json({ error: "The quote total is invalid or exceeds the supported amount." }, { status: 400 });

  const currency = tenantCurrency(access.tenant.currency);
  const validUntil = new Date(`${parsed.data.validUntil}T23:59:59.999+08:00`);
  const snapshot = {
    inquiryId: inquiry.id,
    requester: { name: inquiry.requesterName, email: inquiry.requesterEmail, phone: inquiry.requesterPhone },
    listing: inquiry.listing,
    rentalPeriod: { startDate, endDate, rentalDays },
    originalDailyRateSnapshot: Number(inquiry.dailyRateSnapshot),
    currency,
    quote: {
      dailyRate: parsed.data.dailyRate,
      baseAmount: totals.baseAmount,
      addOns: parsed.data.addOns,
      discountAmount: totals.discountAmount,
      fees: parsed.data.fees,
      totalAmount: totals.totalAmount,
    },
  };

  try {
    const quote = await prisma.$transaction(async (tx) => {
      const latest = await tx.marketplaceRentalQuote.findFirst({
        where: { inquiryId: inquiry.id, tenantId: access.tenant.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const version = (latest?.version || 0) + 1;
      await tx.marketplaceRentalQuote.updateMany({
        where: { inquiryId: inquiry.id, tenantId: access.tenant.id, status: { in: ["DRAFT", "APPROVED"] } },
        data: { status: "SUPERSEDED" },
      });
      const created = await tx.marketplaceRentalQuote.create({
        data: {
          tenantId: access.tenant.id,
          inquiryId: inquiry.id,
          version,
          currency,
          dailyRate: parsed.data.dailyRate.toFixed(2),
          rentalDays,
          baseAmount: totals.baseAmount,
          addOns: parsed.data.addOns,
          discountAmount: totals.discountAmount,
          fees: parsed.data.fees,
          totalAmount: totals.totalAmount,
          validUntil,
          snapshot,
          createdById: access.user.id,
        },
      });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "marketplace.quote.draft_created", targetType: "marketplace_rental_quote",
        targetId: created.id,
        details: { inquiryId: inquiry.id, version, currency, totalAmount: totals.totalAmount, validUntil: parsed.data.validUntil },
      });
      return created;
    });
    return NextResponse.json({ quote: { ...quote, dailyRate: Number(quote.dailyRate), baseAmount: Number(quote.baseAmount), discountAmount: Number(quote.discountAmount), totalAmount: Number(quote.totalAmount) } }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Another team member created a quote version at the same time. Refresh and try again." }, { status: 409 });
    }
    console.error("Marketplace quote draft creation failed", error);
    return NextResponse.json({ error: "Unable to create the quote draft." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to approve Marketplace quotes." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = marketplaceQuoteApprovalSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Select the applicable agreement version and confirm that it has been reviewed." }, { status: 400 });
  const quote = await prisma.marketplaceRentalQuote.findFirst({
    where: { id: parsed.data.quoteId, tenantId: access.tenant.id },
    select: { id: true, inquiryId: true, status: true, validUntil: true, version: true, totalAmount: true, currency: true },
  });
  if (!quote) return NextResponse.json({ error: "Quote not found." }, { status: 404 });
  if (quote.status !== "DRAFT") return NextResponse.json({ error: "Only the current draft quote can be approved. Create a new version to make changes." }, { status: 409 });
  if (quote.validUntil.getTime() < Date.now()) return NextResponse.json({ error: "This quote has expired. Create a new version before approval." }, { status: 409 });

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.marketplaceRentalQuote.updateMany({
      where: { id: quote.id, tenantId: access.tenant.id, status: "DRAFT" },
      data: {
        status: "APPROVED",
        agreementReference: parsed.data.agreementReference,
        agreementReviewedAt: now,
        agreementReviewedById: access.user.id,
        approvedAt: now,
        approvedById: access.user.id,
      },
    });
    if (changed.count !== 1) throw new Error("QUOTE_STATE_CHANGED");
    const approved = await tx.marketplaceRentalQuote.findFirst({
      where: { id: quote.id, tenantId: access.tenant.id },
      select: { id: true, version: true, status: true, agreementReference: true, agreementReviewedAt: true, approvedAt: true },
    });
    await recordWorkspaceAudit(tx, {
      tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
      action: "marketplace.quote.approved", targetType: "marketplace_rental_quote",
      targetId: quote.id,
      details: { inquiryId: quote.inquiryId, version: quote.version, agreementReference: parsed.data.agreementReference, currency: quote.currency, totalAmount: Number(quote.totalAmount), approvedAt: now.toISOString() },
    });
    return approved;
  }).catch((error) => {
    if (error instanceof Error && error.message === "QUOTE_STATE_CHANGED") return null;
    throw error;
  });
  if (!result) return NextResponse.json({ error: "This quote was changed by another team member. Refresh and try again." }, { status: 409 });
  return NextResponse.json({ quote: result });
}
