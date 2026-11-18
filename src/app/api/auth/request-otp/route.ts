import { createHash, createHmac, randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLoginCode } from "@/lib/email";

export const runtime = "nodejs";

function digest(email: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Authentication is not configured.");
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const recent = await prisma.emailOtp.count({
      where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } },
    });
    if (recent >= 5) return NextResponse.json({ error: "Too many code requests. Please try again later." }, { status: 429 });

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await prisma.emailOtp.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await prisma.emailOtp.create({
      data: { email, codeHash: digest(email, code), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
    await sendLoginCode(email, code);
    return NextResponse.json({ message: "If the address can receive ROAM sign-in messages, a code has been sent." });
  } catch {
    return NextResponse.json({ error: "Unable to send a sign-in code right now. Please try again." }, { status: 503 });
  }
}
