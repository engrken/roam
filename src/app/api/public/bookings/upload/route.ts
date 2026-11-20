import { NextRequest,NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { head } from "@vercel/blob";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isTenantTrialReadOnly } from "@/lib/tenant-access";
export const runtime="nodejs";
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function POST(request:NextRequest){
 try{
  const body=await request.json();
  const result=await handleUpload({body,request,
   onBeforeGenerateToken:async(pathname,clientPayload)=>{
    const payload=clientPayload?JSON.parse(clientPayload):{};
    const reference=String(payload.reference||"");const token=String(payload.token||"");const kind=String(payload.kind||"");
    if(!["DRIVERS_LICENSE_FRONT","DRIVERS_LICENSE_BACK","IDENTITY_DOCUMENT","OTHER_REQUIREMENT","MESSAGE_ATTACHMENT","PAYMENT_EVIDENCE"].includes(kind)||token.length<20)throw new Error("Invalid document upload request.");
    const booking=await prisma.booking.findFirst({where:{reference,publicTokenHash:hash(token)},select:{id:true,tenantId:true,tenant:{select:{status:true}}}});
    if(!booking)throw new Error("Booking access link is invalid.");
    if(!["ACTIVE","TRIAL"].includes(booking.tenant.status))throw new Error("This rental business is not currently accepting document uploads.");
    const clientIp=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-real-ip")||"unknown";
    const [bookingAllowed,ipAllowed]=await Promise.all([
     consumeRateLimit("customer-booking-upload",booking.id,12,60*60*1000),
     consumeRateLimit("customer-booking-upload-ip",clientIp,40,60*60*1000),
    ]);
    if(!bookingAllowed||!ipAllowed)throw new Error("Too many document uploads. Please try again later.");
    if(await isTenantTrialReadOnly(booking.tenantId))throw new Error("Document uploads are temporarily unavailable because this rental workspace is in read-only mode.");
    return {allowedContentTypes:["image/jpeg","image/png","image/webp","application/pdf"],maximumSizeInBytes:8*1024*1024,addRandomSuffix:true,tokenPayload:JSON.stringify({bookingId:booking.id,kind})};
   },
   onUploadCompleted:async({blob,tokenPayload})=>{
    const payload=JSON.parse(tokenPayload||"{}");
    const bookingId=String(payload.bookingId||"");const kind=String(payload.kind||"");
    if(!bookingId||!kind)throw new Error("Missing booking upload metadata.");
    const booking=await prisma.booking.findUnique({where:{id:bookingId},select:{tenantId:true,tenant:{select:{status:true}}}});
    if(!booking||!["ACTIVE","TRIAL"].includes(booking.tenant.status)||await isTenantTrialReadOnly(booking.tenantId))throw new Error("Document uploads are unavailable for this workspace.");
    const metadata = await head(blob.pathname);
    await prisma.bookingDocument.create({data:{bookingId,kind,pathname:blob.pathname,fileName:blob.pathname.split("/").pop()||"document",contentType:metadata.contentType||blob.contentType||"application/octet-stream",size:metadata.size}});
   }
  });
  return NextResponse.json(result);
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to upload document."},{status:400});}
}
