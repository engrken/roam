"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
type LeadType = "HOST" | "RENTER";
type FormState = { fullName:string; email:string; phone:string; city:string; providerType:string; vehicleCategory:string; consent:boolean; companyWebsite:string };
const initialForm: FormState = { fullName:"", email:"", phone:"", city:"", providerType:"INDIVIDUAL", vehicleCategory:"", consent:false, companyWebsite:"" };
const vehicleOptions = [["MOTORCYCLE","Motorcycle"],["SCOOTER","Scooter"],["CAR","Car"],["SUV","SUV / Crossover"],["VAN","Van / MPV"],["PICKUP","Pickup"],["BUS","Bus"],["TRUCK","Truck"],["OTHER","Other vehicle"]];
export default function MarketplaceInterestForm({ type }: { type:LeadType }) {
  const [values,setValues]=useState<FormState>(initialForm);
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState(false);
  const isHost=type==="HOST";
  function update<K extends keyof FormState>(key:K,value:FormState[K]) { setValues(current=>({...current,[key]:value})); }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError(""); setSuccess(false);
    try {
      const response=await fetch("/api/public/marketplace-leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        type,fullName:values.fullName,email:values.email,phone:values.phone,city:values.city,
        providerType:isHost?values.providerType:undefined,vehicleCategory:values.vehicleCategory||undefined,
        consent:values.consent,companyWebsite:values.companyWebsite
      })});
      const body=await response.json();
      if(!response.ok) throw new Error(body.error||"We couldn't save your interest. Please try again.");
      setSuccess(true); setValues(initialForm);
    } catch(reason) { setError(reason instanceof Error?reason.message:"We couldn't save your interest. Please try again."); }
    finally { setSubmitting(false); }
  }
  if(success) return <div className="marketplace-form-success" role="status" aria-live="polite"><span className="marketplace-success-mark">✓</span>
    <h2>{isHost?"You’re on the host interest list.":"You’re on the early-access list."}</h2>
    <p>Thanks for helping shape ROAM Marketplace. We’ve saved your interest and may contact you about launch updates.</p>
    <Link href="/marketplace">Explore the marketplace plan <span aria-hidden="true">→</span></Link>
  </div>;
  return <form className="marketplace-interest-form" onSubmit={submit}>
    <div className="marketplace-form-grid">
      <label className="marketplace-field"><span>Full name</span><input autoComplete="name" required minLength={2} maxLength={100} value={values.fullName} onChange={e=>update("fullName",e.target.value)} placeholder="Your name"/></label>
      <label className="marketplace-field"><span>Email address</span><input type="email" autoComplete="email" required maxLength={254} value={values.email} onChange={e=>update("email",e.target.value)} placeholder="you@example.com"/></label>
      <label className="marketplace-field"><span>City or area</span><input autoComplete="address-level2" required minLength={2} maxLength={100} value={values.city} onChange={e=>update("city",e.target.value)} placeholder="e.g. Cebu City"/></label>
      <label className="marketplace-field"><span>Phone number <small>Optional</small></span><input type="tel" autoComplete="tel" maxLength={30} value={values.phone} onChange={e=>update("phone",e.target.value)} placeholder="+63"/></label>
      {isHost&&<label className="marketplace-field"><span>What best describes you?</span><select required value={values.providerType} onChange={e=>update("providerType",e.target.value)}><option value="INDIVIDUAL">Individual vehicle owner</option><option value="BUSINESS">Rental business</option></select></label>}
      <label className="marketplace-field"><span>{isHost?"Vehicle category you may list":"Vehicle category you're interested in"} <small>{isHost?"Required":"Optional"}</small></span><select required={isHost} value={values.vehicleCategory} onChange={e=>update("vehicleCategory",e.target.value)}><option value="">Choose a category</option>{vehicleOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <div className="marketplace-honeypot" aria-hidden="true"><label>Leave this field empty<input tabIndex={-1} autoComplete="off" value={values.companyWebsite} onChange={e=>update("companyWebsite",e.target.value)}/></label></div>
    <label className="marketplace-consent"><input type="checkbox" required checked={values.consent} onChange={e=>update("consent",e.target.checked)}/><span>I agree ROAM may contact me about marketplace early access and this request. I have read the <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
    {error&&<p className="marketplace-form-error" role="alert">{error}</p>}
    <button className="marketplace-submit" type="submit" disabled={submitting}>{submitting?"Submitting…":isHost?"Register my interest as a host":"Join the renter early-access list"}<span aria-hidden="true">→</span></button>
    <p className="marketplace-form-note">This is an interest form only. It does not create a vehicle listing, make a reservation, or collect payment.</p>
  </form>;
}
