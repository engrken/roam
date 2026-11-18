import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { roamPrisma?: PrismaClient };

export const prisma = globalForPrisma.roamPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.roamPrisma = prisma;
