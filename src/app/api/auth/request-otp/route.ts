import { createHash, createHmac, randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLoginCode } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

function digest(email: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Authentication is not configured.");
  return createHmac("sha256", secret).update(email + ":" + code).digest("hex");
}

export async function POST(request: NextRequest) {
  let otpId: string | undefined;
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const purpose = body?.purpose === "register" ? "register" : body?.purpose === "change-email" ? "change-email" : "login";
    const referralCode = purpose === "register" && typeof body?.referralCode === "string" ? body.referralCode.trim().toUpperCase() : "";
    if (purpose === "change-email") {
      const currentUser = await getCurrentUser();
      if (!currentUser) return NextResponse.json({ error: "Sign in before changing your email." }, { status: 401 });
      if (currentUser.email === email) return NextResponse.json({ error: "That is already your sign-in email." }, { status: 400 });
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) return NextResponse.json({ error: "That email is already associated with a ROAM account." }, { status: 409 });
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (referralCode) {
      const referrer = await prisma.tenant.findUnique({ where: { referralCode }, select: { id: true, status: true } });
      if (!referrer || ["SUSPENDED", "CANCELLED"].includes(referrer.status)) {
        return NextResponse.json({ error: "That referral link is invalid or no longer available." }, { status: 400 });
      }
    }

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientIp = forwarded || request.headers.get("x-real-ip") || "unknown";
    const ipHash = createHash("sha256").update(clientIp).digest("hex");
    const ipBucket = "ip-" + ipHash + "@rate-limit.invalid";
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const otp = await prisma.$transaction(async (tx) => {
      // Acquire locks in the same order for every request to keep counters race-safe.
      await tx.$queryRawUnsafe("SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1))) AS advisory_lock", "email:" + email);
      await tx.$queryRawUnsafe("SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1))) AS advisory_lock", "ip:" + ipHash);

      await tx.emailOtp.deleteMany({
        where: { codeHash: "RATE_LIMIT", expiresAt: { lt: now } },
      });

      const [emailRequests, ipRequests] = await Promise.all([
        tx.emailOtp.count({ where: { email, createdAt: { gt: windowStart } } }),
        tx.emailOtp.count({ where: { email: ipBucket, createdAt: { gt: windowStart } } }),
      ]);
      if (emailRequests >= 5 || ipRequests >= 20) return null;

      await tx.emailOtp.create({
        data: {
          email: ipBucket,
          codeHash: "RATE_LIMIT",
          expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
          consumedAt: now,
        },
      });

      await tx.emailOtp.updateMany({
        where: { email, consumedAt: null },
        data: { consumedAt: now },
      });
      return tx.emailOtp.create({
        data: {
          email,
          codeHash: purpose + ":" + digest(email, code),
          referralCode: referralCode || null,
          expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        },
      });
    });

    if (!otp) {
      return NextResponse.json({ error: "Too many code requests. Please try again later." }, { status: 429 });
    }
    otpId = otp.id;

    try {
      await sendLoginCode(email, code);
    } catch (error) {
      await prisma.emailOtp.updateMany({
        where: { id: otp.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw error;
    }

    return NextResponse.json({ sent: true, message: "If this address can receive a code, one has been sent." });
  } catch (error) {
    console.error("OTP request failed", { otpId, error });
    return NextResponse.json({ error: "Unable to send a sign-in code right now." }, { status: 500 });
  }
}
