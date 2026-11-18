import { createHash, createHmac, randomInt } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLoginCode } from "@/lib/email";

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
    const purpose = body?.purpose === "register" ? "register" : "login";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientIp = forwarded || request.headers.get("x-real-ip") || "unknown";
    const ipHash = createHash("sha256").update(clientIp).digest("hex");
    const ipBucket = "ip-" + ipHash + "@rate-limit.invalid";
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000);

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const otp = await prisma.$transaction(async (¶»§q«^