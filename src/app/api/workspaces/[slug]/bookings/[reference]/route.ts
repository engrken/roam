import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reservingStatuses = ["PENDING", "CONFIRMED", "ACTIVE"] as const;

const allowedTransitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string; reference: string }> }) {
  const { slug, reference } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) {
    return NextResponse.json({ error: "You cannot view customer booking details." }, { status: 403 });
  }

  const booking = await prisma.booking.findFirst({
    where: { tenantId: access.tenant.id, reference },
    select: {
      id: true, reference: true, status: true, startAt: true, endAt: true, totalAmount: true,
      customer: { select: { name: true, email: true, phone: true } },
      items: {
        select: {
          vehicle: { select: { id: true, type: true, make: true, model: true, year: true, plateNumber: true } },
        },
      },
      messages: { orderBy: { createdAt: "asc" }¶»§q«^