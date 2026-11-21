import { NextRequest,NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const statuses=["NEW","CONTACTED","QUALIFIED","WAITLISTED","ARCHIVED"] as const;
const leadTypes=["HOST","RENTER"] as const;
export async function GET(request:NextRequest){
 const admin=await getPlatformAdmin();if(!admin)return NextResponse.json({error:"Platform administrator access required."},{status:403});
 const typeParam=request.nextUrl.searchParams.get("type"),statusParam=request.nextUrl.searchParams.get("status"),query=(request.nextUrl.searchParams.get("q")||"").trim().slice(0,100);
 const where:Prisma.MarketplaceLeadWhereInput={};
 if(leadTypes.includes(typeParam as (typeof leadTypes)[number]))where.type=typeParam as (typeof leadTypes)[number];
 if(statuses.includes(statusParam as (typeof statuses)[number]))where.status=statusParam as (typeof statuses)[number];
 if(query)where.OR=[{fullName:{contains:query,mode:"insensitive"}},{email:{contains:query,mode:"insensitive"}},{city:{contains:query,mode:"insensitive"}},{phone:{contains:query,mode:"insensitive"}}];
 const leads=await prisma.marketplaceLead.findMany({where,orderBy:{createdAt:"desc"},take:200,select:{id:true,type:true,status:true,fullName:true,email:true,phone:true,city:true,providerType:true,vehicleCategory:true,contactConsentAt:true,createdAt:true,updatedAt:true}});
 return NextResponse.json({leads});
}
export async function PATCH(request:NextRequest){
 const admin=await getPlatformAdmin();if(!admin)return NextResponse.json({error:"Platform administrator access required."},{status:403});
 const body=await request.json().catch(()=>null),id=typeof body?.id==="string"?body.id.trim():"",status=body?.status;
 if(!id||!statuses.includes(status))return NextResponse.json({error:"Choose a valid lead and status."},{status:400});
 try{
  const updated=await prisma.$transaction(async tx=>{
   const previous=await tx.marketplaceLead.findUnique({where:{id}});if(!previous)return null;
   const next=await tx.marketplaceLead.update({where:{id},data:{status}});
   if(previous.status!==next.status)await tx.platformAuditLog.create({data:{actorUserId:admin.id,actorEmail:admin.email,action:"marketplace.lead.status.updated",entityType:"marketplace_lead",entityId:id,details:{from:previous.status,to:next.status,type:previous.type}}});
   return next;
  });
  if(!updated)return NextResponse.json({error:"Marketplace lead not found."},{status:404});
  return NextResponse.json({lead:{id:updated.id,status:updated.status}});
 }catch(error){console.error("Marketplace lead update failed",error);return NextResponse.json({error:"Unable to update this marketplace lead."},{status:500});}
}
