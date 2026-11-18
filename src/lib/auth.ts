import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const token = (await cookies()).get("roam_session")?.value;
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { memberships: { include: { tenant: true } } } } },
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
}
