import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasCurrentLegalAcceptance } from "@/lib/legal";
import { prisma } from "@/lib/prisma";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length > 128) return NextResponse.json({ error: "This invitation link is invalid." }, { status: 400 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in or create a ROAM account with the invited email first." }, { status: 401 });
  if (!hasCurrentLegalAcceptance(user.legalAcceptances)) {
    return NextResponse.json({ error: "Accept the current ROAM terms and privacy notice before joining a workspace." }, { status: 403 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  try {
    const result = await prisma.$transaction(async tx => {
      const invitation = await tx.teamInvitation.findFirst({
        where: { tokenHash, email: user.email, acceptedAt: null, expiresAt: { gt: now } },
        include: { tenant: { select: { id: true, slug: true, name: true, status: true } } },
      });
      if (!invitation) return { error: "This invitation is expired, already used, or belongs to a different email address." };
      if (!["ACTIVE", "TRIAL"].includes(invitation.tenant.status)) return { error: "This workspace is not currently accepting team members." };
      const trialPolicy = await tx.subscription.findUnique({ where: { tenantId: invitation.tenantId }, select: { status: true, trialPolicyVersion: true, trialGraceEndsAt: true } });
      if (trialPolicy?.trialPolicyVersion === 1 && trialPolicy.status === "trialing" && trialPolicy.trialGraceEndsAt && trialPolicy.trialGraceEndsAt <= now) return { error: "This workspace is read-only after its trial grace period. Ask the owner to arrange an approved subscription before joining." };
      await tx.$queryRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1)) IS NULL AS locked",
        "team-invitation:" + invitation.tenantId,
      );
      const existing = await tx.membership.findUnique({
        where: { tenantId_userId: { tenantId: invitation.tenantId, userId: user.id } },
      });
      if (existing) return { error: "You already have access to this workspace." };
      const [subscription, memberCount] = await Promise.all([
        tx.subscription.findUnique({ where: { tenantId: invitation.tenantId }, include: { plan: { select: { maxStaff: true, name: true } } } }),
        tx.membership.count({ where: { tenantId: invitation.tenantId } }),
      ]);
      if (subscription?.plan.maxStaff != null && memberCount >= subscription.plan.maxStaff) {
        return { error: "This workspace has reached its member limit. Ask its owner to review the plan before accepting." };
      }
      const claimed = await tx.teamInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now },
      });
      if (claimed.count !== 1) return { error: "This invitation has already been used." };
      await tx.membership.create({
        data: { tenantId: invitation.tenantId, userId: user.id, role: invitation.role },
      });
      await recordWorkspaceAudit(tx, {
        tenantId: invitation.tenantId, actorUserId: user.id, actorEmail: user.email,
        action: "team.invitation.accepted", targetType: "invitation", targetId: invitation.id,
        details: { role: invitation.role, invitedByUserId: invitation.invitedByUserId },
      });
      return { slug: invitation.tenant.slug, name: invitation.tenant.name };
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ accepted: true, workspace: result });
  } catch (error) {
    console.error("Team invitation acceptance failed", error);
    return NextResponse.json({ error: "Unable to accept this invitation right now." }, { status: 500 });
  }
}
