import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("roam_session")?.value;
  if (token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
  const response = NextResponse.json({ message: "Signed out." });
  response.cookies.set("roam_session", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
