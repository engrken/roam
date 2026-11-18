import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Small database-backed fixed-window limiter that reuses the existing EmailOtp
 * table and its expiresAt index. It avoids provisioning Redis or another paid service.
 */
export async function consumeRateLimit(
  scope: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const digest = createHash("sha256").update(scope + ":" + key).digest("hex");
  const bucket = "rl-" + scope + "-" + digest + "@rate-limit.invalid";
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      "rate-limit:" + scope + ":" + digest,
    );
    await tx.emailOtp.deleteMany({
      where: { codeHash: "RATE_LIMIT", expiresAt: { lt: now } },
    });
    const count = await tx.emailOtp.count({
      where: { email: bucket, createdAt: { gt: windowStart } },
    });
    if (count >= limit) return false;

    await tx.emailOtp.create({
      data: {
        email: bucket,
        codeHash: "RATE_LIMIT",
        expiresAt: new Date(now.getTime() + windowMs),
        consumedAt: now,
      },
    });
    return true;
  });
}
