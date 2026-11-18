"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Search, Users, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";

type Customer = { id:string; name:string; email:string|null; phone:string; licenseNo:string|null; address:string|null; createdAt:string; updatedAt:string; bookingsCount:number; lifetimeValue:number };
const empty = { name:"", phone:"", email:"", licenseNo:"", address:"" };
const money = (n:number) => new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:0}).format(n);

export default function CustomersPage() {
 const {slug}=useParams<{slug:string}>();
 const [rows,setRows]=useState<Customer[]>([]); const [search,setSearch]=useState(""); const [form,setForm]=useState(empty);
 const [editing,setEditing]=useState<string|null>(null); const [showForm,setShowForm]=useState(false); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch("/api/workspaces/"+encodeURIComponent(slug)+"/customers?q="+encodeURIComponent(search),{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load customers.");setRows(d.customers||[]);}catch(e){setError(e instanceof Error?e.message:"Unable to load customers.");}finally{setLoading(false);}},[slug,search]);
 useEffect(()=>{const t=setTimeout(()=>void load(),180);return()=>clearTimeout(t);},[load]);
 const totalBookings=useMemo(()=>rows.reduce((n,c)=>n+c.bookingsCount,0),[rows]);
 function edit(c:Customer){setEditing(c.id);setForm({name:c.name,phone:c.phone,email:c.email||"",licenseNo:c.licenseNo||"",address:c.address||""});setShowForm(true);}
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/workspaces/"+encodeURIComponent(slug)+"/customers",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editing?{...form,id:editing}:form)});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save customer.");setForm(empty);setEditing(null);setShowForm(false);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to save customer.");}finally{setBusy(false);}}
 if(loading)return <main className="roam-loading">Loading customer records…</main>;
 return <div className="roam-app-shell"><WorkspaceNav slug={slug} name="Customer management" role="Workspace team" active="customers"/><main className="roam-main">
  <header className="roam-topbar"><div><Link href={"/workspace/"+slug} className="roam-back-link"><ArrowLeft size={14}/> Overview</Link><span className="roam-eyebrow">CUSTOMER RELATIONSHIPS</span><h1>Customers</h1><p>Maintain customer contact details, rental history and lifetime booking value.</p></div><div className="roam-topbar-actions"><button className="roam-secondary-btn" onClick={()=>{setLoading(true);void load();}}><RefreshCw size={15}/> Refresh</button><button className="roam-primary-btn" onClick={()=>{setEditing(null);setForm(empty);setShowForm(v=>!v);}}><Plus size={16}/> Add customer</button></div></header>
  {error&&<p className="roam-error" role="alert">{error}</p>}
  <section className="roam-booking-stats"><article><span>Customers shown</span><b>{rows.length}</b></article><article><span>Bookings represented</span><b>{totalBookings}</b></article><article><span>With email</span><b>{rows.filter(c=>c.email).length}</b></article><article><span>Repeat customers</span><b>{rows.filter(c=>c.bookingsCount>1).length}</b></article></section>
  {showForm&&<form className="roam-panel roam-vehicle-form" onSubmit={save}><div className="roam-panel-heading"><div><span className="roam-eyebrow">{editing?"CUSTOMER PROFILE":"NEW CUSTOMER"}</span><h2>{editing?"Edit customer":"Add customer"}</h2></div><button type="button" className="roam-quiet-btn" onClick={()=>setShowForm(false)}><X size={15}/> Close</button></div><div className="roam-form-grid">
   <label>Full name<input required minLength={2} maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label>Phone number<input required minLength={5} maxLength={30} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
   <label>Email address<input type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
   <label>Driver's license number<input maxLength={60} value={form.licenseNo} onChange={e=>setForm({...form,licenseNo:e.target.value.toUpperCase()})}/></label>
   <label>Address<input maxLength={300} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
  </div><button className="roam-primary-btn" disabled={busy}>{busy?"Saving…":editing?"Save changes":"Create customer"}</button></form>}
  <section className="roam-panel roam-table-panel"><div className="roam-panel-heading"><div><span className="roam-eyebrow">CUSTOMER REGISTER</span><h2>Customer records</h2></div><span className="roam-panel-total">{rows.length} records</span></div>
   <div className="roam-table-tools"><label className="roam-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, email or license"/></label></div>
   {rows.length?<div className="roam-table-scroll"><table className="roam-table"><thead><tr><th>Customer</th><th>Phone</th><th>License</th><th>Bookings</th><th>Lifetime value</th><th>Action</th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td><div className="roam-vehicle-cell"><span className="roam-vehicle-avatar"><Users size={17}/></span><span><b>{c.name}</b><small>{c.email||"No email"} · {c.address||"No address"}</small></span></div></td><td>{c.phone}</td><td>{c.licenseNo||"—"}</td><td>{c.bookingsCount}</td><td>{money(c.lifetimeValue)}</td><td><button className="roam-link-btn" onClick={()=>edit(c)}>Edit profile</button></td></tr>)}</tbody></table></div>:<div className="roam-empty"><Users size={28}/><b>No customer records found</b><span>Customers added through bookings will appear here automatically.</span></div>}
  </section><footer className="roam-footer">ROAM Customer Management <span>Customer records are visible only to authorized workspace managers.</span></footer>
 </main></div>;
}
