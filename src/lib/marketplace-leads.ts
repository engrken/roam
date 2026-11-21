import { z } from "zod";
export const marketplaceLeadSchema = z.object({
  type:z.enum(["HOST","RENTER"]),
  fullName:z.string().trim().min(2).max(100),
  email:z.string().trim().toLowerCase().email().max(254),
  phone:z.string().trim().max(30).optional().or(z.literal("")),
  city:z.string().trim().min(2).max(100),
  providerType:z.enum(["INDIVIDUAL","BUSINESS"]).optional().or(z.literal("")),
  vehicleCategory:z.enum(["MOTORCYCLE","SCOOTER","CAR","SUV","VAN","PICKUP","BUS","TRUCK","OTHER"]).optional(),
  consent:z.literal(true),
}).superRefine((value,ctx)=>{
  if(value.type==="HOST"&&!value.providerType) ctx.addIssue({code:"custom",path:["providerType"],message:"Choose a host type."});
  if(value.type==="HOST"&&!value.vehicleCategory) ctx.addIssue({code:"custom",path:["vehicleCategory"],message:"Choose a vehicle category."});
});
