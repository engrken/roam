"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Search, CarFront, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";

type Vehicle={id:string;type:string;make:string;model:string;year:number|null;plateNumber:string;color:string|null;dailyRate:number;securityDeposit:number;status:string;branchId:string|null;branchName:string};
type Branch={id:string;name:string;code:string|null};
const types=["MOTORCYCLE","SCOOTER","SEDAN","HATCHBACK","SUV","MPV","VAN","PICKUP","BUS","TRUCK","OTHER"];
const statuses=["AVAILABLE","RESERVED","RENTED","MAINTENANCE","INACTIVE"];
const money=(v:number)=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:0}).format(v);

export default function FleetPage(){
 const {slug}=useParams<{slug:string}>();const router=useRouter();
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);const [branches,setBranches]=useState<Branch[]>([]);
 const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [search,setSearch]=useState("");const [filter,setFilter]=useState("ALL");const [showForm,setShowForm]=useState(false);const [busy,setBusy]=useState(false);const [editingId,setEditingId]=useState<string|null>(null);
 const [form,setForm]=useState({type:"MOTORCYCLE",make:"",model:"",year:"",plateNumber:"",color:"",dailyRate:"",securityDeposit:"",branchId:""});
 const load=useCallback(async()=>{setError("");try{const [v,b]=await Promise.all([fetch(`/api/workspaces/${encodeURIComponent(slug)}/vehicles`,{cache:"no-store"}),fetch(`/api/workspaces/${encodeURIComponent(slug)}/branches`,{cache:"no-store"})]);const vd=await v.json(),bd=await b.json();if(!v.ok)throw new Error(vd.error||"Unable to load fleet.");setVehicles(vd.vehicles||[]);setBranches(bd.branches||[]);}catch(e){setError(e instanceof Error?e.message:"Unable to load fleet.");}finally{setLoading(false);}},[slug]);
 useEffect(()=>{load();},[load]);
 async function addVehicle(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch(`/api/workspaces/${encodeURIComponent(slug)}/vehicles`,{method:editingId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editingId?{...form,id:editingId}:form)});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to add vehicle.");setForm({type:"MOTORCYCLE",make:"",model:"",year:"",plateNumber:"",color:"",dailyRate:"",securityDeposit:"",branchId:""});setShowForm(false);setEditingId(null);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to add vehicle.");}finally{setBusy(false);}}
 function editVehicle(v:Vehicle){setEditingId(v.id);setForm({type:v.type,make:v.make,model:v.model,year:v.year?String(v.year):"",plateNumber:v.plateNumber,color:v.color||"",dailyRate:String(v.dailyRate),securityDeposit:String(v.securityDeposit),branchId:v.branchId||""});setShowForm(true);window.scrollTo({top:0,behavior:"smooth"});}\n async function changeStatus(id:string,status:string){setError("");try{const r=await fetch(`/api/workspaces/${encodeURIComponent(slug)}/vehicles`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to update status.");setVehicles(v=>v.map(x=>x.id===id?{...x,status}:x));}catch(e){setError(e instanceof Error?e.message:"Unable to update vehicle.");}}
 async function signOut(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/login");router.refresh();}
 const visible=vehicles.filter(v=>(filter==="ALL"||v.status===filter)&&`${v.make} ${v.model} ${v.plateNumber}`.toLowerCase().includes(search.toLowerCase()));
 const counts=Object.fromEntries(statuses.map(s=>[s,vehicles.filter(v=>v.status===s).length]));
 if(loading)return <main className="roam-loading">Loading fleet…</main>;
 return <div className="roam-app-shell"><WorkspaceNav slug={slug} name="Fleet management" role="Workspace team" active="fleet"/><main className="roam-main">
  <header className="roam-topbar"><div><Link href={`/workspace/${slug}`} className="roam-back-link"><ArrowLeft size={14}/> Overview</Link><span className="roam-eyebrow">ASSET MANAGEMENT</span><h1>Your fleet</h1><p>Keep vehicle details, rates and availability up to date.</p></div><div className="roam-topbar-actions"><button className="roam-secondary-btn" onClick={load}><RefreshCw size={15}/> Refresh</button><button className="roam-primary-btn" onClick={()=>{setEditingId(null);setForm({type:"MOTORCYCLE",make:"",model:"",year:"",plateNumber:"",color:"",dailyRate:"",securityDeposit:"",branchId:""});setShowForm(x=>!x);}}><Plus size={16}/> Add vehicle</button></div></header>
  <section className="roam-fleet-stats">{[["Total vehicles",vehicles.length],["Available",counts.AVAILABLE||0],["On rent",counts.RENTED||0],["In maintenance",counts.MAINTENANCE||0]].map(([label,value])=><article className="roam-fleet-stat" key={label}><span>{label}</span><b>{value}</b></article>)}</section>
  {error&&<p className="roam-error" role="alert">{error}</p>}
  {showForm&&<form className="roam-panel roam-vehicle-form" onSubmit={addVehicle}><div className="roam-panel-heading"><div><span className="roam-eyebrow">NEW ASSET</span><h2>{editingId?"Edit vehicle":"Add a vehicle"}</h2></div><button type="button" className="roam-quiet-btn" onClick={()=>setShowForm(false)}>Cancel</button></div>
   <div className="roam-form-grid">
    <label>Vehicle type<select required value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{types.map(t=><option key={t} value={t}>{t.replace("_"," ")}</option>)}</select></label>
    <label>Make<input required minLength={2} value={form.make} onChange={e=>setForm({...form,make:e.target.value})} placeholder="Honda"/></label>
    <label>Model<input required value={form.model} onChange={e=>setForm({...form,model:e.target.value})} placeholder="Click 160"/></label>
    <label>Plate number<input required value={form.plateNumber} onChange={e=>setForm({...form,plateNumber:e.target.value.toUpperCase()})} placeholder="ABC 1234"/></label>
    <label>Year<input type="number" min="1950" max={new Date().getFullYear()+1} value={form.year} onChange={e=>setForm({...form,year:e.target.value})} placeholder="2025"/></label>
    <label>Color<input value={form.color} onChange={e=>setForm({...form,color:e.target.value})} placeholder="Matte black"/></label>
    <label>Daily rate (₱)<input required type="number" min="0" step="0.01" value={form.dailyRate} onChange={e=>setForm({...form,dailyRate:e.target.value})} placeholder="1200"/></label>
    <label>Security deposit (₱)<input type="number" min="0" step="0.01" value={form.securityDeposit} onChange={e=>setForm({...form,securityDeposit:e.target.value})} placeholder="0"/></label>
    <label>Branch<select value={form.branchId} onChange={e=>setForm({...form,branchId:e.target.value})}><option value="">Unassigned</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   </div><button className="roam-primary-btn" disabled={busy}>{busy?"Saving…":editingId?"Save changes":"Save vehicle"}</button>
  </form>}
  <section className="roam-panel roam-table-panel"><div className="roam-panel-heading"><div><span className="roam-eyebrow">FLEET REGISTER</span><h2>Vehicles</h2></div><span className="roam-panel-total">{visible.length} vehicles</span></div>
   <div className="roam-table-tools"><label className="roam-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search make, model or plate"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></div>
   {visible.length?<div className="roam-table-scroll"><table className="roam-table"><thead><tr><th>Vehicle</th><th>Plate number</th><th>Branch</th><th>Daily rate</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(v=><tr key={v.id}><td><div className="roam-vehicle-cell"><span className="roam-vehicle-avatar"><CarFront size={18}/></span><span><b>{v.make} {v.model}</b><small>{v.year||"Year not set"} · {v.type.replace("_"," ")}</small></span></div></td><td>{v.plateNumber}</td><td>{v.branchName}</td><td>{money(v.dailyRate)}</td><td><select className={`roam-status-select ${v.status.toLowerCase()}`} value={v.status} onChange={e=>changeStatus(v.id,e.target.value)} aria-label={`Status for ${v.plateNumber}`}>{statuses.map(s=><option key={s}>{s}</option>)}</select></td><td><button className="roam-link-btn" onClick={()=>editVehicle(v)}>Edit details</button></td></tr>)}</tbody></table></div>:<div className="roam-empty"><CarFront size={28}/><b>No vehicles found</b><span>{vehicles.length?"Try another search or status filter.":"Add your first vehicle to start managing your fleet."}</span>{!vehicles.length&&<button className="roam-primary-btn" onClick={()=>setShowForm(true)}>Add first vehicle</button>}</div>}
  </section>
  <footer className="roam-footer">ROAM Fleet Management <span>Vehicle records are isolated to this workspace.</span></footer>
 </main></div>;
}
