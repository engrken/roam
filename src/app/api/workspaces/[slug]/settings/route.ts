import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, workspaceWriteBlock, canManageWorkspaceSettings } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  const tenant = await prisma.tenant.findUnique({ where: { id: access.tenant.id }, select: { name: true, email: true, phone: true, timezone: true, currency: true } });
  return NextResponse.json({ tenant, role: access.role });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 403 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!canManageWorkspaceSettings(access.role)) return NextResponse.json({ error: "Only workspace owners and administrators can edit business settings." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const timezone = typeof body?.timezone === "string" ? body.timezone.trim() : "";
  const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "";
  if (!name || name.length > 120) return NextResponse.json({ error: "Business name is required and must be 120 characters or fewer." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid business email address." }, { status: 400 });
  if (phone.length > 40) return NextResponse.json({ error: "Phone number must be 40 characters or fewer." }, { status: 400 });
  if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: "Currency must be a three-letter ISO currency code." }, { status: 400 });
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }); }
  catch { return NextResponse.json({ error: "Choose a valid IANA time zone." }, { status: 400 }); }
  if (timezone.length > 80) return NextResponse.json({ error: "Time zone is too long." }, { status: 400 });
  const tenant = await prisma.tenant.update({ where: { id: access.tenant.id }, data: { name, email, phone: phone || null, timezone, currency }, select: { name: true, email: true, phone: true, timezone: true, currency: true } });
  return NextResponse.json({ tenant });
}
