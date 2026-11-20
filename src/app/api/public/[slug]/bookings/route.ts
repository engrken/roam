import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { rentalDateTimeToUtc } from "@/lib/datetime";
import { consumeRateLimit } from "@/lib/rate-limit";
import { sendBookingRequestReceived } from "@/lib/email";
import { isTenantTrialReadOnly } from "@/lib/tenant-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const reservingStatuses = ["PENDING", "CONFIRMED", "ACTIVE"] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const search = request.nextUrl.searchParams;
  const startValue = search.get("startAt");
  const endValue = search.get("endAt");
  const branchId = search.get("branchId") || "";
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, phone: true, currency: true, timezone: true, status: true, rentalTerms: true },
  });
  if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) {
    return NextResponse.json({ error: "Rental business not found." }, { status: 404 });
  }
  let requestedStart: Date | null = null;
  let requestedEnd: Date | null = null;
  if (startValue || endValue) {
    requestedStart = rentalDateTimeToUtc(startValue, tenant.timezone);
    requestedEnd = rentalDateTimeToUtc(endValue, tenant.timezone);
    if (!startValue || !endValue || !requestedStart || !requestedEnd || requestedStart <= new Date() || requestedEnd <= requestedStart) {
      return NextResponse.json({ error: "Choose a valid future pickup and return time." }, { status: 400 });
    }
  }

  const [branches, vehicles] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true },
    }),
    prisma.vehicle.findMany({
    where: {
      tenantId: tenant.id,
      status: requestedStart && requestedEnd ? { in: ["AVAILABLE", "RESERVED"] } : "AVAILABLE",
      OR: [{ branchId: null }, { branch: { is: { isActive: true } } }],
      ...(branchId ? { branchId } : {}),
      ...(requestedStart && requestedEnd ? {
        bookingItems: {
          none: {
            booking: {
              status: { in: [...reservingStatuses] },
              startAt: { lt: requestedEnd },
              endAt: { gt: requestedStart },
            },
          },
        },
        maintenances: {
          none: {
            status: { not: "CANCELLED" },
            startAt: { lt: requestedEnd },
            endAt: { gt: requestedStart },
          },
        },
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, make: true, model: true, year: true, color: true,
      seats: true, transmission: true, dailyRate: true, securityDeposit: true,
      branch: { select: { id: true, name: true, address: true } },
    },
  }),
  ]);

  return NextResponse.json({
    business: { name: tenant.name, phone: tenant.phone, currency: tenant.currency, timezone: tenant.timezone, rentalTerms: tenant.rentalTerms?.trim() || "", rentalTermsVersion: hash(tenant.rentalTerms?.trim() || "") },
    branches,
    vehicles: vehicles.map((vehicle) => ({
      ...vehicle,
      dailyRate: Number(vehicle.dailyRate),
      securityDeposit: Number(vehicle.securityDeposit),
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json().catch(() => null);
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, timezone: true, rentalTerms: true },
  });

  if (!tenant || !["ACTIVE", "TRIAL"].includes(tenant.status)) {
    return NextResponse.json({ error: "Rental business is unavailable." }, { status: 404 });
  }

  if (await isTenantTrialReadOnly(tenant.id)) {
    return NextResponse.json({ error: "This rental business is temporarily not accepting new booking requests. Please contact the business directly." }, { status: 423 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const vehicleId = typeof body?.vehicleId === "string" ? body.vehicleId : "";
  const rentalTerms = tenant.rentalTerms?.trim() || "";
  if (!rentalTerms) return NextResponse.json({ error: "This rental business has not published its rental terms yet. Please contact the business directly." }, { status: 409 });
  const rentalTermsVersion = hash(rentalTerms);
  if (body?.acceptedRentalTerms !== true || body?.rentalTermsVersion !== rentalTermsVersion) {
    return NextResponse.json({ error: "Please review and accept the current rental terms before submitting your request." }, { status: 400 });
  }
  const startAt = rentalDateTimeToUtc(body?.startAt, tenant.timezone);
  const endAt = rentalDateTimeToUtc(body?.endAt, tenant.timezone);

  if (
    name.length < 2 || name.length > 100 ||
    email.length > 254 || !/^\S+@\S+\.\S+$/.test(email) ||
    phone.length < 7 || phone.length > 30 ||
    !vehicleId || vehicleId.length > 128 ||
    !startAt || !endAt || startAt <= new Date() || endAt <= startAt
  ) {
    return NextResponse.json({
      error: "Please provide valid contact details and rental dates. Times are interpreted in " + tenant.timezone + ".",
    }, { status: 400 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  const [ipAllowed, emailAllowed] = await Promise.all([
    consumeRateLimit("public-booking-ip", clientIp, 20, 60 * 60 * 1000),
    consumeRateLimit("public-booking-email", email, 5, 60 * 60 * 1000),
  ]);
  if (!ipAllowed || !emailAllowed) {
    return NextResponse.json({ error: "Too many booking requests. Please try again later." }, { status: 429 });
  }

  const days = Math.max(1, Math.ceil((endAt.getTime() - startAt.getTime()) / 86_400_000));
  const token = randomBytes(32).toString("base64url");
  const reference = "RM-" + randomBytes(6).toString("hex").toUpperCase();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize requests for this tenant/vehicle so overlap checks and inserts are atomic.
      await tx.$queryRawUnsafe(
        "SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))) AS advisory_lock",
        tenant.id,
        vehicleId,
      );

      const vehicle = await tx.vehicle.findFirst({
        where: { id: vehicleId, tenantId: tenant.id, status: { in: ["AVAILABLE", "RESERVED"] } },
        select: { id: true, branchId: true, dailyRate: true },
      });
      if (!vehicle) return { conflict: "This vehicle is not currently available." as const };

      const conflict = await tx.booking.findFirst({
        where: {
          tenantId: tenant.id,
          status: { in: [...reservingStatuses] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
          items: { some: { vehicleId } },
        },
        select: { id: true },
      });
      if (conflict) return { conflict: "Those dates are no longer available. Please choose another period." as const };

      const maintenanceConflict = await tx.vehicleMaintenance.findFirst({
        where: { tenantId: tenant.id, vehicleId, status: { not: "CANCELLED" }, startAt: { lt: endAt }, endAt: { gt: startAt } },
        select: { id: true },
      });
      if (maintenanceConflict) return { conflict: "This vehicle is scheduled for maintenance during those dates. Please choose another vehicle or period." as const };

      const existingCustomer = await tx.customer.findFirst({
        where: { tenantId: tenant.id, email },
        select: { id: true },
      });
      const customer = existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: { name, phone },
            select: { id: true },
          })
        : await tx.customer.create({
            data: { tenantId: tenant.id, name, email, phone },
            select: { id: true },
          });

      const savedBooking = await tx.booking.create({
        data: {
          tenantId: tenant.id,
          branchId: vehicle.branchId,
          customerId: customer.id,
          reference,
          status: "PENDING",
          startAt,
          endAt,
          totalAmount: vehicle.dailyRate.mul(days),
          rentalTermsSnapshot: rentalTerms,
          rentalTermsVersion,
          rentalTermsAcceptedAt: new Date(),
          publicTokenHash: hash(token),
          items: { create: { vehicleId: vehicle.id, rate: vehicle.dailyRate } },
          messages: {
            create: {
              sender: "SYSTEM",
              body: "Booking request submitted. The rental team will review your request and reply here.",
            },
          },
        },
        select: { reference: true, status: true },
      });

      return { booking: savedBooking };
    });

    if ("conflict" in result) {
      return NextResponse.json({ error: result.conflict }, { status: 409 });
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/+$/, "");
    const bookingUrl = baseUrl + "/booking/" + encodeURIComponent(reference) + "?token=" + encodeURIComponent(token);
    let emailNotification: "attempted" | "failed" = "attempted";
    try {
      await sendBookingRequestReceived({
        recipient: email,
        tenantName: tenant.name,
        bookingReference: reference,
        startAt,
        endAt,
        bookingUrl,
      });
    } catch (error) {
      emailNotification = "failed";
      console.error("Booking request email notification failed", error);
    }

    return NextResponse.json({
      reference: result.booking.reference,
      accessToken: token,
      status: result.booking.status,
      emailNotification,
    }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "A booking reference conflict occurred. Please try again." }, { status: 409 });
    }
    console.error("Public booking creation failed", error);
    return NextResponse.json({ error: "Unable to submit the booking request right now." }, { status: 500 });
  }
}
