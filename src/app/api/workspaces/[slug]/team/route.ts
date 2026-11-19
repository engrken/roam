import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canManageTeam(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

function allowedRoles(actorRole: string) {
  return actorRole === "OWNER" ? ["ADMIN", "MANAGER", "STAFF"] : ["MANAGER", "STAFF"];
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageTeam(access.role)) return NextResponse.json({ error: "Only workspace owners and admins can manage team access." }, { status: 403 });

  const [memberships, subscription] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId: access.tenant.id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, include: { plan: { select: { name: true, maxStaff: true } } } }),
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
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageTeam(access.role)) return NextResponse.json({ error: "Only workspace owners and admins can add team members." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "STAFF";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !allowedRoles(access.role).includes(role)) {
    return NextResponse.json({ error: "Enter an existing ROAM account email and a role you are allowed to assign." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true } });
  if (!user) return NextResponse.json({ error: "No ROAM account exists for that email. Ask the person to register before adding them." }, { status: 404 });

  const [existing, subscription, memberCount] = await Promise.all([
    prisma.membership.findUnique({ where: { tenantId_userId: { tenantId: access.tenant.id, userId: user.id } } }),
    prisma.subscription.findUnique({ where: { tenantId: access.tenant.id }, include: { plan: { select: { name: true, maxStaff: true } } } }),
    prisma.membership.count({ where: { tenantId: access.tenant.id } }),
  ]);
  if (existing) return NextResponse.json({ error: "That user is already a member of this workspace." }, { status: 409 });
  if (subscription?.plan.maxStaff != null && memberCount >= subscription.plan.maxStaff) {
    return NextResponse.json({ error: `Your ${subscription.plan.name} plan allows ${subscription.plan.maxStaff} workspace members. Upgrade your plan to add another member.` }, { status: 403 });
  }

  const membership = await prisma.membership.create({
    data: { tenantId: access.tenant.id, userId: user.id, role },
  });
  return NextResponse.json({
    member: { id: membership.id, userId: user.id, email: user.email, name: user.name, role: membership.role, joinedAt: membership.createdAt },
  }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
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

  const membership = await prisma.membership.update({ where: { id: membershipId }, data: { role } });
  return NextResponse.json({ member: { id: membership.id, role: membership.role } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageTeam(access.role)) return NextResponse.json({ error: "Only workspace owners and admins can remove team members." }, { status: 403 });

  const membershipId = request.nextUrl.searchParams.get("membershipId") || "";
  if (!membershipId) return NextResponse.json({ error: "A team member is required." }, { status: 400 });
  const target = await prisma.membership.findFirst({ where: { id: membershipId, tenantId: access.tenant.id } });
  if (!target) return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  if (target.role === "OWNER" || (access.role === "ADMIN" && target.role === "ADMIN")) {
    return NextResponse.json({ error: "You do not have permission to remove this member." }, { status: 403 });
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  return NextResponse.json({ removed: true });
}
