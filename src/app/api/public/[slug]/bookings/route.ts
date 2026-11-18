import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rentalDateTimeToUtc } from "@/lib/datetime";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const reservingStatuses = ["PENDING", "CONFIRMED", "ACTIVE"] as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, phone: true, currency: true, timezone: true, status: true },
  });
  if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) {
    return NextResponse.json({ error: "Rental business not found." }, { status: 404 });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { tenantId: tenant.id, status: "AVAILABLE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, make: true, model: true, year: true, color: true,
      seats: true, transmission: true, dailyRate: true, securityDeposit: true,
      branch: { select: { name: true, address: true } },
    },
  });

  return NextResponse.json({
    business: { name: tenant.name, phone: tenant.phone, currency: tenant.currency, timezone: tenant.timezone },
    vehicles: vehic¶»§q«^