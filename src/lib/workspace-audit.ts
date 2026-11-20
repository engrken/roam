import { Prisma } from "@prisma/client";

type AuditTransaction = Prisma.TransactionClient;

type WorkspaceAuditEvent = {
  tenantId: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, string | number | boolean | null>;
};

export async function recordWorkspaceAudit(tx: AuditTransaction, event: WorkspaceAuditEvent) {
  await tx.platformAuditLog.create({
    data: {
      actorUserId: event.actorUserId,
      actorEmail: event.actorEmail,
      action: "workspace." + event.action,
      entityType: "workspace",
      entityId: event.tenantId,
      details: {
        targetType: event.targetType,
        targetId: event.targetId,
        ...(event.details || {}),
      },
    },
  });
}
