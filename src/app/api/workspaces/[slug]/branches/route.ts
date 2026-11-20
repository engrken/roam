import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet, hasWorkspaceTier, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

async function getBranchLimit(tenantId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { tenantId }, select: { plan: { select: { maxBranches: true } } } });
  return subscription?.plan.maxBranches ?? null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BranchBody = { id?: unknown; name?: unknown; code?: unknown; address?: unknown; isActive?: unknown };

function parseBranch(body: BranchBody) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (name.length < 2 || name.length > 100 || code.length > 20 || address.length > 250) return null;
  return { name, code: code || null, address: address || null };
}

async function canDeactivate(tenantId: string, branchId: string) {
  const [activeVehicles, activeBookings] = await Promise.all([
    prisma.vehicle.count({ where: { tenantId, branchId, status: { not: "INACTIVE" } } }),
    prisma.booking.count({
      where: {
        tenantId, branchId, status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
        endAt: { gt: new Date() },
      },
    }),
  ]);
  return activeVehicles === 0 && activeBookings === 0;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  if (!await hasWorkspaceTier(access.tenant.id, "PRO")) return NextResponse.json({ error: "Branch management is available on the Pro plan and above. Upgrade your workspace to continue." }, { status: 403 });

  const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "1";
  const branches = await prisma.branch.findMany({
    where: { tenantId: access.tenant.id, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, code: true, address: true, isActive: true, createdAt: true },
  });
  return NextResponse.json({ branches, canManage: canManageFleet(access.role) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!await hasWorkspaceTier(access.tenant.id, "PRO")) return NextResponse.json({ error: "Branch management is available on the Pro plan and above. Upgrade your workspace to continue." }, { status: 403 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot manage branches." }, { status: 403 });

  const body = await request.json().catch(() => null) as BranchBody | null;
  const parsed = body && parseBranch(body);
  if (!parsed) return NextResponse.json({ error: "Enter a valid branch name, code, and address." }, { status: 400 });

  try {
    const branch = await prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe("SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1))) AS advisory_lock", "branch-limit:" + access.tenant.id);
      const limit = await getBranchLimit(access.tenant.id);
      const activeCount = await tx.branch.count({ where: { tenantId: access.tenant.id, isActive: true } });
      if (limit !== null && activeCount >= limit) return null;
      return tx.branch.create({
        data: { tenantId: access.tenant.id, ...parsed },
        select: { id: true, name: true, code: true, address: true, isActive: true, createdAt: true },
      });
    });
    if (!branch) return NextResponse.json({ error: "Your current plan has reached its active branch limit. Upgrade your workspace or deactivate an existing branch to continue.", code: "BRANCH_LIMIT_REACHED" }, { status: 409 });
    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That branch code is already in use in this workspace." }, { status: 409 });
    }
    console.error("Branch creation failed", error);
    return NextResponse.json({ error: "Unable to create the branch right now." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!await hasWorkspaceTier(access.tenant.id, "PRO")) return NextResponse.json({ error: "Branch management is available on the Pro plan and above. Upgrade your workspace to continue." }, { status: 403 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot manage branches." }, { status: 403 });

  const body = await request.json().catch(() => null) as BranchBody | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "A branch ID is required." }, { status: 400 });

  const existing = await prisma.branch.findFirst({
    where: { id, tenantId: access.tenant.id },
    select: { id: true, isActive: true },
  });
  if (!existing) return NextResponse.json({ error: "Branch not found." }, { status: 404 });

  const data: { name?: string; code?: string | null; address?: string | null; isActive?: boolean } = {};
  if (body?.name !== undefined || body?.code !== undefined || body?.address !== undefined) {
    const parsed = body && parseBranch(body);
    if (!parsed) return NextResponse.json({ error: "Enter a valid branch name, code, and address." }, { status: 400 });
    Object.assign(data, parsed);
  }
  if (typeof body?.isActive === "boolean") {
    if (!body.isActive && existing.isActive && !(await canDeactivate(access.tenant.id, id))) {
      return NextResponse.json({
        error: "Move or deactivate this branch's vehicles and resolve its upcoming bookings before deactivating it.",
      }, { status: 409 });
    }
    data.isActive = body.isActive;
  }

  try {
    const branch = await prisma.$transaction(async tx => {
      if (data.isActive === true && !existing.isActive) {
        await tx.$queryRawUnsafe("SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1))) AS advisory_lock", "branch-limit:" + access.tenant.id);
        const limit = await getBranchLimit(access.tenant.id);
        const activeCount = await tx.branch.count({ where: { tenantId: access.tenant.id, isActive: true } });
        if (limit !== null && activeCount >= limit) return null;
      }
      return tx.branch.update({ where: { id }, data, select: { id: true, name: true, code: true, address: true, isActive: true, createdAt: true } });
    });
    if (!branch) return NextResponse.json({ error: "Your current plan has reached its active branch limit. Upgrade your workspace or deactivate an existing branch to continue.", code: "BRANCH_LIMIT_REACHED" }, { status: 409 });
    return NextResponse.json({ branch });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "That branch code is already in use in this workspace." }, { status: 409 });
    }
    console.error("Branch update failed", error);
    return NextResponse.json({ error: "Unable to update the branch right now." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!await hasWorkspaceTier(access.tenant.id, "PRO")) return NextResponse.json({ error: "Branch management is available on the Pro plan and above. Upgrade your workspace to continue." }, { status: 403 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot manage branches." }, { status: 403 });

  const id = request.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "A branch ID is required." }, { status: 400 });
  const existing = await prisma.branch.findFirst({
    where: { id, tenantId: access.tenant.id },
    select: { id: true, isActive: true },
  });
  if (!existing) return NextResponse.json({ error: "Branch not found." }, { status: 404 });
  if (!existing.isActive) return NextResponse.json({ deactivated: true });

  if (!(await canDeactivate(access.tenant.id, id))) {
    return NextResponse.json({
      error: "Move or deactivate this branch's vehicles and resolve its upcoming bookings before deactivating it.",
    }, { status: 409 });
  }

  await prisma.branch.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ deactivated: true });
}
