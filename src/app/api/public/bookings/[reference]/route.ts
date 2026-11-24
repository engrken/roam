import { NextRequest,NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createAppNotification } from "@/lib/app-notifications";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { sendBookingMessageNotification } from "@/lib/email";
import { isTenantTrialReadOnly } from "@/lib/tenant-access";
export const runtime="nodejs";
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function GET(request:NextRequest,{params}:{params:Promise<{reference:string}>}){
 const {reference}=await params;const bearer=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]||"";const token=bearer||request.nextUrl.searchParams.get("token")||"";
 if(token.length<20)return NextResponse.json({error:"A valid booking access link is required."},{status:401});
 const booking=await prisma.booking.findFirst({where:{reference,publicTokenHash:hash(token)},include:{tenant:{select:{name:true,phone:true,currency:true,timezone:true}},customer:{select:{name:true}},items:{select:{rate:true,vehicle:{select:{make:true,model:true,year:true,type:true,transmission:true,seats:true,branch:{select:{name:true,address:true}}}}}},payments:{orderBy:{receivedAt:"desc"},select:{amount:true,kind:true,method:true,reference:true,receivedAt:true}},messages:{orderBy:{createdAt:"asc"}},documents:{select:{id:true,kind:true,fileName:true,reviewStatus:true,createdAt:true}}}});
 if(!booking)return NextResponse.json({error:"Booking not found."},{status:404});
 const paidAmount=booking.payments.reduce((sum,payment)=>sum+(payment.kind==="REFUND"?-Number(payment.amount):Number(payment.amount)),0);
 const totalAmount=Number(booking.totalAmount);
 const securityDeposit=Number(booking.securityDeposit || 0);
 const totalPayable=totalAmount+securityDeposit;
 return NextResponse.json({booking:{reference:booking.reference,status:booking.status,startAt:booking.startAt,endAt:booking.endAt,totalAmount,securityDeposit,totalPayable,paidAmount:Math.max(0,paidAmount),balanceDue:Math.max(0,totalPayable-paidAmount),rentalTermsSnapshot:booking.rentalTermsSnapshot,rentalTermsAcceptedAt:booking.rentalTermsAcceptedAt,business:booking.tenant,customer:booking.customer,vehicles:booking.items.map(i=>({rate:Number(i.rate),...i.vehicle})),payments:booking.payments.map(payment=>({...payment,amount:Number(payment.amount)})),messages:booking.messages,documents:booking.documents}});
}
export async function POST(request:NextRequest,{params}:{params:Promise<{reference:string}>}){
 const {reference}=await params;const body=await request.json().catch(()=>null);const token=typeof body?.token==="string"?body.token:"";const message=typeof body?.message==="string"?body.message.trim():"";
 if(token.length<20||message.length<1||message.length>2000)return NextResponse.json({error:"Enter a message (up to 2,000 characters) using your booking access link."},{status:400});
 const booking=await prisma.booking.findFirst({where:{reference,publicTokenHash:hash(token)},select:{id:true,tenantId:true,tenant:{select:{name:true,email:true,slug:true,status:true}}}});
 if(!booking)return NextResponse.json({error:"Booking not found."},{status:404});
 if(!["ACTIVE","TRIAL"].includes(booking.tenant.status))return NextResponse.json({error:"This rental business is not currently accepting messages."},{status:423});
 const clientIp=getClientIp(request.headers);
 const [bookingAllowed,ipAllowed]=await Promise.all([
  consumeRateLimit("customer-booking-message",booking.id,10,60*60*1000),
  consumeRateLimit("customer-booking-message-ip",clientIp,40,60*60*1000),
 ]);
 if(!bookingAllowed||!ipAllowed)return NextResponse.json({error:"Too many messages. Please try again later."},{status:429});
 if(await isTenantTrialReadOnly(booking.tenantId))return NextResponse.json({error:"Messaging is temporarily unavailable because this rental workspace is in read-only mode."},{status:423});
 const savedMessage=await prisma.bookingMessage.create({data:{bookingId:booking.id,sender:"CUSTOMER",body:message},select:{id:true}});
 await createAppNotification({
  tenantId:booking.tenantId,bookingId:booking.id,audience:"TENANT",
  type:"CUSTOMER_MESSAGE",title:"New message from a customer",
  message:"A customer sent a message about booking "+reference+".",
  actionUrl:"/workspace/"+encodeURIComponent(booking.tenant.slug)+"/bookings",
  dedupeKey:"customer-message:"+savedMessage.id,
 });
 try {
  await sendBookingMessageNotification({recipient:booking.tenant.email,tenantName:booking.tenant.name,bookingReference:reference,senderLabel:"Customer",message,workspaceUrl:(process.env.NEXT_PUBLIC_APP_URL || "https://roamph.vercel.app")+"/workspace/"+encodeURIComponent(booking.tenant.slug)+"/bookings"});
 } catch (error) { console.error("Customer message email notification failed", error); }
 return NextResponse.json({sent:true,notification:"attempted"},{status:201});
}
