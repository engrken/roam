import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (body?.accepted !== true || body?.termsVersion !== TERMS_VERSION || body?.privacyVersion !== PRIVACY_VERSION) {
    return NextResponse.json({ error: "Please agree to the current Terms of Service and acknowledge the Privacy Policy." }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  await prisma.legalAcceptance.upsert({
    where: { userId_termsVersion_privacyVersion: { userId: user.id, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION } },
    update: { acceptedAt: new Date(), ipAddress: forwarded || null, userAgent: request.headers.get("user-agent")?.slice(0, 500) || null },
    create: {
      userId: user.id,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
      ipAddress: forwarded || null,
      userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
    },
  });
  return NextResponse.json({ accepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION });
}
