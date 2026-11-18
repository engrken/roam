import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function makeSlug(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a workspace." }, { status: 401 });
  try {
    const body = await request.json();
    const name = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "Business name must be between 2 and 100 characters." }, { status: 400 });
    }
    const base = makeSlug(name) || "rental-business";
    const slug = `${base}-${randomBytes(3).toString("hex")}`;

    const workspace = await prisma.$transaction(async (tx) => {
      const freePlan = await tx.plan.upsert({
        where: { tier: "FREE" },
        update: {},
        create: { tier: "FREE", name: "Free", monthlyPrice: 0, maxVehicles: 3, maxBranches: 1, maxStaff: 2 },
      });
      const tenant = await tx.tenant.create({
        data: { name, slug, email: user.email, phone: phone || null },
      });
      await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
      await tx.branch.create({ data: { tenantId: tenant.id, name: "Main Branch", code: "MAIN" } });
      await tx.subscription.create({
        data: { tenantId: tenant.id, planId: freePlan.id, tier: "FREE", status: "active" },
      });
      return tenant;
    });
    return NextResponse.json({
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, status: workspace.status },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to create the workspace. Please try again." }, { status: 500 });
  }
}
