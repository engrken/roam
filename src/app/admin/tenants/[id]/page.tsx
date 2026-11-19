"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, CarFront, ClipboardList, Clock3, RefreshCw, Save, ShieldCheck, Users, Wallet } from "lucide-react";

type TenantData = {
  id: string; name: string; slug: string; email: string; phone: string | null; status: string;
  currency: string; timezone: string; createdAt: string; updatedAt: string;
  counts: { memberships: number; vehicles: number; branches: number; bookings: number; customers: number; invitations: number };
  memberships: { id: string; userId: string; name: string | null; email: string; role: string; joinedAt: string; accountCreatedAt: string }[];
  branches: { id: string; name: string; code: string | null; address: string | null; isActive: boolean; _count: { vehicles: number; bookings: number } }[];
  subscription: null | { tier: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; trialEndsAt: string | null; plan: { name: string; monthlyPrice: number; maxVehicles: number | null; maxBranches: number | null; maxStaff: number | null; active: boolean } };
  invitations: { id: string; email: string; role: string; expiresAt: string; createdAt: string }[];
  recentBookings: { id: string; reference: string; status: string; startAt: string; endAt: string; totalAmount: number; createdAt: string; branch: { name: string } | null }[];
};
type Audit = { id: string; actorEmail: string; action: string; details: unknown; createdAt: string };
const statusColors: Record<string,string> = { ACTIVE:"bg-emerald-400/10 text-emerald-300", TRIAL:"bg-sky-400/10 text-sky-300", SUSPENDED:"bg-amber-400/10 text-amber-200", CANCELLED:"bg-rose-400/10 text-rose-200" };
const inputClass = "mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-cyan-300 focus:outline-none";
const date = (value: string | null) => value ? new Date(value).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"}) : "—";
const money = (value: number, currency: string) => { try { return new Intl.NumberFormat("en-PH",{style:"currency",currency}).format(value); } catch { return currency+" "+value.toLocaleString(); } };

