import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const otp = await prisma.emailOtp.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp || otp.attempts >= 5) {
      return NextResponse.json({ error: "The code is invalid or expired. Request a new one." }, { status: 400 });
    }

    const expected = Buffer.from(otp.codeHash, "hex");
    const actual = Buffer.from(codeDigest(email, code), "hex");
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!matches) {
      const attempt = await prisma.emailOtp.updateMany({
        where: { id: otp.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } },
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
      if (otp.purpose === "register" && existing) return { conflict: true as const };
      if (otp.purpose === "login" && !existing) return null;
      const account = existing ?? await tx.user.create({ data: { email } });
      await tx.session.create({
        data: { tokenHash, userId: account.id, expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
      });
      return account;
    });

    if (user && "conflict" in user) {
      return NextResponse.json({ error: "An account already exists for this email. Please sign in instead." }, { status: 409 });
    }
    if (!user) {
      return NextResponse.json({ error: "The code is invalid or expired. Request a new one." }, { status: 400 });
    }

    const response = NextResponse.json({
      message: "Signed in successfully.",
      user: { id: user.id, email: user.email },
    });
    response.cookies.set("roam_session", token, {
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
