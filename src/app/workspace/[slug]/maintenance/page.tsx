"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench, Plus, RefreshCw, Receipt } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Vehicle = { id: string; make: string; model: string; plateNumber: string };
type Branch = { id: string; name: string };
type Maintenance = { id: string; vehicleId: string; vehicleLabel: string; title: string; description: string | null; status: string; startAt: string; endAt: string };
type Service = { id: string; serviceType: string; description: string | null; odometerKm: number | null; cost: number; performedAt: string; vehicle: Vehicle };
type Expense = { id: string; category: string; description: string; amount: number; incurredAt: string; branch: { name: string } | null; vehicle: Vehicle | null };
const money = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);
const localDate = (d: string) => new Date(d).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

export default function OperationsPage() {
 const { slug } = useParams<{slug:string}>();
 const [vehicles,setVehicles] = useState<Vehicle[]>([]);
 const [branches,setBranches] = useState<Branch[]>([]);
 const [maintenance,setMaintenance] = useState<Maintenance[]>([]);
 const [services,setServices] = useState<Service[]>([]);
 const [expenses,setExpenses] = useState<Expense[]>([]);
 const [error,setError] = useState("");
 const [notice,setNotice] = useState("");
 const [busy,setBusy] = useState(false);
 const [schedule,setSchedule] = useState({vehicleId:"",title:"",startAt:"",endAt:"",description:""});
 const [service,setService] = useState({vehicleId:"",serviceType:"Routine service",performedAt:new Date().toISOString().slice(0,10),odometerKm:"",cost:"",description:""});
 const [expense,setExpense] = useState({category:"FUEL",description:"",amount:"",incurredAt:new Date().toISOString().slice(0,10),branchId:"",vehicleId:"",reference:""});
 const load = useCallback(async()=>{
  setError("");
  try {
   const [v,m,s,e,b] = await Promise.all([
    fetch(`/api/workspaces/${encodeURIComponent(slug)}/vehicles`,{cache:"no-store"}),
    fetch(`/api/workspaces/${encodeURIComponent(slug)}/maintenance`,{cache:"no-store"}),
    fetch(`/api/workspaces/${encodeURIComponent(slug)}/service-records`,{cache:"no-store"}),
    fetch(`/api/workspaces/${encodeURIComponent(slug)}/expenses`,{cache:"no-store"}),
    fetch(`/api/workspaces/${encodeURIComponent(slug)}/branches`,{cache:"no-store"})
   ]);
   const [vd,md,sd,ed,bd] = await Promise.all([v.json(),m.json(),s.json(),e.json(),b.json()]);
   for (const [r,d] of [[v,vd],[m,md],[s,sd],[e,ed],[b,bd]] as const) if(!r.ok) throw new Error(d.error || "Unable to load operations data.");
   setVehicles(vd.vehicles || []); setMaintenance(md.maintenance || []); setServices(sd.records || []); setExpenses(ed.expenses || []); setBranches(bd.branches || []);
   if(!schedule.vehicleId && vd.vehicles?.[0]) setSchedule(x=>({...x,vehicleId:vd.vehicles[0].id}));
   if(!service.vehicleId && vd.vehicles?.[0]) setService(x=>({...x,vehicleId:vd.vehicles[0].id}));
  } catch(e) { setError(e instanceof Error?e.message:"Unable to load operations data."); }
 },[slug,schedule.vehicleId,service.vehicleId]);
 useEffect(()=>{void load();},[load]);
 async function submit(e:FormEvent, endpoint:string, body:object, reset:()=>void, label:string){
  e.preventDefault();setBusy(true);setError("");setNotice("");
  try{const r=await fetch(`/api/workspaces/${encodeURIComponent(slug)}/${endpoint}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save record.");reset();setNotice(label);await load();}
  catch(e){setError(e instanceof Error?e.message:"Unable to save record.");}finally{setBusy(false);}
 }
 async function setMaintenanceStatus(id:string,status:"COMPLETED"|"CANCELLED"){
  setError("");try{const r=await fetch(`/api/workspaces/${encodeURIComponent(slug)}/maintenance`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to update maintenance.");await load();}catch(e){setError(e instanceof Error?e.message:"Unable to update maintenance.");}
 }
 const activeMaintenance=maintenance.filter(m=>m.status!=="CANCELLED"&&m.status!=="COMPLETED");
 const expenseTotal=expenses.reduce((a,e)=>a+e.amount,0);
 return <div className="roam-app-shell">
  <WorkspaceNav slug={slug} name="Fleet operations" role="Workspace team" active="maintenance"/>
  <main className="roam-main">
   <header className="roam-topbar"><div><Link href={`/workspace/${slug}/fleet`} className="roam-back-link"><ArrowLeft size={14}/> Fleet</Link><span className="roam-eyebrow">OPERATIONS</span><h1>Maintenance & expenses</h1><p>Plan downtime, keep a vehicle service history, and record day-to-day operating costs.</p></div><button className="roam-secondary-btn" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></header>
   {error&&<p className="roam-error" role="alert">{error}</p>}{notice&&<p className="roam-success" role="status">{notice}</p>}
   <section className="ops-stats"><article><span>Scheduled maintenance</span><b>{activeMaintenance.length}</b></article><article><span>Service records</span><b>{services.length}</b></article><article><span>Recorded expenses</span><b>{money(expenseTotal)}</b><small>Recent 500 entries</small></article></section>
   <section className="ops-grid">
    <article className="roam-panel"><div className="roam-panel-heading"><div><span className="roam-eyebrow">DOWNTIME PLANNER</span><h2>Schedule maintenance</h2></div><Wrench size={20}/></div>
     <form className="ops-form" onSubmit={e=>submit(e,"maintenance",schedule,()=>setSchedule(x=>({...x,title:"",startAt:"",endAt:"",description:""})),"Maintenance period scheduled.")}>
      <label>Vehicle<select required value={schedule.vehicleId} onChange={e=>setSchedule({...schedule,vehicleId:e.target.value})}><option value="">Select vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.plateNumber}</option>)}</select></label>
      <label>Work / reason<input required maxLength={120} value={schedule.title} onChange={e=>setSchedule({...schedule,title:e.target.value})} placeholder="Oil change, tire replacement…"/></label>
      <label>Start<input required type="datetime-local" value={schedule.startAt} onChange={e=>setSchedule({...schedule,startAt:e.target.value})}/></label>
      <label>End<input required type="datetime-local" value={schedule.endAt} onChange={e=>setSchedule({...schedule,endAt:e.target.value})}/></label>
      <label>Notes<textarea rows={2} maxLength={2000} value={schedule.description} onChange={e=>setSchedule({...schedule,description:e.target.value})}/></label>
      <button className="roam-primary-btn" disabled={busy||!vehicles.length}><Plus size={15}/> Schedule downtime</button>
     </form>
    </article>
    <article className="roam-panel"><div className="roam-panel-heading"><div><span className="roam-eyebrow">VEHICLE HISTORY</span><h2>Log a service</h2></div></div>
     <form className="ops-form" onSubmit={e=>submit(e,"service-records",service,()=>setService(x=>({...x,serviceType:"Routine service",odometerKm:"",cost:"",description:""})),"Service record saved.")}>
      <label>Vehicle<select required value={service.vehicleId} onChange={e=>setService({...service,vehicleId:e.target.value})}><option value="">Select vehicle</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.plateNumber}</option>)}</select></label>
      <label>Service type<input required maxLength={80} value={service.serviceType} onChange={e=>setService({...service,serviceType:e.target.value})}/></label>
      <label>Service date<input required type="date" value={service.performedAt} onChange={e=>setService({...service,performedAt:e.target.value})}/></label>
      <label>Odometer (km)<input type="number" min="0" step="1" value={service.odometerKm} onChange={e=>setService({...service,odometerKm:e.target.value})} placeholder="Optional"/></label>
      <label>Service cost (₱)<input type="number" min="0" step="0.01" value={service.cost} onChange={e=>setService({...service,cost:e.target.value})} placeholder="0.00"/></label>
      <label>Notes<textarea rows={2} maxLength={2000} value={service.description} onChange={e=>setService({...service,description:e.target.value})}/></label>
      <button className="roam-primary-btn" disabled={busy||!vehicles.length}><Plus size={15}/> Save service record</button>
     </form>
    </article>
    <article className="roam-panel"><div className="roam-panel-heading"><div><span className="roam-eyebrow">OPERATING COSTS</span><h2>Record an expense</h2></div><Receipt size={20}/></div>
     <form className="ops-form" onSubmit={e=>submit(e,"expenses",expense,()=>setExpense(x=>({...x,description:"",amount:"",reference:""})),"Expense recorded.")}>
      <label>Category<select value={expense.category} onChange={e=>setExpense({...expense,category:e.target.value})}>{["FUEL","MAINTENANCE","INSURANCE","REGISTRATION","SALARIES","UTILITIES","RENT","SUPPLIES","MARKETING","OTHER"].map(c=><option key={c}>{c}</option>)}</select></label>
      <label>Description<input required maxLength={240} value={expense.description} onChange={e=>setExpense({...expense,description:e.target.value})} placeholder="Fuel refill, monthly insurance…"/></label>
      <label>Amount (₱)<input required type="number" min="0.01" step="0.01" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})}/></label>
      <label>Date<input required type="date" value={expense.incurredAt} onChange={e=>setExpense({...expense,incurredAt:e.target.value})}/></label>
      <label>Branch<select value={expense.branchId} onChange={e=>setExpense({...expense,branchId:e.target.value})}><option value="">No branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label>Vehicle (optional)<select value={expense.vehicleId} onChange={e=>setExpense({...expense,vehicleId:e.target.value})}><option value="">General expense</option>{vehicles.map(v=><option key={v.id} value={v.id}>{v.make} {v.model} · {v.plateNumber}</option>)}</select></label>
      <label>Reference (optional)<input maxLength={120} value={expense.reference} onChange={e=>setExpense({...expense,reference:e.target.value})}/></label>
      <button className="roam-primary-btn" disabled={busy}><Plus size={15}/> Save expense</button>
     </form>
    </article>
   </section>
   <section className="roam-panel ops-list"><div className="roam-panel-heading"><div><span className="roam-eyebrow">UPCOMING / RECENT</span><h2>Maintenance schedule</h2></div></div>
    {!maintenance.length?<p className="ops-muted">No maintenance periods have been scheduled.</p>:maintenance.map(m=><div className="ops-row" key={m.id}><div><b>{m.title}</b><span>{m.vehicleLabel}</span><small>{localDate(m.startAt)} – {localDate(m.endAt)}</small></div><div className="ops-actions"><span className={"ops-status "+m.status.toLowerCase()}>{m.status}</span>{m.status==="SCHEDULED"&&<><button onClick={()=>void setMaintenanceStatus(m.id,"COMPLETED")}>Complete</button><button onClick={()=>void setMaintenanceStatus(m.id,"CANCELLED")}>Cancel</button></>}</div></div>)}
   </section>
   <section className="roam-panel ops-list"><div className="roam-panel-heading"><div><span className="roam-eyebrow">SERVICE HISTORY</span><h2>Recent vehicle service</h2></div></div>
    {!services.length?<p className="ops-muted">No service records yet.</p>:services.slice(0,30).map(s=><div className="ops-row" key={s.id}><div><b>{s.serviceType} · {s.vehicle.make} {s.vehicle.model}</b><span>{s.vehicle.plateNumber} · {new Date(s.performedAt).toLocaleDateString("en-PH")}</span><small>{s.odometerKm===null?"Odometer not recorded":s.odometerKm.toLocaleString()+" km"}{s.description?" · "+s.description:""}</small></div><strong>{money(s.cost)}</strong></div>)}
   </section>
   <section className="roam-panel ops-list"><div className="roam-panel-heading"><div><span className="roam-eyebrow">EXPENSE REGISTER</span><h2>Recent operating expenses</h2></div></div>
    {!expenses.length?<p className="ops-muted">No operating expenses recorded.</p>:expenses.slice(0,40).map(e=><div className="ops-row" key={e.id}><div><b>{e.description}</b><span>{e.category} · {new Date(e.incurredAt).toLocaleDateString("en-PH")}</span><small>{e.branch?.name||"No branch"}{e.vehicle?" · "+e.vehicle.plateNumber:""}</small></div><strong>{money(e.amount)}</strong></div>)}
   </section>
  </main>
  <style jsx>{`
   .ops-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.ops-stats article{padding:17px;border:1px solid var(--roam-border,#e5e7eb);border-radius:13px;background:var(--roam-card,#fff);display:grid;gap:6px}.ops-stats span,.ops-stats small,.ops-muted{font-size:12px;color:var(--roam-muted,#6b7280)}.ops-stats b{font-size:23px}
   .ops-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.ops-form{display:grid;gap:11px}.ops-form label{display:grid;gap:5px;font-size:12px;font-weight:650}.ops-form input,.ops-form select,.ops-form textarea{width:100%;min-width:0;border:1px solid var(--roam-border,#d1d5db);border-radius:9px;padding:10px;background:var(--roam-card,#fff);color:inherit;font:inherit;font-size:13px}
   .ops-list{margin-top:16px}.ops-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid var(--roam-border,#e5e7eb)}.ops-row>div:first-child{display:grid;gap:4px;min-width:0}.ops-row b{font-size:13px}.ops-row span,.ops-row small{font-size:11px;color:var(--roam-muted,#6b7280)}.ops-row small{overflow-wrap:anywhere}.ops-row>strong{white-space:nowrap;font-size:13px}.ops-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.ops-actions button{border:1px solid var(--roam-border,#ddd);border-radius:7px;padding:6px 8px;background:transparent;color:inherit;font-size:11px}.ops-status{padding:4px 7px;border-radius:99px;background:#eef2ff;color:#3730a3;font-size:10px!important}.ops-status.completed{background:#dcfce7;color:#166534}.ops-status.cancelled{background:#f3f4f6;color:#6b7280}
   @media(max-width:900px){.ops-grid{grid-template-columns:1fr}.ops-stats{grid-template-columns:1fr}}@media(max-width:520px){.ops-row{align-items:flex-start;flex-direction:column}.ops-actions{width:100%}}
  `}</style>
 </div>;
}
