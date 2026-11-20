import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, hasWorkspaceTier, workspaceWriteBlock, canManageTeam } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { sendTeamInvitation } from "@/lib/email";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowedRoles(actorRole: string) {
  return actorRole === "OWNER" ? ["ADMIN", "MANAGER", "STAFF"] : ["MANAGER", "STAFF"];
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!await hasWorkspaceTier(access.tenant.id, "BUSINESS")) return NextResponse.json({ error: "Team management is available on the Business plan and above. Upgrade your workspace to continue." }, { status: 403 });
  if (!canManageTeam(access.role)) return NextResponse.json({ error: "Only workspace owners and admins can manage team access." }, { status: 403 });

  const [memberships, subscription, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId: access.tenant.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, include: { plan: { select: { name: true, maxStaff: true } } } }),
    prisma.teamInvitation.findMany({
      where: { tenantId: access.tenant.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    members: memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      joinedAt: membership.createdAt,
    })),
    limits: {
      plan: subscription?.plan.name || "Current plan",
      maxMembers: subscription?.plan.maxStaff ?? null,
      currentMembers: memberships.length,
    },
    actorRole: access.role,
    invitations,
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!await hasWorkspaceTier(access.tenant.id, "BUSINESS")) return NextResponse.json({ error: "Team management is available on the Business plan and above. Upgrade your workspace to continue." }, { status: 403 });
  if (!canManageTeam(access.role)) return NextResponse.json({ error: "Only workspace owners and admins can add team members." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "STAFF";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !allowedRoles(access.role).includes(role)) {
    return NextResponse.json({ error: "Enter a valid email address and a role you are allowed to assign." }, { status: 400 });
  }

  const [user, subscription, memberCount, pendingCount, pendingInvite] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } }),
    prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, include: { plan: { select: { name: true, maxStaff: true } } } }),
    prisma.membership.count({ where: { tenantId: access.tenant.id } }),
    prisma.teamInvitation.count({ where: { tenantId: access.tenant.id, acceptedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.teamInvitation.findFirst({ where: { tenantId: access.tenant.id, email, acceptedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  if (user) {
    const existing = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId: access.tenant.id, userId: user.id } } });
    if (existing) return NextResponse.json({ error: "That user is already a member of this workspace." }, { status: 409 });
  }
  if (pendingInvite) return NextResponse.json({ error: "A valid invitation has already been sent to this email." }, { status: 409 });
  if (subscription?.plan.maxStaff != null && memberCount + pendingCount >= subscription.plan.maxStaff) {
    return NextResponse.json({ error: `Your ${subscription.plan.name} plan allows ${subscription.plan.maxStaff} workspace members, including pending invitations. Upgrade your plan to add another member.` }, { status: 403 });
  }

  if (!user) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitation = await prisma.teamInvitation.create({
      data: {
        tenantId: access.tenant.id, email, role: role as "ADMIN" | "MANAGER" | "STAFF",
        tokenHash, invitedByUserId: access.user.id, expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    try {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/$/, "");
      await sendTeamInvitation(email, access.tenant.name, role, appUrl + "/invite/" + token);
    } catch (error) {
      await prisma.teamInvitation.delete({ where: { id: invitation.id } }).catch(() => undefined);
      console.error("Team invitation email failed", error);
      return NextResponse.json({ error: "The invitation could not be emailed. Check the workspace email configuration and try again." }, { status: 503 });
    }
    await prisma.$transaction(tx => recordWorkspaceAudit(tx, {
      tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
      action: "team.invitation.created", targetType: "invitation", targetId: invitation.id,
      details: { email, role },
    }));
    return NextResponse.json({
      invitation: { id: invitation.id, email, role: invitation.role, expiresAt: invitation.expiresAt },
      invited: true,
      message: "Invitation sent. The person must sign in or create a ROAM account using this email before accepting.",
    }, { status: 201 });
  }

  try {
    const membership = await prisma.$transaction(async tx => {
      const created = await tx.membership.create({
        data: { tenantId: access.tenant.id, userId: user.id, role: role as "ADMIN" | "MANAGER" | "STAFF" },
      });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "team.member.added", targetType: "membership", targetId: created.id,
        details: { memberUserId: user.id, email: user.email, role: created.role },
      });
      return created;
    });
    return NextResponse.json({
      member: { id: membership.id, userId: user.id, email: user.email, name: user.name, role: membership.role, joinedAt: membership.createdAt },
      invited: false,
    }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That user is already a member of this workspace." }, { status: 409 });
    }
    console.error("Workspace member creation failed", error);
    return NextResponse.json({ error: "Unable to add the team member right now." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!await hasWorkspaceTier(access.tenant.id, "BUSINESS")) return NextResponse.json({ error: "Team management is available on the Business plan and above. Upgrade your workspace to continue." }, { status: 403 });
  if (!canManageTeam(access.role)) return NextResponse.json({ error: "Only workspace owners and admins can change team roles." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const membershipId = typeof body?.membershipId === "string" ? body.membershipId : "";
  const role = typeof body?.role === "string" ? body.role : "";
  if (!membershipId || !allowedRoles(access.role).includes(role)) {
    return NextResponse.json({ error: "Choose a valid member and role." }, { status: 400 });
  }

  const target = await prisma.membership.findFirst({ where: { id: membershipId, tenantId: access.tenant.id } });
  if (!target) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  if (target.role === "OWNER" || (access.role === "ADMIN" && target.role === "ADMIN")) {
    return NextResponse.json({ error: "You do not have permission to change this member's role." }, { status: 403 });
  }

  const membership = await prisma.$transaction(async tx => {
    const updated = await tx.membership.update({ where: { id: membershipId }, data: { role: role as "ADMIN" | "MANAGER" | "STAFF" } });
    await recordWorkspaceAudit(tx, {
      tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
      action: "team.member.role_changed", targetType: "membership", targetId: updated.id,
      details: { memberUserId: target.userId, fromRole: target.role, toRole: updated.role },
    });
    return updated;
  });
  return NextResponse.json({ member: { id: membership.id, role: membership.role } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!await hasWorkspaceTier(access.tenant.id, "BUSINESS")) return NextResponse.json({ error: "Team management is available on the Business plan and above. Upgrade your workspace to continue." }, { status: 403 });
  if (!canManageTeam(access.role)) return NextResponse.json({ error: "Only workspace owners and admins can remove team members." }, { status: 403 });

  const invitationId = request.nextUrl.searchParams.get("invitationId") || "";
  if (invitationId) {
    const invitation = await prisma.teamInvitation.findFirst({ where: { id: invitationId, tenantId: access.tenant.id, acceptedAt: null } });
    if (!invitation) return NextResponse.json({ error: "Pending invitation not found." }, { status: 404 });
    await prisma.$transaction(async tx => {
      await tx.teamInvitation.delete({ where: { id: invitation.id } });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "team.invitation.revoked", targetType: "invitation", targetId: invitation.id,
        details: { email: invitation.email, role: invitation.role },
      });
    });
    return NextResponse.json({ invitationRevoked: true });
  }
  const membershipId = request.nextUrl.searchParams.get("membershipId") || "";
  if (!membershipId) return NextResponse.json({ error: "A team member or invitation is required." }, { status: 400 });
  const target = await prisma.membership.findFirst({ where: { id: membershipId, tenantId: access.tenant.id } });
  if (!target) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  if (target.role === "OWNER" || (access.role === "ADMIN" && target.role === "ADMIN")) {
    return NextResponse.json({ error: "You do not have permission to remove this member." }, { status: 403 });
  }

  await prisma.$transaction(async tx => {
    await tx.membership.delete({ where: { id: membershipId } });
    await recordWorkspaceAudit(tx, {
      tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
      action: "team.member.removed", targetType: "membership", targetId: membershipId,
      details: { memberUserId: target.userId, role: target.role },
    });
  });
  return NextResponse.json({ removed: true });
}
