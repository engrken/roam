import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { isMarketplaceReviewStatus } from "@/lib/marketplace-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });

  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const statusParam = request.nextUrl.searchParams.get("status") || "";
  const statuses = ["SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION", "PREQUALIFIED", "DECLINED", "SUSPENDED"];
  const where: Prisma.MarketplaceHostProfileWhereInput = {};
  if (statuses.includes(statusParam)) where.status = statusParam as "SUBMITTED" | "IN_REVIEW" | "NEEDS_INFORMATION" | "PREQUALIFIED" | "DECLINED" | "SUSPENDED";
  if (query) where.OR = [
    { displayName: { contains: query, mode: "insensitive" } },
    { email: { contains: query, mode: "insensitive" } },
    { city: { contains: query, mode: "insensitive" } },
    { province: { contains: query, mode: "insensitive" } },
    { tenant: { is: { name: { contains: query, mode: "insensitive" } } } },
  ];

  const profiles = await prisma.marketplaceHostProfile.findMany({
    where,
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      tenant: {
        select: {
          id: true, name: true, slug: true, email: true, phone: true,
          memberships: { where: { role: "OWNER" }, take: 1, include: { user: { select: { name: true, email: true } } } },
        },
      },
      listings: {
        orderBy: { createdAt: "desc" },
        include: {
          vehicle: {
            select: { id: true, type: true, make: true, model: true, year: true, dailyRate: true, status: true, branch: { select: { name: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json({ profiles: profiles.map((profile) => ({
    id: profile.id, tenantId: profile.tenantId, providerType: profile.providerType,
    displayName: profile.displayName, description: profile.description, email: profile.email,
    phone: profile.phone, city: profile.city, province: profile.province,
    status: profile.status, submittedAt: profile.submittedAt, reviewedAt: profile.reviewedAt,
    internalNotes: profile.internalNotes, hostMessage: profile.hostMessage, createdAt: profile.createdAt,
    tenant: {
      id: profile.tenant.id, name: profile.tenant.name, slug: profile.tenant.slug,
      email: profile.tenant.email, phone: profile.tenant.phone,
      owner: profile.tenant.memberships[0] ? {
        name: profile.tenant.memberships[0].user.name,
        email: profile.tenant.memberships[0].user.email,
      } : null,
    },
    listings: profile.listings.map((listing) => ({
      id: listing.id, headline: listing.headline, description: listing.description,
      status: listing.status, submittedAt: listing.submittedAt, reviewedAt: listing.reviewedAt,
      internalNotes: listing.internalNotes, hostMessage: listing.hostMessage,
      vehicle: {
        id: listing.vehicle.id, type: listing.vehicle.type, make: listing.vehicle.make,
        model: listing.vehicle.model, year: listing.vehicle.year,
        dailyRate: Number(listing.vehicle.dailyRate), status: listing.vehicle.status,
        branchName: listing.vehicle.branch?.name || "Unassigned",
      },
    })),
  })) });
}

export async function PATCH(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const entityType = body?.entityType;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = body?.status;
  const internalNotes = typeof body?.internalNotes === "string" ? body.internalNotes.trim().slice(0, 3000) : "";
  const hostMessage = typeof body?.hostMessage === "string" ? body.hostMessage.trim().slice(0, 1500) : "";
  if (!id || !["HOST_PROFILE", "LISTING"].includes(entityType) || !isMarketplaceReviewStatus(status)) {
    return NextResponse.json({ error: "Choose a valid marketplace record and review status." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (entityType === "HOST_PROFILE") {
        const previous = await tx.marketplaceHostProfile.findUnique({ where: { id }, select: { id: true, tenantId: true, status: true } });
        if (!previous) throw new Error("MARKETPLACE_RECORD_NOT_FOUND");
        const updated = await tx.marketplaceHostProfile.update({
          where: { id },
          data: {
            status, reviewedAt: status === "IN_REVIEW" ? null : new Date(),
            ...(Object.prototype.hasOwnProperty.call(body, "internalNotes") ? { internalNotes: internalNotes || null } : {}),
            ...(Object.prototype.hasOwnProperty.call(body, "hostMessage") ? { hostMessage: hostMessage || null } : {}),
          },
        });
        if (status === "DECLINED" || status === "SUSPENDED") {
          await tx.marketplaceListing.updateMany({
            where: { tenantId: previous.tenantId, status: { notIn: ["DECLINED", "SUSPENDED"] } },
            data: { status, reviewedAt: new Date(), hostMessage: hostMessage || "Marketplace listing review is paused because the host profile is not eligible to proceed." },
          });
        }
        await tx.platformAuditLog.create({
          data: {
            actorUserId: admin.id, actorEmail: admin.email,
            action: "marketplace.host_profile.reviewed", entityType: "marketplace_host_profile",
            entityId: id, details: { from: previous.status, to: status },
          },
        });
        return { entityType, id: updated.id, status: updated.status };
      }

      const previous = await tx.marketplaceListing.findUnique({
        where: { id },
        select: { id: true, tenantId: true, status: true, hostProfile: { select: { status: true } } },
      });
      if (!previous) throw new Error("MARKETPLACE_RECORD_NOT_FOUND");
      if (previous.hostProfile.status === "SUSPENDED" || previous.hostProfile.status === "DECLINED") {
        throw new Error("HOST_PROFILE_BLOCKED");
      }
      const updated = await tx.marketplaceListing.update({
        where: { id },
        data: {
          status, reviewedAt: status === "IN_REVIEW" ? null : new Date(),
          ...(Object.prototype.hasOwnProperty.call(body, "internalNotes") ? { internalNotes: internalNotes || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "hostMessage") ? { hostMessage: hostMessage || null } : {}),
        },
      });
      await tx.platformAuditLog.create({
        data: {
          actorUserId: admin.id, actorEmail: admin.email,
          action: "marketplace.listing.reviewed", entityType: "marketplace_listing",
          entityId: id, details: { from: previous.status, to: status },
        },
      });
      return { entityType, id: updated.id, status: updated.status };
    });
    return NextResponse.json({ record: result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "MARKETPLACE_RECORD_NOT_FOUND") return NextResponse.json({ error: "Marketplace record not found." }, { status: 404 });
    if (code === "HOST_PROFILE_BLOCKED") return NextResponse.json({ error: "This Host profile is declined or suspended. Resolve the Host profile first." }, { status: 409 });
    console.error("Marketplace host review update failed", error);
    return NextResponse.json({ error: "Unable to update marketplace review status." }, { status: 500 });
  }
}