export default function AdminTenantDetailPage() {
  const params = useParams<{id:string}>(), router = useRouter();
  const id = params.id;
  const [tenant,setTenant] = useState<TenantData|null>(null);
  const [audit,setAudit] = useState<Audit[]>([]);
  const [loading,setLoading] = useState(true), [saving,setSaving] = useState(false), [error,setError] = useState(""), [notice,setNotice] = useState("");
  const [form,setForm] = useState({name:"",email:"",phone:"",currency:"PHP",timezone:"Asia/Manila"});
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/tenants/"+encodeURIComponent(id),{cache:"no-store"});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load tenant.");
      const t = body.tenant as TenantData;
      setTenant(t); setAudit(body.auditLogs || []);
      setForm({name:t.name,email:t.email,phone:t.phone || "",currency:t.currency,timezone:t.timezone});
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load tenant."); }
    finally { setLoading(false); }
  },[id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch tenant detail on route entry.
  useEffect(()=>{void load();},[load]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response=await fetch("/api/admin/tenants/"+encodeURIComponent(id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const body=await response.json(); if(!response.ok) throw new Error(body.error || "Unable to save tenant.");
      setNotice("Tenant profile updated and recorded in audit history."); await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to save tenant."); }
    finally { setSaving(false); }
  }
  async function setStatus(status:string) {
    if(!tenant) return;
    const action=status==="ACTIVE"||status==="TRIAL"?"restore access to":"change access status for";
    if(!window.confirm("Are you sure you want to "+action+" "+tenant.name+"? This does not charge, refund or cancel a payment subscription.")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response=await fetch("/api/admin/tenants/"+encodeURIComponent(id),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
      const body=await response.json(); if(!response.ok) throw new Error(body.error || "Unable to change tenant status.");
      setNotice("Workspace access status updated."); await load();
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to update status."); }
    finally { setSaving(false); }
  }

  if(loading && !tenant) return <main className="min-h-screen bg-slate-950 p-6 text-slate-300"><div className="mx-auto max-w-7xl animate-pulse"><div className="h-8 w-48 rounded bg-slate-800"/><div className="mt-8 h-40 rounded-2xl bg-slate-900"/><div className="mt-4 h-64 rounded-2xl bg-slate-900"/></div></main>;
  if(error && !tenant) return <main className="min-h-screen bg-slate-950 px-5 py-16 text-slate-100"><section className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-8"><h1 className="text-2xl font-bold">Tenant details unavailable</h1><p className="mt-3 text-sm text-slate-400">{error}</p><button onClick={()=>void load()} className="mt-5 rounded-xl bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950">Retry</button><Link href="/admin" className="ml-4 text-sm">Back to tenants</Link></section></main>;
  if(!tenant) return null;

  const stats=[{label:"Vehicles",value:tenant.counts.vehicles,icon:CarFront},{label:"Branches",value:tenant.counts.branches,icon:Building2},{label:"Bookings",value:tenant.counts.bookings,icon:ClipboardList},{label:"Customers",value:tenant.counts.customers,icon:Users}];
  const owners=tenant.memberships.filter(m=>m.role==="OWNER");
  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-7 sm:py-8">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15}/> Tenant directory</Link><p className="mt-3 text-[11px] font-bold tracking-[.2em] text-cyan-400">ROAM PLATFORM MANAGEMENT</p></div>
        <nav className="flex flex-wrap gap-4 text-sm"><Link href="/admin/plans" className="text-slate-400 hover:text-white">Plans</Link><Link href="/admin/audit-logs" className="text-slate-400 hover:text-white">Audit history</Link><Link href="/workspace" className="text-slate-400 hover:text-white">My workspace</Link></nav>
      </header>

      <section className="py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-3xl font-bold sm:text-4xl">{tenant.name}</h1><span className={"rounded-full px-3 py-1 text-[11px] font-bold "+(statusColors[tenant.status]||"bg-white/10 text-slate-300")}>{tenant.status}</span></div><p className="mt-2 break-all text-sm text-slate-400">{tenant.slug} · {tenant.email}{tenant.phone?" · "+tenant.phone:""}</p><p className="mt-2 text-xs text-slate-500">Registered {date(tenant.createdAt)} · Last updated {date(tenant.updatedAt)}</p></div>
          <button onClick={()=>void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50"><RefreshCw size={15}/> Refresh</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats.map(item=><article key={item.label} className="rounded-2xl border border-white/10 bg-slate-900 p-4"><div className="flex items-center justify-between text-sm text-slate-400"><span>{item.label}</span><item.icon size={17} className="text-cyan-300"/></div><p className="mt-3 text-3xl font-bold tabular-nums">{item.value.toLocaleString()}</p></article>)}</div>
      </section>

      {(error||notice)&&<div role={error?"alert":"status"} className={"mb-5 rounded-xl border p-3 text-sm "+(error?"border-rose-400/20 bg-rose-950/40 text-rose-200":"border-emerald-400/20 bg-emerald-950/30 text-emerald-200")}>{error||notice}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
            <div className="mb-5"><p className="text-[10px] font-bold tracking-[.18em] text-cyan-300">TENANT RECORD</p><h2 className="mt-1 text-xl font-semibold">Business profile</h2><p className="mt-1 text-xs text-slate-500">Maintain contact and regional settings. Workspace slug is read-only to protect public booking links.</p></div>
            <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs text-slate-400 sm:col-span-2">Business name<input required minLength={2} maxLength={120} className={inputClass} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label>
              <label className="text-xs text-slate-400">Business contact email<input required type="email" maxLength={254} className={inputClass} value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))}/></label>
              <label className="text-xs text-slate-400">Business phone<input maxLength={30} className={inputClass} value={form.phone} onChange={e=>setForm(v=>({...v,phone:e.target.value}))}/></label>
              <label className="text-xs text-slate-400">Currency<input required pattern="[A-Z]{3}" maxLength={3} className={inputClass} value={form.currency} onChange={e=>setForm(v=>({...v,currency:e.target.value.toUpperCase()}))}/></label>
              <label className="text-xs text-slate-400">Timezone<input required maxLength={80} className={inputClass} value={form.timezone} onChange={e=>setForm(v=>({...v,timezone:e.target.value}))}/></label>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><p className="text-[11px] text-slate-500">Changes are logged with your administrator account.</p><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"><Save size={15}/>{saving?"Saving…":"Save profile"}</button></div>
            </form>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-cyan-300">PEOPLE</p><h2 className="mt-1 text-xl font-semibold">Workspace members</h2></div><span className="text-xs text-slate-500">{tenant.memberships.length} members</span></div>
            {owners.length>0&&<div className="mb-4 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3"><p className="text-[10px] font-bold tracking-wider text-cyan-200">WORKSPACE OWNER{owners.length>1?"S":""}</p>{owners.map(owner=><div key={owner.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium">{owner.name||owner.email}</span><span className="text-xs text-slate-400">{owner.email}</span></div>)}</div>}
            <div className="divide-y divide-white/5">{tenant.memberships.map(member=><div key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0"><p className="break-all text-sm font-medium">{member.name||member.email}</p><p className="break-all text-xs text-slate-500">{member.email} · Joined {new Date(member.joinedAt).toLocaleDateString("en-PH")}</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300">{member.role}</span></div>)}</div>
            {tenant.memberships.length===0&&<p className="text-sm text-slate-500">No workspace memberships recorded.</p>}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-cyan-300">OPERATIONS</p><h2 className="mt-1 text-xl font-semibold">Branches</h2></div><span className="text-xs text-slate-500">{tenant.branches.length} total</span></div>
            {tenant.branches.length?<div className="grid gap-3 sm:grid-cols-2">{tenant.branches.map(branch=><article key={branch.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{branch.name}</h3><span className={"text-[10px] font-bold "+(branch.isActive?"text-emerald-300":"text-slate-500")}>{branch.isActive?"ACTIVE":"INACTIVE"}</span></div><p className="mt-1 text-xs text-slate-500">{branch.code||"No branch code"}{branch.address?" · "+branch.address:""}</p><p className="mt-3 text-xs text-slate-300">{branch._count.vehicles} vehicles · {branch._count.bookings} bookings</p></article>)}</div>:<p className="text-sm text-slate-500">No branches created.</p>}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-cyan-300">ACTIVITY</p><h2 className="mt-1 text-xl font-semibold">Recent bookings</h2></div><span className="text-xs text-slate-500">Latest 8</span></div>
            {tenant.recentBookings.length?<div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="text-[10px] uppercase text-slate-500"><tr><th className="pb-3">Reference</th><th className="pb-3">Status</th><th className="pb-3">Branch</th><th className="pb-3">Rental dates</th><th className="pb-3 text-right">Value</th></tr></thead><tbody>{tenant.recentBookings.map(b=><tr key={b.id} className="border-t border-white/5"><td className="py-3 font-semibold">{b.reference}</td><td className="py-3">{b.status}</td><td className="py-3">{b.branch?.name||"—"}</td><td className="py-3">{new Date(b.startAt).toLocaleDateString("en-PH")} – {new Date(b.endAt).toLocaleDateString("en-PH")}</td><td className="py-3 text-right">{money(b.totalAmount,tenant.currency)}</td></tr>)}</tbody></table></div>:<p className="text-sm text-slate-500">No bookings have been recorded.</p>}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="text-[10px] font-bold tracking-[.18em] text-cyan-300">SUBSCRIPTION</p><h2 className="mt-1 text-xl font-semibold">{tenant.subscription?.plan.name||"No plan assigned"}</h2><p className="mt-1 text-sm text-slate-400">{tenant.subscription?.tier||"Unassigned"} · {tenant.subscription?.status||"No subscription"}</p>{tenant.subscription&&<><p className="mt-4 text-2xl font-bold">{money(tenant.subscription.plan.monthlyPrice,tenant.currency)}<span className="ml-1 text-xs font-normal text-slate-500">/ month (catalog price)</span></p><div className="mt-4 space-y-2 border-t border-white/5 pt-4 text-xs text-slate-400"><p>Vehicles: {tenant.subscription.plan.maxVehicles??"Unlimited"} max</p><p>Branches: {tenant.subscription.plan.maxBranches??"Unlimited"} max</p><p>Staff: {tenant.subscription.plan.maxStaff??"Unlimited"} max</p><p>Trial ends: {date(tenant.subscription.trialEndsAt)}</p><p>Period ends: {date(tenant.subscription.currentPeriodEnd)}</p><p>Plan availability: {tenant.subscription.plan.active?"Active":"Inactive"}</p></div></>}<Link href="/admin/plans" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/5"><Wallet size={15}/> Manage plan assignment</Link><p className="mt-3 text-[10px] leading-5 text-slate-500">Catalog price only. ROAM does not process subscription payments or automatic renewals.</p></section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="text-[10px] font-bold tracking-[.18em] text-cyan-300">WORKSPACE ACCESS</p><h2 className="mt-1 text-lg font-semibold">Account controls</h2><p className="mt-2 text-xs leading-5 text-slate-400">Suspension and closure block tenant access. They do not delete tenant records or alter payment state.</p><div className="mt-4 grid gap-2">{tenant.status!=="ACTIVE"&&<button disabled={saving} onClick={()=>void setStatus("ACTIVE")} className="rounded-xl bg-emerald-400/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 disabled:opacity-50">Activate workspace</button>}{tenant.status!=="TRIAL"&&<button disabled={saving} onClick={()=>void setStatus("TRIAL")} className="rounded-xl bg-sky-400/10 px-4 py-2.5 text-sm font-semibold text-sky-200 disabled:opacity-50">Set trial status</button>}{tenant.status!=="SUSPENDED"&&<button disabled={saving} onClick={()=>void setStatus("SUSPENDED")} className="rounded-xl bg-amber-400/10 px-4 py-2.5 text-sm font-semibold text-amber-200 disabled:opacity-50">Suspend access</button>}{tenant.status!=="CANCELLED"&&<button disabled={saving} onClick={()=>void setStatus("CANCELLED")} className="rounded-xl bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-200 disabled:opacity-50">Close workspace access</button>}</div></section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-cyan-300">INVITATIONS</p><h2 className="mt-1 text-lg font-semibold">Pending team access</h2></div><Users size={17} className="text-cyan-300"/></div>{tenant.invitations.length?<div className="mt-3 space-y-3">{tenant.invitations.map(inv=><div key={inv.id} className="border-t border-white/5 pt-3"><p className="break-all text-xs font-medium">{inv.email}</p><p className="mt-1 text-[10px] text-slate-500">{inv.role} · Expires {new Date(inv.expiresAt).toLocaleDateString("en-PH")}</p></div>)}</div>:<p className="mt-3 text-xs text-slate-500">No pending invitations.</p>}</section>

          <section className="rounded-2xl border border-white/10 bg-slate-900 p-5"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-cyan-300"/><h2 className="font-semibold">Platform audit trail</h2></div>{audit.length?<div className="mt-3 space-y-3">{audit.map(log=><div key={log.id} className="border-t border-white/5 pt-3"><p className="text-xs font-semibold">{log.action}</p><p className="mt-1 text-[10px] text-slate-500">{log.actorEmail} · {date(log.createdAt)}</p><pre className="mt-2 whitespace-pre-wrap break-words text-[10px] text-slate-500">{JSON.stringify(log.details,null,2)}</pre></div>)}</div>:<p className="mt-3 text-xs text-slate-500">No platform admin changes recorded for this tenant yet.</p>}<Link href="/admin/audit-logs" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cyan-300">View all platform activity <Clock3 size={13}/></Link></section>
        </aside>
      </div>
      <p className="mt-8 text-[11px] leading-5 text-slate-600">Tenant records are retained when access is suspended or closed. Do not use these controls to represent a payment, refund or account deletion.</p>
    </div>
  </main>;
}
