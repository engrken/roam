import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { rentalTerms: true } });
  return NextResponse.json({ rentalTerms: tenant?.rentalTerms || "" });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "Only workspace owners, admins or managers can edit rental terms." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const rentalTerms = typeof body?.rentalTerms === "string" ? body.rentalTerms.trim() : "";
  if (rentalTerms.length > 12000) return NextResponse.json({ error: "Rental terms must be 12,000 characters or fewer." }, { status: 400 });
  await prisma.tenant.update({ where: { id: access.tenant.id }, data: { rentalTerms: rentalTerms || null } });
  return NextResponse.json({ ok: true, rentalTerms });
}
