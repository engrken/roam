import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageWorkspaceSettings, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const METHODS = ["GCASH", "MAYA", "QRPH", "BANK_TRANSFER", "CASH"];
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) || null : null;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageWorkspaceSettings(access.role)) return NextResponse.json({ error: "Only owners and admins can manage payment settings." }, { status: 403 });
  const methods = await prisma.tenantPaymentMethod.findMany({ where: { tenantId: access.tenant.id }, orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ methods });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageWorkspaceSettings(access.role)) return NextResponse.json({ error: "Only owners and admins can update payment settings." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const method = typeof body?.method === "string" ? body.method : "";
  const label = clean(body?.label, 80);
  const accountNumber = clean(body?.accountNumber, 100);
  const accountName = clean(body?.accountName, 120);
  const bankName = clean(body?.bankName, 100);
  const instructions = clean(body?.instructions, 1000);
  const qrImageData = typeof body?.qrImageData === "string" ? body.qrImageData : null;
  const qrContentType = typeof body?.qrContentType === "string" ? body.qrContentType : null;
  const enabled = body?.enabled === true;
  if (!METHODS.includes(method) || !label) return NextResponse.json({ error: "Choose a supported payment method and enter its display name." }, { status: 400 });
  if (method !== "CASH" && enabled && !accountNumber && !qrImageData) return NextResponse.json({ error: "Add an account number or QR image before enabling this method." }, { status: 400 });
  if (qrImageData && (!/^data:image\/(png|jpeg|webp);base64,/.test(qrImageData) || qrImageData.length > 2800000 || !["image/png","image/jpeg","image/webp"].includes(qrContentType || ""))) {
    return NextResponse.json({ error: "Payment QR must be PNG, JPG or WebP and no larger than 2 MB." }, { status: 400 });
  }
  const methodRow = await prisma.tenantPaymentMethod.upsert({
    where: { tenantId_method: { tenantId: access.tenant.id, method } },
    create: { tenantId: access.tenant.id, method, label, accountName, accountNumber, bankName, instructions, qrImageData, qrContentType, enabled },
    update: { label, accountName, accountNumber, bankName, instructions, ...(qrImageData ? { qrImageData, qrContentType } : {}), enabled },
  });
  await prisma.$transaction(tx => recordWorkspaceAudit(tx, {
    tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
    action: "rental_payment_method.updated", targetType: "tenantPaymentMethod", targetId: methodRow.id,
    details: { method, enabled, accountNumberChanged: !!accountNumber, qrUpdated: !!qrImageData },
  }));
  return NextResponse.json({ saved: true, method: { id: methodRow.id, method: methodRow.method, enabled: methodRow.enabled } }, { status: 200 });
}
