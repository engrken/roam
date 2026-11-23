import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

function codeDigest(email: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Authentication is not configured.");
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Enter your email and the six-digit code." }, { status: 400 });
    }

    const emailAllowed = await consumeRateLimit("otp-verify-email", email, 20, 15 * 60 * 1000);
    const ipAllowed = await consumeRateLimit("otp-verify-ip", getClientIp(request.headers), 60, 15 * 60 * 1000);
    if (!emailAllowed || !ipAllowed) {
      return NextResponse.json({ error: "Too many verification attempts. Request a new code later." }, { status: 429 });
    }

    const otp = await prisma.emailOtp.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp || otp.attempts >= 5) {
      return NextResponse.json({ error: "The code is invalid or expired. Request a new one." }, { status: 400 });
    }

    const [storedPurpose, storedDigest] = otp.codeHash.includes(":") ? otp.codeHash.split(":", 2) : ["login", otp.codeHash];
    const purpose = storedPurpose === "register" ? "register" : storedPurpose === "change-email" ? "change-email" : "login";
    const currentUser = purpose === "change-email" ? await getCurrentUser() : null;
    if (purpose === "change-email" && !currentUser) return NextResponse.json({ error: "Sign in before changing your email." }, { status: 401 });
    const expected = Buffer.from(storedDigest, "hex");
    const actual = Buffer.from(codeDigest(email, code), "hex");
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      const attempt = await prisma.emailOtp.updateMany({
        where: {
          id: otp.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          attempts: otp.attempts,
        },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json(
        { error: attempt.count ? "The code is incorrect." : "The code is invalid or expired. Request a new one." },
        { status: 400 },
      );
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();
    const user = await prisma.$transaction(async (tx) => {
      // Conditional consumption makes a one-time code single-use even if two
      // verification requests arrive at nearly the same time.
      const consumed = await tx.emailOtp.updateMany({
        where: { id: otp.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return null;

      const existing = await tx.user.findUnique({ where: { email } });
      if (purpose === "change-email") {
        if (!currentUser) return { missingSession: true as const };
        if (existing && existing.id !== currentUser.id) return { conflict: true as const };
        return tx.user.update({ where: { id: currentUser.id }, data: { email } });
      }
      if (purpose === "register" && existing) return { conflict: true as const };
      if (purpose === "login" && !existing) return { missing: true as const };
      const referrer = purpose === "register" && otp.referralCode
        ? await tx.tenant.findUnique({ where: { referralCode: otp.referralCode }, select: { id: true, status: true } })
        : null;
      if (otp.referralCode && (!referrer || ["SUSPENDED", "CANCELLED"].includes(referrer.status))) return { invalidReferral: true as const };
      const account = existing ?? await tx.user.create({ data: { email, referredByTenantId: referrer?.id || null } });
      await tx.session.create({
        data: { tokenHash, userId: account.id, expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      });
      return account;
    });

    if (user && "missingSession" in user) return NextResponse.json({ error: "Your sign-in session expired. Sign in again and retry." }, { status: 401 });
    if (user && "missing" in user) {
      return NextResponse.json({ error: "No ROAM account exists for this email. Create an account first." }, { status: 404 });
    }
    if (user && "invalidReferral" in user) {
      return NextResponse.json({ error: "The referral link is no longer valid. Request a new sign-in code without it." }, { status: 400 });
    }
    if (user && "conflict" in user) {
      return NextResponse.json({ error: "An account already exists for this email. Please sign in instead." }, { status: 409 });
    }
    if (!user) {
      return NextResponse.json({ error: "The code is invalid or expired. Request a new one." }, { status: 400 });
    }

    const response = NextResponse.json({
      message: purpose === "change-email" ? "Sign-in email updated successfully." : "Signed in successfully.",
      user: { id: user.id, email: user.email },
    });
    if (purpose !== "change-email") response.cookies.set("roam_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to verify the code right now." }, { status: 503 });
  }
}
