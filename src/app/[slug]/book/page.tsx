"use client";
import {useEffect,useState,FormEvent} from "react";
import {useParams} from "next/navigation";
import {upload} from "@vercel/blob/client";
import Link from "next/link";
type Vehicle={id:string;type:string;make:string;model:string;year:number|null;dailyRate:number;securityDeposit:number;branch:{name:string;address:string|null}|null};
export default function PublicBookPage(){
 const {slug}=useParams<{slug:string}>();const [business,setBusiness]=useState<{name:string;phone:string|null}|null>(null);const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [vehicleId,setVehicleId]=useState("");const [name,setName]=useState("");const [email,setEmail]=useState("");const [phone,setPhone]=useState("");const [startAt,setStartAt]=useState("");const [endAt,setEndAt]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [booking,setBooking]=useState<{reference:string;accessToken:string}|null>(null);
 useEffect(()=>{fetch("/api/public/"+encodeURIComponent(slug)+"/bookings").then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setBusiness(d.business);setVehicles(d.vehicles||[]);}).catch(e=>setError(e.message||"Unable to load vehicles."));},[slug]);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/public/"+encodeURIComponent(slug)+"/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email,phone,vehicleId,startAt,endAt})});const d=await r.json();if(!r.ok)throw new Error(d.error);setBooking(d);}catch(e){setError(e instanceof Error?e.message:"Unable to submit request.");}finally{setBusy(false);}}
 const chosen=vehicles.find(v=>v.id===vehicleId);
 return <main style={{maxWidth:760,margin:"40px auto",padding:24,fontFamily:"Arial,sans-serif",color:"#18332d"}}>
 <Link href="/">← ROAM</Link><h1>Book a vehicle{business?" with "+business.name:""}</h1><p>Choose a vehicle and send a booking request. The rental team will confirm availability and requirements.</p>
 {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
 {booking?<section><h2>Request submitted</h2><p>Your reference is <b>{booking.reference}</b>. Save this private link to upload documents and message the rental team.</p><Link href={"/booking/"+encodeURIComponent(booking.reference)+"?token="+encodeURIComponent(booking.accessToken)}>Open booking and upload documents →</Link></section>:
 <form onSubmit={submit} style={{display:"grid",gap:14}}>
 <label>Vehicle<select required value={vehicleId} onChange={e=>setVehicleId(e.target.value)} style={{display:"block",width:"100%",padding:12}}><option value="">Choose an available vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.year||""} {v.make} {v.model} — ₱{v.dailyRate.toLocaleString()}/day</option>)}</select></label>
 {chosen&&<p>Security deposit: ₱{chosen.securityDeposit.toLocaleString()} · Pickup: {chosen.branch?.name||"Confirm with owner"}</p>}
 <label>Full name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} style={{display:"block",width:"100%",padding:12}}/></label>
 <label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} style={{display:"block",width:"100%",padding:12}}/></label>
 <label>Mobile number<input required value={phone} onChange={e=>setPhone(e.target.value)} style={{display:"block",width:"100%",padding:12}}/></label>
 <label>Pickup date and time<input required type="datetime-local" value={startAt} onChange={e=>setStartAt(e.target.value)} style={{display:"block",width:"100%",padding:12}}/></label>
 <label>Return date and time<input required type="datetime-local" value={endAt} onChange={e=>setEndAt(e.target.value)} style={{display:"block",width:"100%",padding:12}}/></label>
 <button disabled={busy||!vehicles.length} style={{padding:14,background:"#176b5d",color:"white",border:0,borderRadius:8}}>{busy?"Submitting…":"Request booking"}</button>
 <small>Submitting a request does not confirm a rental. The owner must approve your booking and documents.</small>
 </form>}
 </main>
}
