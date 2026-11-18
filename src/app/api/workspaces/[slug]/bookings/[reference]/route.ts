import {NextRequest,NextResponse} from "next/server";
import {getTenantAccess,canManageFleet} from "@/lib/tenant-access";
import {prisma} from "@/lib/prisma";
export const runtime="nodejs";
export async function GET(_request:NextRequest,{params}:{params:Promise<{slug:string;reference:string}>}){
 const {slug,reference}=await params;const access=await getTenantAccess(slug);if(!access)return NextResponse.json({error:"Workspace access denied."},{status:404});
 const booking=await prisma.booking.findFirst({where:{tenantId:access.tenant.id,reference},include:{customer:true,items:{include:{vehicle:true}},messages:{orderBy:{createdAt:"asc"}},documents:{orderBy:{createdAt:"desc"}}}});
 if(!booking)return NextResponse.json({error:"Booking not found."},{status:404});
 return NextResponse.json({booking:{id:booking.id,reference:booking.reference,status:booking.status,startAt:booking.startAt,endAt:booking.endAt,totalAmount:Number(booking.totalAmount),customer:booking.customer,vehicles:booking.items.map(i=>i.vehicle),messages:booking.messages,documents:booking.documents}});
}
export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string;reference:string}>}){
 const {slug,reference}=await params;const access=await getTenantAccess(slug);if(!access)return NextResponse.json({error:"Workspace access denied."},{status:404});if(!canManageFleet(access.role))return NextResponse.json({error:"You cannot manage bookings."},{status:403});
 const body=await request.json().catch(()=>null);const booking=await prisma.booking.findFirst({where:{tenantId:access.tenant.id,reference},select:{id:true}});
 if(!booking)return NextResponse.json({error:"Booking not found."},{status:404});
 if(typeof body?.message==="string"){const message=body.message.trim();if(!message||message.length>2000)return NextResponse.json({error:"Message must be 1–2,000 characters."},{status:400});await prisma.bookingMessage.create({data:{bookingId:booking.id,sender:"OWNER",body:message}});return NextResponse.json({sent:true},{status:201});}
 if(typeof body?.status==="string"&&["CONFIRMED","REJECTED","CANCELLED","ACTIVE","COMPLETED"].includes(body.status)){await prisma.booking.update({where:{id:booking.id},data:{status:body.status}});return NextResponse.json({updated:true});}
 if(typeof body?.documentId==="string"&&["APPROVED","REJECTED"].includes(body.reviewStatus)){const result=await prisma.bookingDocument.updateMany({where:{id:body.documentId,bookingId:booking.id},data:{reviewStatus:body.reviewStatus,reviewedAt:new Date()}});if(!result.count)return NextResponse.json({error:"Document not found."},{status:404});return NextResponse.json({reviewed:true});}
 return NextResponse.json({error:"Unsupported booking action."},{status:400});
}
