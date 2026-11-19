import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { sendBookingAccessLink } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const genericResponse = () => NextResponse.json({
  message: "If the booking reference and email match our records, we’ll send a private access link shortly. Please check your inbox and spam folder.",
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const reference = typeof body?.reference === "string" ? body.reference.trim().toUpperCase() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^RM-[A-F0-9]{12}$/.test(reference) || email.length > 254 || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid booking reference and email address." }, { status: 400 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || "unknown";
  const [ipAllowed, referenceAllowed] = await Promise.all([
    consumeRateLimit("booking-link-lookup-ip", clientIp, 8, 60 * 60 * 1000),
    consumeRateLimit("booking-link-lookup-reference", reference, 5, 60 * 60 * 1000),
  ]);
  if (!ipAllowed || !referenceAllowed) {
    return NextResponse.json({ error: "Too many access-link requests. Please try again later." }, { status: 429 });
  }

  const booking = await prisma.booking.findFirst({
    where: {
      reference,
      customer: { email: { equals: email, mode: "insensitive" } },
    },
    select: { reference: true, customer: { select: { email: true } } },
  });

  if (booking?.customer.email) {
    const token = randomBytes(32).toString("base64url");
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/+$/, "");
    const bookingUrl = baseUrl + "/booking/" + encodeURIComponent(reference) + "?token=" + encodeURIComponent(token);
    try {
      await sendBookingAccessLink({
        recipient: booking.customer.email,
        bookingReference: reference,
        bookingUrl,
      });
      await prisma.booking.updateMany({
        where: { reference },
        data: { publicTokenHash: hash(token) },
      });
    } catch (error) {
      console.error("Booking access recovery failed", error);
      // Keep the same public response to avoid revealing whether a booking exists.
    }
  }

  return genericResponse();
}
