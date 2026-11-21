import { NextRequest,NextResponse } from "next/server";
import { marketplaceLeadSchema } from "@/lib/marketplace-leads";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { prisma } from "@/lib/prisma";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const CONSENT_VERSION="marketplace-interest-2026-11-21";
export async function POST(request:NextRequest){
 const body=await request.json().catch(()=>null);
 if(!body||typeof body!=="object") return NextResponse.json({error:"Please check the form and try again."},{status:400});
 if(typeof body.companyWebsite==="string"&&body.companyWebsite.trim()) return NextResponse.json({success:true});
 const parsed=marketplaceLeadSchema.safeParse(body);
 if(!parsed.success) return NextResponse.json({error:"Please provide a valid name, email, city, and the required consent."},{status:400});
 const clientIp=getClientIp(request.headers);
 const [ipAllowed,emailAllowed]=await Promise.all([consumeRateLimit("marketplace-lead-ip",clientIp,8,3600000),consumeRateLimit("marketplace-lead-email",parsed.data.email,3,86400000)]);
 if(!ipAllowed||!emailAllowed) return NextResponse.json({error:"Too many submissions. Please try again later."},{status:429});
 try{
  const now=new Date();
  const lead=await prisma.marketplaceLead.upsert({
   where:{type_email:{type:parsed.data.type,email:parsed.data.email}},
   create:{type:parsed.data.type,fullName:parsed.data.fullName,email:parsed.data.email,phone:parsed.data.phone||null,city:parsed.data.city,providerType:parsed.data.providerType||null,vehicleCategory:parsed.data.vehicleCategory||null,contactConsentAt:now,consentVersion:CONSENT_VERSION},
   update:{fullName:parsed.data.fullName,phone:parsed.data.phone||null,city:parsed.data.city,providerType:parsed.data.providerType||null,vehicleCategory:parsed.data.vehicleCategory||null,contactConsentAt:now,consentVersion:CONSENT_VERSION},
   select:{id:true}
  });
  return NextResponse.json({success:true,id:lead.id},{status:201});
 }catch(error){console.error("Marketplace interest submission failed",error);return NextResponse.json({error:"We couldn't save your interest right now. Please try again later."},{status:500});}
}
