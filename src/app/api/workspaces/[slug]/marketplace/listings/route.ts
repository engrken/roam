import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";
import { canEditMarketplaceStatus, canSubmitMarketplaceListing, marketplaceListingSchema } from "@/lib/marketplace-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage marketplace vehicle drafts." }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (body?.action === "SUBMIT_LISTING") {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "Listing ID is required." }, { status: 400 });
    try {
      const result = await prisma.$transaction(async (tx) => {
        const profile = await tx.marketplaceHostProfile.findUnique({ where: { tenantId: access.tenant.id }, select: { id: true, status: true } });
        if (!profile || !canSubmitMarketplaceListing(profile.status)) throw new Error("HOST_PROFILE_NOT_SUBMITTED");
        const listing = await tx.marketplaceListing.findFirst({
          where: { id, tenantId: access.tenant.id },
          include: { vehicle: { select: { status: true } } },
        });
        if (!listing) throw new Error("LISTING_NOT_FOUND");
        if (!canEditMarketplaceStatus(listing.status)) throw new Error("LISTING_ALREADY_SUBMITTED");
        if (listing.vehicle.status !== "AVAILABLE") throw new Error("VEHICLE_NOT_AVAILABLE");
        const submitted = await tx.marketplaceListing.update({
          where: { id: listing.id },
          data: { status: "SUBMITTED", submittedAt: new Date(), reviewedAt: null, internalNotes: null, hostMessage: null },
        });
        await recordWorkspaceAudit(tx, {
          tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
          action: "marketplace.listing.submitted", targetType: "marketplace_listing",
          targetId: listing.id, details: { vehicleId: listing.vehicleId, status: "SUBMITTED" },
        });
        return submitted;
      });
      return NextResponse.json({ listing: { id: result.id, status: result.status, submittedAt: result.submittedAt } });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "HOST_PROFILE_NOT_SUBMITTED") return NextResponse.json({ error: "Submit your host profile before submitting vehicle listings." }, { status: 409 });
      if (code === "LISTING_NOT_FOUND") return NextResponse.json({ error: "Marketplace listing not found." }, { status: 404 });
      if (code === "LISTING_ALREADY_SUBMITTED") return NextResponse.json({ error: "This listing is already in the review process." }, { status: 409 });
      if (code === "VEHICLE_NOT_AVAILABLE") return NextResponse.json({ error: "Only vehicles currently marked available can be submitted." }, { status: 409 });
      console.error("Marketplace listing submission failed", error);
      return NextResponse.json({ error: "Unable to submit marketplace listing." }, { status: 500 });
    }
  }

  const parsed = marketplaceListingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid vehicle, listing title, and optional description." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.marketplaceHostProfile.findUnique({ where: { tenantId: access.tenant.id }, select: { id: true, status: true } });
      if (!profile) throw new Error("HOST_PROFILE_REQUIRED");
      if (profile.status === "SUSPENDED" || profile.status === "DECLINED") throw new Error("HOST_PROFILE_BLOCKED");
      const vehicle = await tx.vehicle.findFirst({
        where: { id: parsed.data.vehicleId, tenantId: access.tenant.id, status: "AVAILABLE", marketplaceListing: null },
        select: { id: true, make: true, model: true },
      });
      if (!vehicle) throw new Error("VEHICLE_NOT_ELIGIBLE");
      const listing = await tx.marketplaceListing.create({
        data: {
          tenantId: access.tenant.id, hostProfileId: profile.id, vehicleId: vehicle.id,
          headline: parsed.data.headline, description: parsed.data.description || null,
        },
      });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "marketplace.listing.created", targetType: "marketplace_listing",
        targetId: listing.id, details: { vehicleId: vehicle.id, status: listing.status },
      });
      return listing;
    });
    return NextResponse.json({ listing: { id: result.id, headline: result.headline, status: result.status } }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "HOST_PROFILE_REQUIRED") return NextResponse.json({ error: "Create your host profile before adding marketplace vehicles." }, { status: 409 });
    if (code === "HOST_PROFILE_BLOCKED") return NextResponse.json({ error: "Your host profile cannot submit listings. Contact ROAM support if you need assistance." }, { status: 403 });
    if (code === "VEHICLE_NOT_ELIGIBLE") return NextResponse.json({ error: "Choose an available vehicle in this workspace that has not already been submitted." }, { status: 400 });
    console.error("Marketplace listing creation failed", error);
    return NextResponse.json({ error: "Unable to create marketplace listing. The vehicle may already have a listing." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to manage marketplace vehicle drafts." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "Listing ID is required." }, { status: 400 });
  const parsed = marketplaceListingSchema.omit({ vehicleId: true }).safeParse({
    headline: body?.headline,
    description: body?.description,
  });
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid listing title and optional description." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.marketplaceListing.findFirst({
        where: { id, tenantId: access.tenant.id },
        include: { hostProfile: { select: { status: true } } },
      });
      if (!existing) throw new Error("LISTING_NOT_FOUND");
      if (existing.hostProfile.status === "SUSPENDED" || existing.hostProfile.status === "DECLINED") throw new Error("HOST_PROFILE_BLOCKED");
      if (!canEditMarketplaceStatus(existing.status)) throw new Error("LISTING_NOT_EDITABLE");
      const updated = await tx.marketplaceListing.update({
        where: { id: existing.id },
        data: {
          headline: parsed.data.headline,
          description: parsed.data.description || null,
          status: "DRAFT", isPublished: false, submittedAt: null, reviewedAt: null, internalNotes: null,
          hostMessage: "Listing details changed. Please review and submit this listing again.",
        },
      });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "marketplace.listing.updated", targetType: "marketplace_listing",
        targetId: existing.id, details: { status: "DRAFT" },
      });
      return updated;
    });
    return NextResponse.json({ listing: { id: result.id, headline: result.headline, status: result.status, hostMessage: result.hostMessage } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "LISTING_NOT_FOUND") return NextResponse.json({ error: "Marketplace listing not found." }, { status: 404 });
    if (code === "HOST_PROFILE_BLOCKED") return NextResponse.json({ error: "Your host profile cannot update listings. Contact ROAM support if you need assistance." }, { status: 403 });
    if (code === "LISTING_NOT_EDITABLE") return NextResponse.json({ error: "This listing cannot be edited while it is in review. Wait for a review update first." }, { status: 409 });
    console.error("Marketplace listing update failed", error);
    return NextResponse.json({ error: "Unable to update marketplace listing." }, { status: 500 });
  }
}
