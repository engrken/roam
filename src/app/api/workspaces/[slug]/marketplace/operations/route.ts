import { NextRequest, NextResponse } from "next/server";
import { canManageFleet, getTenantAccess, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";
import { isMarketplaceInquiryStatus, marketplaceAvailabilityBlockSchema, marketplaceDateRange } from "@/lib/marketplace-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const todayInManila = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage Marketplace operations." }, { status: 403 });

  const [listings, inquiries] = await Promise.all([
    prisma.marketplaceListing.findMany({
      where: { tenantId: access.tenant.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, headline: true, status: true, isPublished: true,
        vehicle: { select: { make: true, model: true, year: true, dailyRate: true, status: true } },
        availabilityBlocks: { where: { endAt: { gte: new Date() } }, orderBy: { startAt: "asc" }, take: 50, select: { id: true, startAt: true, endAt: true, label: true } },
      },
    }),
    prisma.marketplaceBookingInquiry.findMany({
      where: { tenantId: access.tenant.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, listingId: true, requesterName: true, requesterEmail: true, requesterPhone: true,
        startAt: true, endAt: true, dailyRateSnapshot: true, message: true, status: true,
        hostNote: true, createdAt: true, reviewedAt: true,
        listing: { select: { headline: true, vehicle: { select: { make: true, model: true } } } },
      },
    }),
  ]);

  return NextResponse.json({
    role: access.role,
    inquiriesEnabled: process.env.ROAM_MARKETPLACE_INQUIRIES_ENABLED === "true",
    listings: listings.map((listing) => ({
      ...listing,
      vehicle: { ...listing.vehicle, dailyRate: Number(listing.vehicle.dailyRate) },
    })),
    inquiries: inquiries.map((inquiry) => ({
      ...inquiry,
      dailyRateSnapshot: Number(inquiry.dailyRateSnapshot),
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage Marketplace availability." }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (body?.action === "DELETE_BLOCK") {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "Availability block ID is required." }, { status: 400 });
    const block = await prisma.marketplaceAvailabilityBlock.findFirst({ where: { id, tenantId: access.tenant.id }, select: { id: true, listingId: true } });
    if (!block) return NextResponse.json({ error: "Availability block not found." }, { status: 404 });
    await prisma.$transaction(async (tx) => {
      await tx.marketplaceAvailabilityBlock.delete({ where: { id: block.id } });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "marketplace.availability_block.deleted", targetType: "marketplace_availability_block",
        targetId: block.id, details: { listingId: block.listingId },
      });
    });
    return NextResponse.json({ deleted: true });
  }

  const parsed = marketplaceAvailabilityBlockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a listing and a valid date range (up to 30 days)." }, { status: 400 });
  const range = marketplaceDateRange(parsed.data.startDate, parsed.data.endDate);
  if (!range || parsed.data.startDate < todayInManila()) return NextResponse.json({ error: "Availability blocks must start today or later and cannot exceed 30 days." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.marketplaceListing.findFirst({
        where: { id: parsed.data.listingId, tenantId: access.tenant.id },
        select: { id: true, vehicleId: true, status: true, isPublished: true },
      });
      if (!listing) throw new Error("LISTING_NOT_FOUND");
      const [existingBlock, booking, maintenance] = await Promise.all([
        tx.marketplaceAvailabilityBlock.findFirst({
          where: { listingId: listing.id, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } },
          select: { id: true },
        }),
        tx.bookingItem.findFirst({
          where: {
            vehicleId: listing.vehicleId,
            booking: { is: { status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] }, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } } },
          },
          select: { id: true },
        }),
        tx.vehicleMaintenance.findFirst({
          where: { tenantId: access.tenant.id, vehicleId: listing.vehicleId, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } },
          select: { id: true },
        }),
      ]);
      if (existingBlock) throw new Error("BLOCK_OVERLAP");
      if (booking || maintenance) throw new Error("OPERATIONAL_CONFLICT");
      const block = await tx.marketplaceAvailabilityBlock.create({
        data: { tenantId: access.tenant.id, listingId: listing.id, startAt: range.startAt, endAt: range.endAt, label: parsed.data.label || null },
      });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "marketplace.availability_block.created", targetType: "marketplace_availability_block",
        targetId: block.id, details: { listingId: listing.id, startAt: range.startAt.toISOString(), endAt: range.endAt.toISOString() },
      });
      return block;
    });
    return NextResponse.json({ block: result }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "LISTING_NOT_FOUND") return NextResponse.json({ error: "Marketplace listing not found in this workspace." }, { status: 404 });
    if (code === "BLOCK_OVERLAP") return NextResponse.json({ error: "This date range overlaps an existing availability block." }, { status: 409 });
    if (code === "OPERATIONAL_CONFLICT") return NextResponse.json({ error: "These dates overlap an existing booking or maintenance period." }, { status: 409 });
    console.error("Marketplace availability block creation failed", error);
    return NextResponse.json({ error: "Unable to save availability block." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage Marketplace inquiries." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = typeof body?.status === "string" ? body.status : "";
  const hostNote = typeof body?.hostNote === "string" ? body.hostNote.trim().slice(0, 1500) : "";
  if (!id || !isMarketplaceInquiryStatus(status)) return NextResponse.json({ error: "Choose a valid inquiry and status." }, { status: 400 });

  const existing = await prisma.marketplaceBookingInquiry.findFirst({
    where: { id, tenantId: access.tenant.id },
    select: { id: true, status: true, listingId: true },
  });
  if (!existing) return NextResponse.json({ error: "Renter inquiry not found." }, { status: 404 });
  const updated = await prisma.$transaction(async (tx) => {
    const inquiry = await tx.marketplaceBookingInquiry.update({
      where: { id },
      data: { status, hostNote: hostNote || null, reviewedAt: new Date() },
      select: { id: true, status: true, reviewedAt: true, hostNote: true },
    });
    await recordWorkspaceAudit(tx, {
      tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
      action: "marketplace.inquiry.updated", targetType: "marketplace_booking_inquiry",
      targetId: id, details: { from: existing.status, to: status, listingId: existing.listingId },
    });
    return inquiry;
  });
  return NextResponse.json({ inquiry: updated });
}
