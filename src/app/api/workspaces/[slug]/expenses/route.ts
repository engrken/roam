import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantAccess, canManageFleet, workspaceWriteBlock } from "@/lib/tenant-access";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

export const runtime = "nodejs";
const categories = ["FUEL", "MAINTENANCE", "INSURANCE", "REGISTRATION", "SALARIES", "UTILITIES", "RENT", "SUPPLIES", "MARKETING", "OTHER"];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to view operating expenses." }, { status: 403 });
  const expenses = await prisma.operatingExpense.findMany({
    where: { tenantId: access.tenant.id }, include: { branch: { select: { name: true } }, vehicle: { select: { make: true, model: true, plateNumber: true } } },
    orderBy: { incurredAt: "desc" }, take: 500,
  });
  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  return NextResponse.json({ expenses: expenses.map((e) => ({ ...e, amount: Number(e.amount) })), total });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const blocked = workspaceWriteBlock(access);
  if (blocked) return blocked;
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You do not have permission to record expenses." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const category = typeof body?.category === "string" ? body.category : "";
  const description = typeof body?.description === "string" ? body.description.trim().slice(0, 240) : "";
  const amount = Number(body?.amount), incurredAt = body?.incurredAt ? new Date(body.incurredAt) : new Date();
  if (!categories.includes(category) || !description || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(incurredAt.getTime())) {
    return NextResponse.json({ error: "Enter a valid category, description, positive amount, and date." }, { status: 400 });
  }
  const branchId = typeof body.branchId === "string" && body.branchId ? body.branchId : null;
  const vehicleId = typeof body.vehicleId === "string" && body.vehicleId ? body.vehicleId : null;
  const [branch, vehicle] = await Promise.all([
    branchId ? prisma.branch.findFirst({ where: { id: branchId, tenantId: access.tenant.id }, select: { id: true } }) : null,
    vehicleId ? prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: access.tenant.id }, select: { id: true } }) : null,
  ]);
  if ((branchId && !branch) || (vehicleId && !vehicle)) return NextResponse.json({ error: "Branch or vehicle is not part of this workspace." }, { status: 400 });
  const expense = await prisma.$transaction(async tx => {
    const created = await tx.operatingExpense.create({ data: {
      tenantId: access.tenant.id, branchId, vehicleId, category, description, amount,
      currency: access.tenant.currency || "PHP", incurredAt,
      reference: typeof body.reference === "string" ? body.reference.trim().slice(0, 120) : null,
    } });
    await recordWorkspaceAudit(tx, {
      tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
      action: "expense.recorded", targetType: "operatingExpense", targetId: created.id,
      details: { category, amount, currency: access.tenant.currency || "PHP", branchId, vehicleId },
    });
    return created;
  });
  return NextResponse.json({ expense: { ...expense, amount: Number(expense.amount) } }, { status: 201 });
}
