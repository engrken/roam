import { NextRequest,NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { head } from "@vercel/blob";
import { getTenantAccess,canManageFleet } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
export const runtime="nodejs";
export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const access=await getTenantAccess(slug);
 if(!access)return NextResponse.json({error:"Workspace access denied."},{status:404});
 if(!canManageFleet(access.role))return NextResponse.json({error:"You cannot upload inspection photos."},{status:403});
 try{
  const body=await request.json();
  const result=await handleUpload({body,request,
   onBeforeGenerateToken:async(_pathname,clientPayload)=>{
    const payload=clientPayload?JSON.parse(clientPayload):{};
    const inspectionId=String(payload.inspectionId||"");
    const inspection=await prisma.vehicleInspection.findFirst({where:{id:inspectionId,tenantId:access.tenant.id},select:{id:true}});
    if(!inspection)throw new Error("Inspection record not found.");
    return {allowedContentTypes:["image/jpeg","image/png","image/webp"],maximumSizeInBytes:5*1024*1024,addRandomSuffix:true,tokenPayload:JSON.stringify({inspectionId})};
   },
   onUploadCompleted:async({blob,tokenPayload})=>{
    const payload=JSON.parse(tokenPayload||"{}");const inspectionId=String(payload.inspectionId||"");
    if(!inspectionId)throw new Error("Missing inspection metadata.");
    const metadata=await head(blob.pathname);
    await prisma.vehicleInspectionPhoto.create({data:{inspectionId,pathname:blob.pathname,fileName:blob.pathname.split("/").pop()||"inspection-photo",contentType:metadata.contentType||blob.contentType||"image/jpeg",size:metadata.size}});
   }
  });
  return NextResponse.json(result);
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to upload inspection photo."},{status:400});}
}
