import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      documents: booking.documents,
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string; reference: string }> }) {
  const { slug, reference } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) {
    return NextResponse.json({ error: "You cannot manage bookings." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const booking = await prisma.booking.findFirst({
    where: { tenantId: access.tenant.id, reference },
    select: { id: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  if (typeof body?.message === "string") {
    const message = body.message.trim();
    if (!message || message.length > 2000) {
      return NextResponse.json({ error: "Message must be 1–2,000 characters." }, { status: 400 });
    }
    await prisma.bookingMessage.create({
      data: { bookingId: booking.id, sender: "OWNER", body: message },
    });
    return NextResponse.json({ sent: true }, { status: 201 });
  }

  if (typeof body?.status === "string") {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.booking.findFirst({
        where: { id: booking.id, tenantId: access.tenant.id },
        select: { id: true, status: true, startAt: true, endAt: true, items: { select: { vehicleId: true } } },
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
            "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
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
      await tx.bookingMessage.create({
        data: {
          bookingId: current.id,
          sender: "SYSTEM",
          body: "Booking status changed from " + current.status + " to " + nextStatus + " by the rental team.",
        },
      });
      return { updated: true };
    });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ updated: true });
  }

  if (typeof body?.documentId === "string" && ["APPROVED", "REJECTED"].includes(body.reviewStatus)) {
    const result = await prisma.bookingDocument.updateMany({
      where: { id: body.documentId, bookingId: booking.id },
      data: { reviewStatus: body.reviewStatus, reviewedAt: new Date() },
    });
    if (!result.count) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    return NextResponse.json({ reviewed: true });
  }

  return NextResponse.json({ error: "Unsupported booking action." }, { status: 400 });
}
