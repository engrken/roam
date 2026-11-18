import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getTenantAccess, canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string; reference: string; documentId: string }> }) {
  const { slug, reference, documentId } = await params;
  const access = await getTenantAccess(slug);
  if (!access) return NextResponse.json({ error: "Workspace access denied." }, { status: 404 });
  if (!canManageFleet(access.role)) return NextResponse.json({ error: "You cannot review customer documents." }, { status: 403 });
  const document = await prisma.bookingDocument.findFirst({ where: { id: documentId, booking: { reference, tenantId: access.tenant.id } } });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const blob = await get(document.pathname, { access: "private" });
  if (!blob || blob.statusCode !== 200 || !blob.stream) return NextResponse.json({ error: "The private document is unavailable." }, { status: 404 });
  const safeName = document.fileName.replace(/[\r\n"]/g, "_");
  return new NextResponse(blob.stream, { headers: {
    "Content-Type": document.contentType,
    "Content-Disposition": `inline; filename="${safeName}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}
