import { NextRequest, NextResponse } from "next/server";
import { getTenantAccess, canManageFleet, workspaceWriteBlock } from "@/lib/tenant-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fuels = ["EMPTY","QUARTER","HALF","THREE_QUARTERS","FULL"] as const;
const types = ["HANDOVER","RETURN"] as const;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug:string; reference:string }> }) {
 const {slug,reference}=await params; const access=await getTenantAccess(slug);
 if(!access)return NextResponse.json({error:"Workspace access denied."},{status:404});
 if(!canManageFleet(access.role))return NextResponse.json({error:"You cannot view inspection records."},{status:403});
 const booking=await prisma.booking.findFirst({where:{tenantId:access.tenant.id,reference},select:{id:true}});
 if(!booking)return NextResponse.json({error:"Booking not found."},{status:404});
 const inspections=await prisma.vehicleInspection.findMany({where:{tenantId:access.tenant.id,bookingId:booking.id},include:{vehicle:{select:{id:true,make:true,model:true,plateNumber:true}},photos:{select:{id:true,fileName:true,contentType:true,size:true,createdAt:true}}},orderBy:{inspectedAt:"desc"}});
 return NextResponse.json({inspections});
}

export async function POST(request:NextRequest,{params}:{params:Promise<{slug:string;reference:string}>}) {
 const {slug,reference}=await params;const access=await getTenantAccess(slug);
 if(!access)return NextResponse.json({error:"Workspace access denied."},{status:404});
 const writeBlock=workspaceWriteBlock(access);if(writeBlock)return writeBlock;
 if(!canManageFleet(access.role))return NextResponse.json({error:"You cannot save inspection records."},{status:403});
 const body=await request.json().catch(()=>null);
 const type=body?.type;const vehicleId=typeof body?.vehicleId==="string"?body.vehicleId:"";
 const odometerKm=Number(body?.odometerKm);const fuelLevel=body?.fuelLevel;
 const conditionNotes=typeof body?.conditionNotes==="string"?body.conditionNotes.trim():"";
 const damageNotes=typeof body?.damageNotes==="string"?body.damageNotes.trim():"";
 if(!types.includes(type)||!vehicleId||!Number.isSafeInteger(odometerKm)||odometerKm<0||odometerKm>2000000||!fuels.includes(fuelLevel)||conditionNotes.length<3||conditionNotes.length>2000||damageNotes.length>2000){
  return NextResponse.json({error:"Enter a valid inspection type, odometer, fuel level and condition notes."},{status:400});
 }
 const booking=await prisma.booking.findFirst({where:{tenantId:access.tenant.id,reference},select:{id:true,status:true,items:{where:{vehicleId},select:{vehicleId:true}}}});
 if(!booking||!booking.items.length)return NextResponse.json({error:"That vehicle is not part of this booking."},{status:404});
 if(type==="HANDOVER"&&booking.status!=="CONFIRMED"&&booking.status!=="ACTIVE")return NextResponse.json({error:"Handover inspections are available for confirmed bookings."},{status:409});
 if(type==="RETURN"&&booking.status!=="ACTIVE"&&booking.status!=="COMPLETED")return NextResponse.json({error:"Return inspections are available for active or completed bookings."},{status:409});
 if(type==="RETURN"&&booking.status==="COMPLETED")return NextResponse.json({error:"This booking has been completed and its return settlement is locked. Contact the workspace administrator for an amendment."},{status:409});
 const inspection=await prisma.vehicleInspection.upsert({
  where:{bookingId_vehicleId_type:{bookingId:booking.id,vehicleId,type}},
  create:{tenantId:access.tenant.id,bookingId:booking.id,vehicleId,type,odometerKm,fuelLevel,conditionNotes,damageNotes:damageNotes||null},
  update:{odometerKm,fuelLevel,conditionNotes,damageNotes:damageNotes||null},
  include:{vehicle:{select:{make:true,model:true,plateNumber:true}},photos:{select:{id:true,fileName:true}}},
 });
 return NextResponse.json({inspection},{status:201});
}
