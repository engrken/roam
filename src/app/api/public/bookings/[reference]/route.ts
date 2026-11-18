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
 return NextResponse.json({booking:{reference:booking.reference,status:booking.status,startAt:booking.startAt,endAt:booking.endAt,totalAmount:Number(booking.totalAmount),business:booking.tenant,customer:booking.customer,vehicles:booking.items.map(i=>i.vehicle),messages:booking.messages,documents:booking.documents}});
}
export async function POST(request:NextRequest,{params}:{params:Promise<{reference:string}>}){
 const {reference}=¶»§q«^