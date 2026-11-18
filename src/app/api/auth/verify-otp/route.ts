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
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Enter your email and the six-digit code." }, { status: 400 });
    }

    const otp = await prisma.emailOtp.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp || otp.attempts >= 5) return NextResponse.json({ error: "The code is invalid or expired. Request a new one." }, { status: 400 });

    const expected = Buffer.from(otp.codeHash, "hex");
    const actual = Buffer.from(codeDigest(email, code), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await prisma.emailOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: "The code is incorrect." }, { status: 400 });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await prisma.$transaction(async (tx) => {
      await tx.emailOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
      const account = await tx.user.upsert({ where: { email }, update: {}, create: { email } });
      await tx.session.create({
        data: { tokenHash, userId: account.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });
      return account;
    });

    const response = NextResponse.json({ message: "Signed in successfully.", user: { id: user.id, email: user.email } });
    response.cookies.set("roam_session", token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/", maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Unable to verify the code right now." }, { status: 503 });
  }
}
