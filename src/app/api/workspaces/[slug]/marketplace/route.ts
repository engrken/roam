import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageWorkspaceSettings, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";
import { canEditMarketplaceStatus, marketplaceHostProfileSchema } from "@/lib/marketplace-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });

  const [profile, vehicles, workspace, notifications] = await Promise.all([
    prisma.marketplaceHostProfile.findUnique({
      where: { tenantId: access.tenant.id },
      include: {
        listings: {
          orderBy: { createdAt: "desc" },
          include: {
            vehicle: {
              select: {
                id: true, type: true, make: true, model: true, year: true, color: true,
                dailyRate: true, status: true, branch: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.vehicle.findMany({
      where: { tenantId: access.tenant.id, status: "AVAILABLE" },
      orderBy: [{ createdAt: "desc" }],
      include: { branch: { select: { name: true } }, marketplaceListing: { select: { id: true } } },
    }),
    prisma.tenant.findUnique({ where: { id: access.tenant.id }, select: { name: true, email: true, phone: true } }),
    prisma.marketplaceHostNotification.findMany({
      where: { tenantId: access.tenant.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, targetType: true, status: true, title: true, message: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    role: access.role,
    workspace: { name: workspace?.name || "", email: workspace?.email || "", phone: workspace?.phone || "" },
    notifications,
    profile: profile ? {
      id: profile.id, providerType: profile.providerType, displayName: profile.displayName,
      description: profile.description, email: profile.email, phone: profile.phone,
      city: profile.city, province: profile.province, status: profile.status,
      submittedAt: profile.submittedAt, reviewedAt: profile.reviewedAt,
      hostMessage: profile.hostMessage, createdAt: profile.createdAt, updatedAt: profile.updatedAt,
      listings: profile.listings.map((listing) => ({
        id: listing.id, headline: listing.headline, description: listing.description,
        status: listing.status, submittedAt: listing.submittedAt, hostMessage: listing.hostMessage,
        vehicle: {
          id: listing.vehicle.id, type: listing.vehicle.type, make: listing.vehicle.make,
          model: listing.vehicle.model, year: listing.vehicle.year, color: listing.vehicle.color,
          dailyRate: Number(listing.vehicle.dailyRate), status: listing.vehicle.status,
          branchName: listing.vehicle.branch?.name || "Unassigned",
        },
      })),
    } : null,
    eligibleVehicles: vehicles.filter((vehicle) => !vehicle.marketplaceListing).map((vehicle) => ({
      id: vehicle.id, type: vehicle.type, make: vehicle.make, model: vehicle.model,
      year: vehicle.year, dailyRate: Number(vehicle.dailyRate),
      branchName: vehicle.branch?.name || "Unassigned",
    })),
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!canManageWorkspaceSettings(access.role)) {
    return NextResponse.json({ error: "Only workspace owners and administrators can manage marketplace host details." }, { status: 403 });
  }

  const parsed = marketplaceHostProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid host type, display name, email, city, and optional contact details." }, { status: 400 });

  const data = {
    providerType: parsed.data.providerType,
    displayName: parsed.data.displayName,
    description: parsed.data.description || null,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    city: parsed.data.city,
    province: parsed.data.province || null,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.marketplaceHostProfile.findUnique({ where: { tenantId: access.tenant.id } });
      if (existing?.status === "SUSPENDED") throw new Error("HOST_PROFILE_SUSPENDED");
      const changed = !existing || Object.keys(data).some((key) =>
        existing[key as keyof typeof existing] !== data[key as keyof typeof data]
      );
      const profile = existing
        ? await tx.marketplaceHostProfile.update({
            where: { id: existing.id },
            data: changed ? {
              ...data, status: "DRAFT", isPublished: false, submittedAt: null, reviewedAt: null,
              internalNotes: null, hostMessage: "Your profile details changed. Please review and submit them again.",
            } : data,
          })
        : await tx.marketplaceHostProfile.create({ data: { tenantId: access.tenant.id, ...data } });

      if (changed && existing) {
        await tx.marketplaceListing.updateMany({
          where: { tenantId: access.tenant.id, status: { in: ["SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION", "PREQUALIFIED"] } },
          data: {
            status: "DRAFT", isPublished: false, submittedAt: null, reviewedAt: null, internalNotes: null,
            hostMessage: "The host profile changed. Please review and resubmit this listing.",
          },
        });
      }
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "marketplace.host_profile.saved", targetType: "marketplace_host_profile",
        targetId: profile.id, details: { status: profile.status, changed },
      });
      return profile;
    });
    return NextResponse.json({ profile: {
      id: result.id, providerType: result.providerType, displayName: result.displayName,
      description: result.description, email: result.email, phone: result.phone,
      city: result.city, province: result.province, status: result.status, hostMessage: result.hostMessage,
    } });
  } catch (error) {
    if (error instanceof Error && error.message === "HOST_PROFILE_SUSPENDED") {
      return NextResponse.json({ error: "This host profile is suspended. Contact ROAM support for assistance." }, { status: 403 });
    }
    console.error("Marketplace host profile save failed", error);
    return NextResponse.json({ error: "Unable to save marketplace host details." }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!canManageWorkspaceSettings(access.role)) {
    return NextResponse.json({ error: "Only workspace owners and administrators can submit the host profile." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (body?.action !== "SUBMIT_PROFILE") return NextResponse.json({ error: "Choose a valid marketplace action." }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.marketplaceHostProfile.findUnique({ where: { tenantId: access.tenant.id } });
      if (!profile) throw new Error("HOST_PROFILE_REQUIRED");
      if (profile.status === "SUSPENDED") throw new Error("HOST_PROFILE_SUSPENDED");
      if (!canEditMarketplaceStatus(profile.status)) throw new Error("HOST_PROFILE_ALREADY_SUBMITTED");
      const submitted = await tx.marketplaceHostProfile.update({
        where: { id: profile.id },
        data: { status: "SUBMITTED", submittedAt: new Date(), reviewedAt: null, internalNotes: null, hostMessage: null },
      });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "marketplace.host_profile.submitted", targetType: "marketplace_host_profile",
        targetId: profile.id, details: { status: "SUBMITTED" },
      });
      return submitted;
    });
    return NextResponse.json({ profile: { id: result.id, status: result.status, submittedAt: result.submittedAt } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "HOST_PROFILE_REQUIRED") return NextResponse.json({ error: "Save your host profile before submitting it." }, { status: 400 });
    if (code === "HOST_PROFILE_SUSPENDED") return NextResponse.json({ error: "This host profile is suspended. Contact ROAM support for assistance." }, { status: 403 });
    if (code === "HOST_PROFILE_ALREADY_SUBMITTED") return NextResponse.json({ error: "Your host profile is already in the review process. Wait for an update before resubmitting." }, { status: 409 });
    console.error("Marketplace host profile submission failed", error);
    return NextResponse.json({ error: "Unable to submit marketplace host profile." }, { status: 500 });
  }
}
