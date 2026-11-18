import { createHmac, randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLoginCode } from "@/lib/email";

export const runtime = "nodejs";

function digest(email: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Authentication is not configured.");
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export async function POST(request: NextRequest) {
  let otpId: string | undefined;
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const purpose = body?.purpose === "register" ? "register" : "login";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const recent = await prisma.emailOtp.count({
      where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } },
    });
    if (recent >= 5) {
      return NextResponse.json({ error: "Too many code requests. Please try again later." }, { status: 429 });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const otp = await prisma.$transaction(async (tx) => {
      await tx.emailOtp.updateMany({
        where: { email, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return tx.emailOtp.create({
        data: { email, purpose, codeHash: `${purpose}:${digest(email, code)}`, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      });
    });
    otpId = otp.id;

    try {
      await sendLoginCode(email, code);
    } catch (error) {
      // A code that was never delivered must not remain usable.
      await prisma.emailOtp.updateMany({
        where: { id: otp.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      throw error;
    }

    return NextResponse.json({ message: "If the address can receive ROAM sign-in messages, a code has been sent." });
  } catch {
    if (otpId) {
      await prisma.emailOtp.updateMany({
        where: { id: otpId, consumedAt: null },
        data: { consumedAt: new Date() },
      }).catch(() => undefined);
    }
    return NextResponse.json({ error: "Unable to send a sign-in code right now. Please try again." }, { status: 503 });
  }
}
