import { NextRequest,NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
export const runtime="nodejs";
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function GET(request:NextRequest,{params}:{params:Promise<{reference:string}>}){
 const {reference}=await params;const bearer=request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]||"";const token=bearer||request.nextUrl.searchParams.get("token")||"";
 if(token.length<20)return NextResponse.json({error:"A valid booking access link is required."},{status:401});
 const booking=await prisma.booking.findFirst({where:{reference,publicTokenHash:hash(token)},include:{tenant:{select:{name:true,phone:true}},customer:{select:{name:true}},items:{include:{vehicle:{select:{make:true,model:true}}}},messages:{orderBy:{createdAt:"asc"}},documents:{select:{id:true,kind:true,fileName:true,reviewStatus:true,createdAt:true}}}});
 if(!booking)return NextResponse.json({error:"Booking not found."},{status:404});
 return NextResponse.json({booking:{reference:booking.reference,status:booking.status,startAt:booking.startAt,endAt:booking.endAt,totalAmount:Number(booking.totalAmount),rentalTermsSnapshot:booking.rentalTermsSnapshot,rentalTermsAcceptedAt:booking.rentalTermsAcceptedAt,business:booking.tenant,customer:booking.customer,vehicles:booking.items.map(i=>i.vehicle),messages:booking.messages,documents:booking.documents}});
}
export async function POST(request:NextRequest,{params}:{params:Promise<{reference:string}>}){
 const {reference}=await params;const body=await request.json().catch(()=>null);const token=typeof body?.token==="string"?body.token:"";const message=typeof body?.message==="string"?body.message.trim():"";
 if(token.length<20||message.length<1||message.length>2000)return NextResponse.json({error:"Enter a message (up to 2,000 characters) using your booking access link."},{status:400});
 const booking=await prisma.booking.findFirst({where:{reference,publicTokenHash:hash(token)},select:{id:true}});
 if(!booking)return NextResponse.json({error:"Booking not found."},{status:404});
 await prisma.bookingMessage.create({data:{bookingId:booking.id,sender:"CUSTOMER",body:message}});
 return NextResponse.json({sent:true},{status:201});
}
