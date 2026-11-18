import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const types = ["MOTORCYCLE","SCOOTER","SEDAN","HATCHBACK","SUV","MPV","VAN","PICKUP","BUS","TRUCK","OTHER"] as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or access denied." }, { status: 404 });
  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId: access.tenant.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { branch: { select: { name: true } } },
  });
  return NextResponse.json({ vehicles: vehicles.map((v) => ({
    id: v.id, type: v.type, make: v.make, model: v.model, year: v.year, plateNumber: v.plateNumber,
    color: v.color, seats: v.seats, transmission: v.transmission, dailyRate: Number(v.dailyRate),
    securityDeposit: Number(v.securityDeposit), status: v.status, notes: v.notes, branchId: v.branchId,
    branchName: v.branch?.name || "Unassigned",
  })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace not found or ¶»§q«^