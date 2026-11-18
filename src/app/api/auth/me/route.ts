import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
    workspaces: user.memberships.map(({ role, tenant }) => ({
      id: tenant.id, name: tenant.name, slug: tenant.slug, role, status: tenant.status,
    })),
  });
}
