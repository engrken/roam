import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const hash = (v:string) => createHash("sha256").update(v).digest("hex");

export async function GET(_request:NextRequest,{params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params;
  const tenant=await prisma.tenant.findUnique({where:{slug},select:{id:true,name:true,phone:true,currency:true}});
  if(!tenant)return NextResponse.json({error:"Rental business not found."},{status:404});
  const vehicles=await prisma.vehicle.findMany({where:{tenantId:tenant.id,status:"AVAILABLE"},orderBy:{createdAt:"desc"},select:{id:true,type:true,make:true,model:true,year:true,color:true,seats:true,transmission:true,dailyRate:true,securityDeposit:true,branch:{select:{name:true,address:true}}}});
  return NextResponse.json({business:tenant,vehicles:vehicles.map(v=>({...v,dailyRate:Number(v.dailyRate),securityDeposit:Number(v.securityDeposit)}))});
}

export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string}>}) {
  const {slug}=await params; const body=await request.json().catch(()=>null);
  const tenant=await prisma.tenant.findUnique({where:{slug},select:{id:true,status:true}});
  if(!tenant||!["ACTIVE","TRIAL"].includes(tenant.status))return NextResponse.json({error:"Rental business is unavailable."},{status:404});
  const name=typeof body?.name==="string"?body.name.trim():"";
  const email=typeof body?.email==="string"?body.email.trim().toLowerCase():"";
  const phone=typeof body?.phone==="string"?body.phone.trim():"";
  const vehicleId=typeof body?.vehicleId==="string"?body.vehicleId:"";
  const startAt=new Date(body?.startAt),endAt=new Date(body?.endAt);
  if(name.length<2||!/^\S+@\S+\.\S+$/.test(email)||phone.length<7||!vehicleId||!Number.isFinite(startAt.getTime())||!Number.isFinite(endAt.getTime())||startAt<=new Date()||endAt<=startAt)return NextResponse.json({error:"Please provide valid contact details and rental dates."},{status:400});
  const vehicle=await prisma.vehicle.findFirst({where:{id:vehicleId,tenantId:tenant.id,status:"AVAILABLE"},select:{id:true,branchId:true,dailyRate:true}});
  if(!vehicle)return NextResponse.json({error:"This vehicle is not currently available."},{status:409});
  const conflict=await prisma.booking.findFirst({where:{tenantId:tenant.id,status:{in:["PENDING","CONFIRMED","ACTIVE"]},startAt:{lt:endAt},endAt:{gt:startAt},items:{some:{vehicleId}}},select:{id:true}});
  if(conflict)return NextResponse.json({error:"Those dates are no longer available. Please choose another period."},{status:409});
  const days=Math.max(1,Math.ceil((endAt.getTime()-startAt.getTime())/86400000));
  const customer=await prisma.customer.findFirst({where:{tenantId:tenant.id,email}});
  const savedCustomer=customer?await prisma.customer.update({where:{id:customer.id},data:{name,phone}}):await prisma.customer.create({data:{tenantId:tenant.id,name,email,phone}});
  const reference="RM-"+randomBytes(4).toString("hex").toUpperCase();
  const token=randomBytes(32).toString("base64url");
  const booking=await prisma.booking.create({data:{tenantId:tenant.id,branchId:vehicle.branchId,customerId:savedCustomer.id,reference,status:"PENDING",startAt,endAt,totalAmount:vehicle.dailyRate.mul(days),publicTokenHash:hash(token),items:{create:{vehicleId:vehicle.id,rate:vehicle.dailyRate}},messages:{create:{sender:"SYSTEM",body:"Booking request submitted. The rental team will review your request and reply here."}}},select:{reference:true}});
  return NextResponse.json({reference:booking.reference,accessToken:token,status:"PENDING"}, {status:201});
}
