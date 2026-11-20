import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasCurrentLegalAcceptance } from "@/lib/legal";

export const runtime = "nodejs";

function makeSlug(value: string) {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a workspace." }, { status: 401 });
  if (!hasCurrentLegalAcceptance(user.legalAcceptances)) return NextResponse.json({ error: "Accept the current Terms of Service and Privacy Policy before creating a workspace." }, { status: 403 });
  try {
    const body = await request.json();
    const name = typeof body.businessName === "string" ? body.businessName.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const requestedReferralCode = typeof body.referralCode === "string" ? body.referralCode.trim().toUpperCase() : "";
    const manualReferrer = requestedReferralCode && !user.referredByTenantId
      ? await prisma.tenant.findUnique({ where: { referralCode: requestedReferralCode }, select: { id: true, status: true, memberships: { where: { role: "OWNER" }, select: { userId: true }, take: 1 } } })
      : null;
    if (requestedReferralCode && !user.referredByTenantId && (!manualReferrer || ["SUSPENDED", "CANCELLED"].includes(manualReferrer.status) || manualReferrer.memberships[0]?.userId === user.id)) {
      return NextResponse.json({ error: "That referral code is invalid or cannot be used by this account." }, { status: 400 });
    }
    if (name.length < 2 || name.length > 100) {
      return NextResponse.json({ error: "Business name must be between 2 and 100 characters." }, { status: 400 });
    }
    const base = makeSlug(name) || "rental-business";
    const slug = `${base}-${randomBytes(3).toString("hex")}`;

    const workspace = await prisma.$transaction(async (tx) => {
      const plans = [
        { tier: "STARTER" as const, name: "Starter", monthlyPrice: 99, maxVehicles: 2, maxBranches: 1, maxStaff: 1 },
        { tier: "PRO" as const, name: "Pro", monthlyPrice: 499, maxVehicles: 5, maxBranches: 2, maxStaff: 1 },
        { tier: "BUSINESS" as const, name: "Business", monthlyPrice: 999, maxVehicles: 15, maxBranches: 3, maxStaff: 8 },
        { tier: "ENTERPRISE" as const, name: "Enterprise", monthlyPrice: 0, maxVehicles: null, maxBranches: null, maxStaff: null },
      ];
      const seededPlans = await Promise.all(plans.map((plan) => tx.plan.upsert({
        where: { tier: plan.tier },
        update: {}, // Preserve platform-admin pricing, capacity, and activation settings for existing plans.
        create: plan,
      })));
      const starterPlan = seededPlans.find((plan) => plan.tier === "STARTER");
      if (!starterPlan) throw new Error("Starter plan could not be initialized.");
      const trialStartsAt = new Date();
      const trialEndsAt = new Date(trialStartsAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      const trialGraceEndsAt = new Date(trialEndsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      const tenant = await tx.tenant.create({
        data: { name, slug, email: user.email, phone: phone || null, referralCode: randomBytes(6).toString("hex").toUpperCase() },
      });
      await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, role: "OWNER" } });
      await tx.branch.create({ data: { tenantId: tenant.id, name: "Main Branch", code: "MAIN" } });
      const account = await tx.user.findUnique({ where: { id: user.id }, select: { createdAt: true, referredByTenantId: true } });
      const attributedReferrerId = account?.referredByTenantId || manualReferrer?.id || null;
      if (account && attributedReferrerId) {
        const [referrer, existingReferral] = await Promise.all([
          tx.tenant.findUnique({ where: { id: attributedReferrerId }, select: { id: true, referralCode: true, status: true, memberships: { where: { role: "OWNER" }, select: { userId: true }, take: 1 } } }),
          tx.referral.findUnique({ where: { referredOwnerUserId: user.id }, select: { id: true } }),
        ]);
        if (referrer && referrer.status !== "SUSPENDED" && referrer.status !== "CANCELLED"
          && referrer.memberships[0]?.userId !== user.id && !existingReferral && account.createdAt) {
          const expiresAt = new Date(account.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
          await tx.referral.create({
            data: {
              referrerTenantId: referrer.id,
              referredTenantId: tenant.id,
              referredOwnerUserId: user.id,
              code: referrer.referralCode || "",
              registeredAt: account.createdAt,
              expiresAt,
              status: expiresAt > new Date() ? "PENDING" : "EXPIRED",
            },
          });
        }
      }
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: starterPlan.id,
          tier: "STARTER",
          status: "trialing",
          currentPeriodStart: trialStartsAt,
          currentPeriodEnd: trialEndsAt,
          trialEndsAt,
          trialPolicyVersion: 1,
          trialGraceEndsAt,
        },
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
