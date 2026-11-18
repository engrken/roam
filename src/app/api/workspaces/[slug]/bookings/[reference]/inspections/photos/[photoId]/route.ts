import {NextRequest,NextResponse} from "next/server";
import {get} from "@vercel/blob";
import {getTenantAccess,canManageFleet} from "@/lib/tenant-access";
import {prisma} from "@/lib/prisma";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:NextRequest,{params}:{params:Promise<{slug:string;reference:string;photoId:string}>}){
 const {slug,reference,photoId}=await params;const access=await getTenantAccess(slug);
 if(!access)return NextResponse.json({error:"Workspace access denied."},{status:404});
 if(!canManageFleet(access.role))return NextResponse.json({error:"You cannot view inspection photos."},{status:403});
 const photo=await prisma.vehicleInspectionPhoto.findFirst({where:{id:photoId,inspection:{tenantId:access.tenant.id,booking:{reference}}}});
 if(!photo)return NextResponse.json({error:"Photo not found."},{status:404});
 const blob=await get(photo.pathname,{access:"private"});
 if(!blob||blob.statusCode!==200||!blob.stream)return NextResponse.json({error:"Photo unavailable."},{status:404});
 return new NextResponse(blob.stream,{headers:{"Content-Type":photo.contentType,"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
}
