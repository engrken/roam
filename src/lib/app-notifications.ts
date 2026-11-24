import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

type AppNotificationInput = {
  tenantId: string;
  bookingId?: string | null;
  audience: "TENANT" | "CLIENT";
  type: string;
  title: string;
  message: string;
  actionUrl: string;
  dedupeKey: string;
};

/**
 * Store an action-required notice after its triggering business operation has committed.
 * A unique dedupe key makes retries safe. Notification failure must not roll back a booking,
 * message, upload, or payment review.
 */
export async function createAppNotification(input: AppNotificationInput) {
  try {
    await prisma.appNotification.createMany({
      data: [{
        id: randomUUID(),
        tenantId: input.tenantId,
        bookingId: input.bookingId ?? null,
        audience: input.audience,
        type: input.type,
        title: input.title.slice(0, 160),
        message: input.message.slice(0, 2000),
        actionUrl: input.actionUrl,
        dedupeKey: input.dedupeKey.slice(0, 240),
      }],
      skipDuplicates: true,
    });
  } catch (error) {
    console.error("Persistent in-app notification creation failed", {
      audience: input.audience,
      type: input.type,
      dedupeKey: input.dedupeKey,
      error,
    });
  }
}
