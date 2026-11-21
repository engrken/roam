import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { isMarketplaceReviewStatus } from "@/lib/marketplace-host";
import {
  createMarketplaceHostNotification,
  deliverMarketplaceHostNotification,
} from "@/lib/marketplace-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statuses = ["SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION", "PREQUALIFIED", "DECLINED", "SUSPENDED"] as const;

export async function GET(request: NextRequest) {
  const admin = await getPlatformAdmin();
  if (!admin) return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });

  const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const statusParam = request.nextUrl.searchParams.get("status") || "";
  const where: Prisma.MarketplaceHostProfileWhereInput = { status: { not: "DRAFT" } };
  if (statuses.includes(statusParam as (typeof statuses)[number])) {
    where.status = statusParam as (typeof statuses)[number];
  }
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
          marketplaceHostNotifications: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, targetType: true, targetId: true, status: true, title: true, message: true, emailStatus: true, emailError: true, emailSentAt: true, createdAt: true },
          },
        },
      },
      listings: {
        where: { status: { not: "DRAFT" } },
        orderBy: { createdAt: "desc" },
        include: {
          vehicle: {
            select: { id: true, type: true, make: true, model: true, year: true, dailyRate: true, status: true, branch: { select: { name: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json({ publicationEnabled: process.env.ROAM_MARKETPLACE_PUBLIC_ENABLED === "true", profiles: profiles.map((profile) => ({
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
    notifications: profile.tenant.marketplaceHostNotifications,
    listings: profile.listings.map((listing) => ({
      id: listing.id, headline: listing.headline, description: listing.description,
      status: listing.status, isPublished: listing.isPublished, submittedAt: listing.submittedAt, reviewedAt: listing.reviewedAt,
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
  if (body?.action === "PUBLISH_LISTING" || body?.action === "UNPUBLISH_LISTING") {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "Listing ID is required." }, { status: 400 });
    const publish = body.action === "PUBLISH_LISTING";
    if (publish && process.env.ROAM_MARKETPLACE_PUBLIC_ENABLED !== "true") {
      return NextResponse.json({ error: "Public marketplace publication is disabled until launch readiness is approved." }, { status: 403 });
    }
    try {
      const result = await prisma.$transaction(async (tx) => {
        const listing = await tx.marketplaceListing.findUnique({
          where: { id },
          select: {
            id: true, isPublished: true, status: true,
            hostProfile: { select: { status: true } },
            vehicle: { select: { status: true } },
            tenant: { select: { status: true } },
          },
        });
        if (!listing) throw new Error("MARKETPLACE_RECORD_NOT_FOUND");
        if (publish && (
          listing.status !== "PREQUALIFIED"
          || listing.hostProfile.status !== "PREQUALIFIED"
          || listing.vehicle.status !== "AVAILABLE"
          || !["ACTIVE", "TRIAL"].includes(listing.tenant.status)
        )) throw new Error("LISTING_NOT_ELIGIBLE");
        const updated = await tx.marketplaceListing.update({
          where: { id },
          data: { isPublished: publish },
          select: { id: true, isPublished: true, status: true },
        });
        await tx.platformAuditLog.create({
          data: {
            actorUserId: admin.id, actorEmail: admin.email,
            action: publish ? "marketplace.listing.published" : "marketplace.listing.unpublished",
            entityType: "marketplace_listing", entityId: id,
            details: { isPublished: publish, listingStatus: listing.status },
          },
        });
        return updated;
      });
      return NextResponse.json({ listing: result });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "MARKETPLACE_RECORD_NOT_FOUND") return NextResponse.json({ error: "Marketplace listing not found." }, { status: 404 });
      if (code === "LISTING_NOT_ELIGIBLE") return NextResponse.json({ error: "Only PREQUALIFIED listings from PREQUALIFIED Hosts, available vehicles, and active workspaces can be published." }, { status: 409 });
      console.error("Marketplace listing publication update failed", error);
      return NextResponse.json({ error: "Unable to update marketplace publication." }, { status: 500 });
    }
  }
  if (body?.action === "RETRY_NOTIFICATION") {
    const notificationId = typeof body.id === "string" ? body.id.trim() : "";
    if (!notificationId) return NextResponse.json({ error: "Notification ID is required." }, { status: 400 });
    const delivered = await deliverMarketplaceHostNotification(notificationId);
    if (!delivered.found) return NextResponse.json({ error: "Host notification not found." }, { status: 404 });
    return NextResponse.json({ notification: { id: notificationId, emailStatus: delivered.emailStatus } });
  }

  const entityType = body?.entityType;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = body?.status;
  const internalNotes = typeof body?.internalNotes === "string" ? body.internalNotes.trim().slice(0, 3000) : "";
  const hasHostMessage = Object.prototype.hasOwnProperty.call(body || {}, "hostMessage");
  const hostMessage = typeof body?.hostMessage === "string" ? body.hostMessage.trim().slice(0, 1500) : "";
  if (!id || !["HOST_PROFILE", "LISTING"].includes(entityType) || !isMarketplaceReviewStatus(status)) {
    return NextResponse.json({ error: "Choose a valid marketplace record and review status." }, { status: 400 });
  }
  if (status === "NEEDS_INFORMATION" && !hostMessage) {
    return NextResponse.json({ error: "Add a clear message describing the information needed from the Host." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (entityType === "HOST_PROFILE") {
        const previous = await tx.marketplaceHostProfile.findUnique({
          where: { id },
          select: { id: true, tenantId: true, status: true, hostMessage: true },
        });
        if (!previous) throw new Error("MARKETPLACE_RECORD_NOT_FOUND");
        const updated = await tx.marketplaceHostProfile.update({
          where: { id },
          data: {
            status, reviewedAt: status === "IN_REVIEW" ? null : new Date(),
            ...(Object.prototype.hasOwnProperty.call(body, "internalNotes") ? { internalNotes: internalNotes || null } : {}),
            ...(hasHostMessage ? { hostMessage: hostMessage || null } : {}),
          },
          include: {
            tenant: { select: { slug: true } },
          },
        });
        if (previous.status !== status) {
          await tx.marketplaceListing.updateMany({
            where: { tenantId: previous.tenantId, isPublished: true },
            data: { isPublished: false },
          });
        }
        if (status === "DECLINED" || status === "SUSPENDED") {
          await tx.marketplaceListing.updateMany({
            where: { tenantId: previous.tenantId, status: { notIn: ["DECLINED", "SUSPENDED"] } },
            data: { status, isPublished: false, reviewedAt: new Date(), hostMessage: hostMessage || "Marketplace listing review is paused because the Host profile is not eligible to proceed." },
          });
        }

        const hostMessageChanged = hasHostMessage && previous.hostMessage !== updated.hostMessage;
        let notificationId: string | null = null;
        if (previous.status !== updated.status || hostMessageChanged) {
          const notification = await createMarketplaceHostNotification(tx, {
            tenantId: updated.tenantId, targetType: "HOST_PROFILE", targetId: updated.id,
            status: updated.status, recipientEmail: updated.email, recipientName: updated.displayName,
            hostMessage: updated.hostMessage,
          });
          notificationId = notification.id;
        }

        await tx.platformAuditLog.create({
          data: {
            actorUserId: admin.id, actorEmail: admin.email,
            action: "marketplace.host_profile.reviewed", entityType: "marketplace_host_profile",
            entityId: id, details: { from: previous.status, to: status, notificationQueued: !!notificationId },
          },
        });
        return { entityType, id: updated.id, status: updated.status, notificationId };
      }

      const previous = await tx.marketplaceListing.findUnique({
        where: { id },
        select: {
          id: true, tenantId: true, status: true, hostMessage: true,
          hostProfile: { select: { status: true, email: true, displayName: true } },
        },
      });
      if (!previous) throw new Error("MARKETPLACE_RECORD_NOT_FOUND");
      if (previous.hostProfile.status === "SUSPENDED" || previous.hostProfile.status === "DECLINED") {
        throw new Error("HOST_PROFILE_BLOCKED");
      }
      const updated = await tx.marketplaceListing.update({
        where: { id },
        data: {
          status, isPublished: previous.status !== status ? false : undefined, reviewedAt: status === "IN_REVIEW" ? null : new Date(),
          ...(Object.prototype.hasOwnProperty.call(body, "internalNotes") ? { internalNotes: internalNotes || null } : {}),
          ...(hasHostMessage ? { hostMessage: hostMessage || null } : {}),
        },
      });

      const hostMessageChanged = hasHostMessage && previous.hostMessage !== updated.hostMessage;
      let notificationId: string | null = null;
      if (previous.status !== updated.status || hostMessageChanged) {
        const notification = await createMarketplaceHostNotification(tx, {
          tenantId: updated.tenantId, targetType: "LISTING", targetId: updated.id,
          status: updated.status, recipientEmail: previous.hostProfile.email,
          recipientName: previous.hostProfile.displayName, hostMessage: updated.hostMessage,
        });
        notificationId = notification.id;
      }

      await tx.platformAuditLog.create({
        data: {
          actorUserId: admin.id, actorEmail: admin.email,
          action: "marketplace.listing.reviewed", entityType: "marketplace_listing",
          entityId: id, details: { from: previous.status, to: status, notificationQueued: !!notificationId },
        },
      });
      return { entityType, id: updated.id, status: updated.status, notificationId };
    });

    let emailStatus: string | null = null;
    if (result.notificationId) {
      const delivered = await deliverMarketplaceHostNotification(result.notificationId);
      emailStatus = delivered.emailStatus;
    }
    return NextResponse.json({
      record: { entityType: result.entityType, id: result.id, status: result.status },
      notification: result.notificationId ? { id: result.notificationId, emailStatus } : null,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "MARKETPLACE_RECORD_NOT_FOUND") return NextResponse.json({ error: "Marketplace record not found." }, { status: 404 });
    if (code === "HOST_PROFILE_BLOCKED") return NextResponse.json({ error: "This Host profile is declined or suspended. Resolve the Host profile first." }, { status: 409 });
    console.error("Marketplace host review update failed", error);
    return NextResponse.json({ error: "Unable to update marketplace review status." }, { status: 500 });
  }
}
