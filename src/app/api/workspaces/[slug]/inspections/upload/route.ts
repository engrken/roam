import { NextRequest,NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { head } from "@vercel/blob";
import { getTenantAccess,canManageFleet,workspaceWriteBlock,isTenantTrialReadOnly } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
export const runtime="nodejs";
export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const access=await getTenantAccess(slug);
 if(!access)return NextResponse.json({error:"Workspace access denied."},{status:404});
 const writeBlock=workspaceWriteBlock(access);if(writeBlock)return writeBlock;
 if(!canManageFleet(access.role))return NextResponse.json({error:"You cannot upload inspection photos."},{status:403});
 try{
  const body=await request.json();
  const result=await handleUpload({body,request,
   onBeforeGenerateToken:async(_pathname,clientPayload)=>{
    const payload=clientPayload?JSON.parse(clientPayload):{};
    const inspectionId=String(payload.inspectionId||"");
    const inspection=await prisma.vehicleInspection.findFirst({where:{id:inspectionId,tenantId:access.tenant.id},select:{id:true}});
    if(!inspection)throw new Error("Inspection record not found.");
    const clientIp=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-real-ip")||"unknown";
    const [userAllowed,ipAllowed]=await Promise.all([
     consumeRateLimit("inspection-photo-user",access.user.id,80,60*60*1000),
     consumeRateLimit("inspection-photo-ip",clientIp,120,60*60*1000),
    ]);
    if(!userAllowed||!ipAllowed)throw new Error("Too many inspection photo uploads. Please try again later.");
    return {allowedContentTypes:["image/jpeg","image/png","image/webp"],maximumSizeInBytes:5*1024*1024,addRandomSuffix:true,tokenPayload:JSON.stringify({inspectionId})};
   },
   onUploadCompleted:async({blob,tokenPayload})=>{
    const payload=JSON.parse(tokenPayload||"{}");const inspectionId=String(payload.inspectionId||"");
    if(!inspectionId)throw new Error("Missing inspection metadata.");
    const inspection=await prisma.vehicleInspection.findFirst({where:{id:inspectionId,tenantId:access.tenant.id},select:{id:true}});
    const tenant=await prisma.tenant.findUnique({where:{id:access.tenant.id},select:{status:true}});
    if(!inspection||!tenant||!["ACTIVE","TRIAL"].includes(tenant.status)||await isTenantTrialReadOnly(access.tenant.id))throw new Error("Inspection photo uploads are unavailable for this workspace.");
    const metadata=await head(blob.pathname);
    await prisma.vehicleInspectionPhoto.create({data:{inspectionId,pathname:blob.pathname,fileName:blob.pathname.split("/").pop()||"inspection-photo",contentType:metadata.contentType||blob.contentType||"image/jpeg",size:metadata.size}});
   }
  });
  return NextResponse.json(result);
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to upload inspection photo."},{status:400});}
}
