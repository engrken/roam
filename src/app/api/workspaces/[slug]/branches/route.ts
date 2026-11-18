import { NextResponse } from "next/server";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const branches = await prisma.branch.findMany({ where: { tenantId: access.tenant.id, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, code: true } });
  return NextResponse.json({ branches });
}
