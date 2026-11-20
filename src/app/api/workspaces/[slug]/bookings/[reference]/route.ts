import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { getTenantAccess, canManageFleet, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { sendBookingMessageNotification, sendBookingStatusNotification } from "@/lib/email";
import { recordWorkspaceAudit } from "@/lib/workspace-audit";

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
      id: true, reference: true, status: true, startAt: true, endAt: true, totalAmount: true,
      customer: { select: { name: true, email: true, phone: true } },
      items: {
        select: {
          vehicle: { select: { id: true, type: true, make: true, model: true, year: true, plateNumber: true } },
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
      customer: booking.customer,
      vehicles: booking.items.map((item) => item.vehicle),
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
    select: { id: true, customer: { select: { name: true, email: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  if (body?.action === "shareLink") {
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
    await prisma.bookingMessage.create({
      data: { bookingId: booking.id, sender: "OWNER", body: message },
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

      if (nextStatus === "CONFIRMED" && current.payments.reduce((sum, payment) => sum + (payment.kind === "REFUND" ? -Number(payment.amount) : Number(payment.amount)), 0) <= 0) {
        return { error: "Before confirming, review any uploaded proof and record the verified deposit or payment in Financials.", status: 409 as const };
      }

      if (nextStatus === "CONFIRMED" || nextStatus === "ACTIVE") {
        const vehicleIds = current.items.map((item) => item.vehicleId).sort();
        for (const vehicleId of vehicleIds) {
          await tx.$queryRawUnsafe(
            "SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))) AS advisory_lock",
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
    }
    return NextResponse.json({ updated: true, notification });
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
    return NextResponse.json({ reviewed: true });
  }

  return NextResponse.json({ error: "Unsupported booking action." }, { status: 400 });
}
