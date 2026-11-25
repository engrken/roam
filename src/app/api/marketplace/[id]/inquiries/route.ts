import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMarketplaceListingPublic } from "@/lib/marketplace-host";
import { marketplaceDateRange, marketplaceInquirySchema } from "@/lib/marketplace-operations";
import { rentalPeriodsForRange, rentalRateForMode } from "@/lib/rental-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONSENT_VERSION = "marketplace-inquiry-v1";
const todayInManila = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.ROAM_MARKETPLACE_PUBLIC_ENABLED !== "true" || process.env.ROAM_MARKETPLACE_INQUIRIES_ENABLED !== "true") {
    return NextResponse.json({ error: "Marketplace rental inquiries are not open yet." }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = marketplaceInquirySchema.safeParse({ ...body, listingId: id });
  if (!parsed.success) return NextResponse.json({ error: "Complete your contact details, rental dates, and contact permission." }, { status: 400 });

  const range = marketplaceDateRange(parsed.data.startDate, parsed.data.endDate, parsed.data.startTime, parsed.data.endTime);
  if (!range || range.startAt <= new Date() || parsed.data.startDate < todayInManila()) {
    return NextResponse.json({ error: "Choose a future date range of up to 30 days." }, { status: 400 });
  }

  try {
    const inquiry = await prisma.$transaction(async (tx) => {
      const listing = await tx.marketplaceListing.findFirst({
        where: {
          id, isPublished: true, status: "PREQUALIFIED",
          hostProfile: { is: { status: "PREQUALIFIED" } },
          vehicle: { is: { status: "AVAILABLE" } },
          tenant: { is: { status: { in: ["ACTIVE", "TRIAL"] } } },
        },
        select: {
          id: true, tenantId: true, status: true, isPublished: true,
          hostProfile: { select: { status: true } },
          tenant: { select: { status: true } },
          vehicle: { select: { id: true, status: true, dailyRate: true, selfDriveEnabled: true, withDriverEnabled: true, withDriverDailyRate: true,
            hourlyRate: true, weeklyRate: true, monthlyRate: true, withDriverHourlyRate: true, withDriverWeeklyRate: true, withDriverMonthlyRate: true,
            deliveryAvailable: true, deliveryFee: true, securityDeposit: true, includedKmPerDay: true, excessMileageRate: true, overtimeGraceMinutes: true,
            overtimeHourlyRate: true, withDriverOvertimeHourlyRate: true } },
        },
      });
      if (!listing || !isMarketplaceListingPublic({
        publicEnabled: true, isPublished: listing.isPublished, listingStatus: listing.status,
        hostStatus: listing.hostProfile.status, vehicleStatus: listing.vehicle.status,
        tenantStatus: listing.tenant.status,
      })) throw new Error("LISTING_NOT_PUBLIC");

      const selectedRate = rentalRateForMode(listing.vehicle, parsed.data.rentalMode, parsed.data.rateUnit);
      const modeEnabled = parsed.data.rentalMode === "WITH_DRIVER" ? listing.vehicle.withDriverEnabled : listing.vehicle.selfDriveEnabled;
      const ratePeriods = rentalPeriodsForRange(range.startAt, range.endAt, parsed.data.rateUnit);
      if (!modeEnabled || selectedRate === null || ratePeriods === null) throw new Error("RENTAL_MODE_UNAVAILABLE");
      if (parsed.data.deliveryRequested && !listing.vehicle.deliveryAvailable) throw new Error("DELIVERY_UNAVAILABLE");
      if (parsed.data.deliveryRequested && (parsed.data.deliveryAddress || "").length < 5) throw new Error("DELIVERY_ADDRESS_REQUIRED");
      const deliveryFee = parsed.data.deliveryRequested ? Number(listing.vehicle.deliveryFee) : 0;
      const overtimeRate = parsed.data.rentalMode === "WITH_DRIVER" ? listing.vehicle.withDriverOvertimeHourlyRate : listing.vehicle.overtimeHourlyRate;

      const [block, booking, maintenance, recentRequests] = await Promise.all([
        tx.marketplaceAvailabilityBlock.findFirst({
          where: { listingId: listing.id, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } },
          select: { id: true },
        }),
        tx.bookingItem.findFirst({
          where: {
            vehicleId: listing.vehicle.id,
            booking: { is: { status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] }, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } } },
          },
          select: { id: true },
        }),
        tx.vehicleMaintenance.findFirst({
          where: { tenantId: listing.tenantId, vehicleId: listing.vehicle.id, startAt: { lt: range.endAt }, endAt: { gt: range.startAt } },
          select: { id: true },
        }),
        tx.marketplaceBookingInquiry.count({
          where: { listingId: listing.id, requesterEmail: parsed.data.requesterEmail, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        }),
      ]);
      if (block || booking || maintenance) throw new Error("DATES_UNAVAILABLE");
      if (recentRequests >= 3) throw new Error("RATE_LIMITED");

      return tx.marketplaceBookingInquiry.create({
        data: {
          tenantId: listing.tenantId, listingId: listing.id,
          requesterName: parsed.data.requesterName, requesterEmail: parsed.data.requesterEmail,
          requesterPhone: parsed.data.requesterPhone || null,
          startAt: range.startAt, endAt: range.endAt,
          dailyRateSnapshot: selectedRate.toFixed(2),
          rentalMode: parsed.data.rentalMode,
          rateUnit: parsed.data.rateUnit,
          ratePeriods,
          deliveryRequested: parsed.data.deliveryRequested,
          deliveryAddress: parsed.data.deliveryRequested ? parsed.data.deliveryAddress || null : null,
          deliveryFeeSnapshot: deliveryFee.toFixed(2),
          securityDepositSnapshot: Number(listing.vehicle.securityDeposit).toFixed(2),
          includedKmPerDaySnapshot: listing.vehicle.includedKmPerDay,
          excessMileageRateSnapshot: Number(listing.vehicle.excessMileageRate).toFixed(2),
          overtimeGraceMinutesSnapshot: listing.vehicle.overtimeGraceMinutes,
          overtimeHourlyRateSnapshot: overtimeRate === null ? null : Number(overtimeRate).toFixed(2),
          message: parsed.data.message || null,
          contactConsentAt: new Date(), consentVersion: CONSENT_VERSION,
        },
        select: { id: true, createdAt: true, status: true },
      });
    });
    return NextResponse.json({
      inquiry: { id: inquiry.id, createdAt: inquiry.createdAt, status: inquiry.status },
      message: "Your inquiry was sent to the Host. This is not a reservation or booking confirmation.",
    }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "LISTING_NOT_PUBLIC") return NextResponse.json({ error: "This vehicle is no longer accepting inquiries." }, { status: 404 });
    if (code === "RENTAL_MODE_UNAVAILABLE") return NextResponse.json({ error: "That rental option or pricing period is no longer available. Please refresh the listing and choose another option." }, { status: 409 });
    if (code === "DELIVERY_UNAVAILABLE") return NextResponse.json({ error: "Vehicle delivery is no longer available for this listing." }, { status: 409 });
    if (code === "DELIVERY_ADDRESS_REQUIRED") return NextResponse.json({ error: "Enter the delivery address before sending your inquiry." }, { status: 400 });
    if (code === "DATES_UNAVAILABLE") return NextResponse.json({ error: "Those dates are unavailable. Please choose another range." }, { status: 409 });
    if (code === "RATE_LIMITED") return NextResponse.json({ error: "Too many inquiries for this listing today. Please try again later." }, { status: 429 });
    console.error("Marketplace renter inquiry failed", error);
    return NextResponse.json({ error: "Unable to send your inquiry right now." }, { status: 500 });
  }
}
