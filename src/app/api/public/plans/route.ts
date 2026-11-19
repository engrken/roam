import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { monthlyPrice: "asc" },
      select: {
        id: true,
        tier: true,
        name: true,
        monthlyPrice: true,
        maxVehicles: true,
        maxBranches: true,
        maxStaff: true,
      },
    });

    return NextResponse.json(
      { plans: plans.map(plan => ({ ...plan, monthlyPrice: Number(plan.monthlyPrice) })) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load current plans." },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
