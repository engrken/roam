import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { getTenantAccess, canManageFleet, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { createAppNotification } from "@/lib/app-notifications";
import { sendBookingMessageNotification, sendBookingStatusNotification, sendBookingReminder, sendRentalCompletionReceipt } from "@/lib/email";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isWithinPickupReminderWindow } from "@/lib/booking-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

const reservingStatuses = ["PENDING", "CONFIRMED", "ACTIVE"] as const;

const allowedTransitions: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string; reference: string }> }) {
  const { slug, reference } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) {
    return NextResponse.json({ error: "You cannot view customer booking details." }, { status: 403 });
  }

  const booking = await prisma.booking.findFirst({
    where: { tenantId: access.tenant.id, reference },
    select: {
      id: true, reference: true, status: true, startAt: true, endAt: true, totalAmount: true, securityDeposit: true,
      customer: { select: { name: true, email: true, phone: true } },
      items: {
        select: {
          rate: true, rentalMode: true, rateUnit: true, ratePeriods: true, deliveryRequested: true, deliveryAddress: true, deliveryFeeSnapshot: true, includedKmPerDaySnapshot: true, excessMileageRateSnapshot: true, overtimeGraceMinutesSnapshot: true, overtimeHourlyRateSnapshot: true, vehicle: { select: { id: true, type: true, make: true, model: true, year: true, plateNumber: true } },
        },
      },
      messages: { orderBy: { createdAt: "asc" } },
      payments: { select: { id: true, amount: true, kind: true, receivedAt: true } },
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, fileName: true, contentType: true, size: true, reviewStatus: true, createdAt: true, reviewedAt: true },
      },
    },
  });

  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  return NextResponse.json({
    booking: {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      startAt: booking.startAt,
      endAt: booking.endAt,
      totalAmount: Number(booking.totalAmount),
      securityDeposit: Number(booking.securityDeposit || 0),
      totalPayable: Number(booking.totalAmount) + Number(booking.securityDeposit || 0),
      customer: booking.customer,
      vehicles: booking.items.map((item) => ({ ...item.vehicle, rate: Number(item.rate), rentalMode: item.rentalMode, rateUnit: item.rateUnit, ratePeriods: item.ratePeriods, deliveryRequested: item.deliveryRequested, deliveryAddress: item.deliveryAddress, deliveryFeeSnapshot: Number(item.deliveryFeeSnapshot), includedKmPerDaySnapshot: item.includedKmPerDaySnapshot, excessMileageRateSnapshot: Number(item.excessMileageRateSnapshot), overtimeGraceMinutesSnapshot: item.overtimeGraceMinutesSnapshot, overtimeHourlyRateSnapshot: item.overtimeHourlyRateSnapshot === null ? null : Number(item.overtimeHourlyRateSnapshot) })),
      messages: booking.messages,
      payments: booking.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
      documents: booking.documents,
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string; reference: string }> }) {
  const { slug, reference } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  const writeBlock = workspaceWriteBlock(access);
  if (writeBlock) return writeBlock;
  if (!canManageFleet(access.role)) {
    return NextResponse.json({ error: "You cannot manage bookings." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const booking = await prisma.booking.findFirst({
    where: { tenantId: access.tenant.id, reference },
    select: { id: true, startAt: true, endAt: true, customer: { select: { name: true, email: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  if (body?.action === "shareLink") {
    const allowed = await consumeRateLimit("workspace-booking-share-link", booking.id, 10, 60 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: "Too many booking link changes. Please try again later." }, { status: 429 });
    const token = randomBytes(32).toString("hex");
    await prisma.$transaction(async tx => {
      await tx.booking.update({ where: { id: booking.id }, data: { publicTokenHash: hashToken(token) } });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "booking.access_link_rotated", targetType: "booking", targetId: booking.id,
        details: { reference },
      });
    });
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app").replace(/\/$/, "");
    return NextResponse.json({ url: baseUrl + "/booking/" + encodeURIComponent(reference) + "?token=" + token });
  }

  if (typeof body?.message === "string") {
    const message = body.message.trim();
    if (!message || message.length > 2000) {
      return NextResponse.json({ error: "Message must be 1–2,000 characters." }, { status: 400 });
    }
    const [bookingAllowed, actorAllowed] = await Promise.all([
      consumeRateLimit("workspace-booking-message", booking.id, 20, 60 * 60 * 1000),
      consumeRateLimit("workspace-booking-message-actor", access.user.id, 60, 60 * 60 * 1000),
    ]);
    if (!bookingAllowed || !actorAllowed) return NextResponse.json({ error: "Too many booking messages. Please try again later." }, { status: 429 });
    const savedMessage = await prisma.bookingMessage.create({
      data: { bookingId: booking.id, sender: "OWNER", body: message },
      select: { id: true },
    });
    await createAppNotification({
      tenantId: access.tenant.id, bookingId: booking.id, audience: "CLIENT",
      type: "TEAM_MESSAGE", title: "New message from the rental team",
      message: "The rental team sent a message about booking " + reference + ".",
      actionUrl: "/booking/" + encodeURIComponent(reference) + "#booking-messages",
      dedupeKey: "team-message:" + savedMessage.id,
    });
    if (booking.customer.email) {
      try {
        await sendBookingMessageNotification({ recipient: booking.customer.email, tenantName: access.tenant.name, bookingReference: reference, senderLabel: "Rental team", message });
      } catch (error) { console.error("Rental team reply email notification failed", error); }
    }
    return NextResponse.json({ sent: true, notification: booking.customer.email ? "attempted" : "no_customer_email" }, { status: 201 });
  }

  if (typeof body?.status === "string") {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findFirst({
        where: { id: booking.id, tenantId: access.tenant.id },
        select: { id: true, status: true, startAt: true, endAt: true, items: { select: { vehicleId: true } }, payments: { select: { amount: true, kind: true } } },
      });
      if (!current) return { error: "Booking not found.", status: 404 as const };

      const nextStatus = body.status as string;
      if (!allowedTransitions[current.status]?.includes(nextStatus)) {
        return {
          error: "Cannot change a " + current.status.toLowerCase() + " booking to " + nextStatus.toLowerCase() + ".",
          status: 409 as const,
        };
      }


      if (nextStatus === "CONFIRMED" || nextStatus === "ACTIVE") {
        const vehicleIds = current.items.map((item) => item.vehicleId).sort();
        for (const vehicleId of vehicleIds) {
          await tx.$queryRawUnsafe(
            "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2)) IS NULL AS locked",
            access.tenant.id,
            vehicleId,
          );
        }

        const conflict = await tx.booking.findFirst({
          where: {
            id: { not: current.id },
            tenantId: access.tenant.id,
            status: { in: [...reservingStatuses] },
            startAt: { lt: current.endAt },
            endAt: { gt: current.startAt },
            items: { some: { vehicleId: { in: vehicleIds } } },
          },
          select: { id: true },
        });
        if (conflict) {
          return {
            error: "This vehicle has another overlapping booking. Resolve the conflict before confirming.",
            status: 409 as const,
          };
        }
      }

      if (nextStatus === "ACTIVE" || nextStatus === "COMPLETED") {
        const inspectionType = nextStatus === "ACTIVE" ? "HANDOVER" : "RETURN";
        const completed = await tx.vehicleInspection.findMany({
          where: { tenantId: access.tenant.id, bookingId: current.id, type: inspectionType },
          select: { vehicleId: true },
        });
        const inspectedIds = new Set(completed.map((item) => item.vehicleId));
        if (current.items.some((item) => !inspectedIds.has(item.vehicleId))) {
          return {
            error: "Complete a " + inspectionType.toLowerCase() + " inspection for every vehicle before changing this booking status.",
            status: 409 as const,
          };
        }
      }

      await tx.booking.update({ where: { id: current.id }, data: { status: nextStatus as never } });
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "booking.status_changed", targetType: "booking", targetId: current.id,
        details: { reference, fromStatus: current.status, toStatus: nextStatus },
      });
      for (const vehicleId of current.items.map((item) => item.vehicleId)) {
        if (nextStatus === "CONFIRMED") {
          await tx.vehicle.updateMany({ where: { id: vehicleId, tenantId: access.tenant.id, status: { in: ["AVAILABLE", "RESERVED"] } }, data: { status: "RESERVED" } });
        } else if (nextStatus === "ACTIVE") {
          await tx.vehicle.updateMany({ where: { id: vehicleId, tenantId: access.tenant.id, status: { in: ["AVAILABLE", "RESERVED", "RENTED"] } }, data: { status: "RENTED" } });
        } else if (["COMPLETED", "CANCELLED", "REJECTED"].includes(nextStatus)) {
          const otherActive = await tx.booking.findFirst({ where: { id: { not: current.id }, tenantId: access.tenant.id, status: "ACTIVE", items: { some: { vehicleId } } }, select: { id: true } });
          const otherReserved = await tx.booking.findFirst({ where: { id: { not: current.id }, tenantId: access.tenant.id, status: "CONFIRMED", items: { some: { vehicleId } } }, select: { id: true } });
          if (otherActive) await tx.vehicle.updateMany({ where: { id: vehicleId, tenantId: access.tenant.id, status: { in: ["RESERVED", "RENTED"] } }, data: { status: "RENTED" } });
          else if (otherReserved) await tx.vehicle.updateMany({ where: { id: vehicleId, tenantId: access.tenant.id, status: { in: ["RESERVED", "RENTED"] } }, data: { status: "RESERVED" } });
          else await tx.vehicle.updateMany({ where: { id: vehicleId, tenantId: access.tenant.id, status: { in: ["RESERVED", "RENTED"] } }, data: { status: "AVAILABLE" } });
        }
      }
      await tx.bookingMessage.create({
        data: {
          bookingId: current.id,
          sender: "SYSTEM",
          body: "Booking status changed from " + current.status + " to " + nextStatus + " by the rental team.",
        },
      });
      return {
        updated: true,
        previousStatus: current.status,
        nextStatus,
        startAt: current.startAt,
        endAt: current.endAt,
      };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    await createAppNotification({
      tenantId: access.tenant.id, bookingId: booking.id, audience: "CLIENT",
      type: "BOOKING_STATUS", title: "Booking " + result.nextStatus.toLowerCase(),
      message: "Your booking " + reference + " is now " + result.nextStatus.toLowerCase() + ".",
      actionUrl: "/booking/" + encodeURIComponent(reference) + "#booking-update",
      dedupeKey: "booking-status:" + booking.id + ":" + result.nextStatus,
    });
    let notification: "attempted" | "no_customer_email" | "failed" = booking.customer.email ? "attempted" : "no_customer_email";
    if (booking.customer.email) {
      try {
        await sendBookingStatusNotification({
          recipient: booking.customer.email,
          tenantName: access.tenant.name,
          bookingReference: reference,
          status: result.nextStatus,
          startAt: result.startAt,
          endAt: result.endAt,
        });
      } catch (error) {
        notification = "failed";
        console.error("Booking status email notification failed", error);
      }
      // A daily cron can run before a booking is confirmed. If confirmation happens
      // inside the next 24 hours, send the pickup reminder now instead of waiting
      // for a cron run that may occur after pickup.
      const now = new Date();
      if (result.nextStatus === "CONFIRMED" && isWithinPickupReminderWindow(result.startAt, now)) {
        const timeZone = access.tenant.timezone || "Asia/Manila";
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(result.startAt);
        const dateParts = Object.fromEntries(parts.map(part => [part.type, part.value]));
        const dayKey = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
        const noticeKey = `PICKUP:${booking.id}:${dayKey}`;
        await prisma.bookingAutomationNotice.createMany({
          data: [{ bookingId: booking.id, noticeKey, noticeType: "PICKUP", scheduledFor: result.startAt }],
          skipDuplicates: true,
        });
        const claim = await prisma.bookingAutomationNotice.updateMany({
          where: { noticeKey, status: { in: ["PENDING", "FAILED"] } },
          data: { status: "PROCESSING", lastError: null },
        });
        if (claim.count) {
          try {
            await sendBookingReminder({
              recipient: booking.customer.email,
              tenantName: access.tenant.name,
              bookingReference: reference,
              reminderType: "PICKUP",
              timeZone,
              startAt: result.startAt,
              endAt: result.endAt,
            });
            await prisma.bookingAutomationNotice.update({ where: { noticeKey }, data: { status: "SENT", sentAt: new Date() } });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Email delivery failed.";
            await prisma.bookingAutomationNotice.update({ where: { noticeKey }, data: { status: "FAILED", lastError: message.slice(0, 1000) } });
            console.error("Immediate pickup reminder failed", { reference, error });
          }
        }
      }
    }
    let receipt: "sent" | "no_customer_email" | "failed" | "not_applicable" = "not_applicable";
    if (result.nextStatus === "COMPLETED") {
      const noticeKey = "COMPLETION_RECEIPT:" + booking.id;
      await prisma.bookingAutomationNotice.createMany({
        data: [{ bookingId: booking.id, noticeKey, noticeType: "COMPLETION_RECEIPT", scheduledFor: new Date() }],
        skipDuplicates: true,
      });
      const claim = await prisma.bookingAutomationNotice.updateMany({
        where: { noticeKey, status: { in: ["PENDING", "FAILED"] } },
        data: { status: "PROCESSING", lastError: null },
      });
      if (claim.count) {
        try {
          if (!booking.customer.email) {
            receipt = "no_customer_email";
            throw new Error("Customer email address is missing.");
          }
          const receiptData = await prisma.booking.findFirst({
            where: { id: booking.id, tenantId: access.tenant.id },
            select: {
              totalAmount: true, securityDeposit: true,
              items: { select: { vehicle: { select: { make: true, model: true, plateNumber: true } } } },
              payments: { orderBy: { receivedAt: "asc" }, select: { amount: true, kind: true, method: true, reference: true, notes: true, receivedAt: true } },
            },
          });
          if (!receiptData) throw new Error("Booking receipt details could not be loaded.");
          await sendRentalCompletionReceipt({
            recipient: booking.customer.email,
            customerName: booking.customer.name,
            tenantName: access.tenant.name,
            bookingReference: reference,
            currency: access.tenant.currency || "PHP",
            rentalAmount: Number(receiptData.totalAmount),
            securityDeposit: Number(receiptData.securityDeposit || 0),
            pickupAt: result.startAt,
            returnedAt: new Date(),
            vehicles: receiptData.items.map(item => item.vehicle.make + " " + item.vehicle.model + " · " + item.vehicle.plateNumber),
            transactions: receiptData.payments.map(payment => ({
              amount: Number(payment.amount), kind: payment.kind, method: payment.method,
              reference: payment.reference, notes: payment.notes, receivedAt: payment.receivedAt,
            })),
          });
          await prisma.bookingAutomationNotice.update({ where: { noticeKey }, data: { status: "SENT", sentAt: new Date() } });
          receipt = "sent";
        } catch (error) {
          const message = error instanceof Error ? error.message : "Receipt email delivery failed.";
          await prisma.bookingAutomationNotice.update({ where: { noticeKey }, data: { status: "FAILED", lastError: message.slice(0, 1000) } });
          if (receipt !== "no_customer_email") receipt = "failed";
          console.error("Rental completion receipt email failed", { reference, error });
        }
      }
    }
    return NextResponse.json({ updated: true, notification, receipt });
  }

  if (typeof body?.documentId === "string" && ["APPROVED", "REJECTED"].includes(body.reviewStatus)) {
    const result = await prisma.$transaction(async tx => {
      const updated = await tx.bookingDocument.updateMany({
        where: { id: body.documentId, bookingId: booking.id },
        data: { reviewStatus: body.reviewStatus, reviewedAt: new Date() },
      });
      if (!updated.count) return false;
      await recordWorkspaceAudit(tx, {
        tenantId: access.tenant.id, actorUserId: access.user.id, actorEmail: access.user.email,
        action: "booking.document_reviewed", targetType: "bookingDocument", targetId: body.documentId,
        details: { reference, reviewStatus: body.reviewStatus },
      });
      return true;
    });
    if (!result) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    await createAppNotification({
      tenantId: access.tenant.id, bookingId: booking.id, audience: "CLIENT",
      type: "DOCUMENT_REVIEW",
      title: "Document " + String(body.reviewStatus).toLowerCase(),
      message: "The rental team reviewed a document for booking " + reference + ": " + String(body.reviewStatus).toLowerCase() + ".",
      actionUrl: "/booking/" + encodeURIComponent(reference) + "#booking-documents",
      dedupeKey: "document-review:" + body.documentId + ":" + body.reviewStatus,
    });
    return NextResponse.json({ reviewed: true });
  }

  return NextResponse.json({ error: "Unsupported booking action." }, { status: 400 });
}
