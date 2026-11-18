import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

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
  if (!access) return NextResponse.json({ error: "Workspace not found¶»§q«^