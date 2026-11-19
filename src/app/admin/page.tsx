"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tenant = { id: string; name: string; slug: string; email: string; phone: string | null; status: string; createdAt: string; counts: { memberships: number; vehicles: number; branches: number; bookings: number }; subscription: { tier: string; status: string; plan: string } | null };

export default function AdminPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/tenants", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 403) { setDenied(true); return; }
      if (!response.ok) throw new Error(data.error || "Unable to load tenants.");
      setTenants(data.tenants || []); setDenied(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load tenants."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tenants", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (response.status === 403) { setDenied(true); return; }
        if (!response.ok) throw new Error(data.error || "Unable to load tenants.");
        setTenants(data.tenants || []);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load tenants."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  async function changeStatus(tenantId: string, status: string) {
    setBusy(tenantId); setError("");
    try {
      const response = await fetch("/api/admin/tenants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, status }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update tenant.");
      setTenants((items) => items.map((tenant) => tenant.id === tenantId ? { ...tenant, status: data.tenant.status } : tenant));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update tenant."); }
    finally { setBusy(""); }
  }
  async function signOut() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
  if (loading) return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading platform console…</main>;
  if (denied) return <main className="min-h-screen bg-slate-950 px-5 py-16 text-slate-100"><section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-8"><p className="text-xs font-bold tracking-[.2em] text-amber-300">RESTRICTED AREA</p><h1 className="mt-3 text-3xl font-bold">Admin access required</h1><p className="mt-3 text-sm leading-6 text-slate-400">This console is reserved for platform administrators. Sign in with an authorized admin email or contact the ROAM platform owner.</p><div className="mt-6 flex gap-4"><Link href="/login" className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950">Sign in</Link><Link href="/" className="px-4 py-3 text-slate-300">Home</Link></div></section></main>;
  const totals = tenants.reduce((sum, tenant) => ({ vehicles: sum.vehicles + tenant.counts.vehicles, bookings: sum.bookings + tenant.counts.bookings, users: sum.users + tenant.counts.memberships }), { vehicles: 0, bookings: 0, users: 0 });
  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100"><div className="mx-auto max-w-7xl"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6"><div><Link href="/" className="text-2xl font-black tracking-[.2em]">ROAM</Link><p className="mt-1 text-xs font-bold tracking-[.18em] text-cyan-400">PLATFORM ADMINISTRATION</p></div><div className="flex items-center gap-4 text-sm"><Link href="/admin/plans" className="text-cyan-300 hover:text-white">Plans & billing</Link><Link href="/workspace" className="text-slate-400 hover:text-white">My workspace</Link><button onClick={signOut} className="text-cyan-300 hover:text-white">Sign out</button></div></header>
  <section className="py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold">Tenant management</h1><p className="mt-2 text-sm text-slate-400">Review registered rental businesses and manage their platform status.</p></div><button onClick={() => void load()} className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/5">Refresh list</button></div>
  <div className="mt-7 grid gap-3 sm:grid-cols-4">{[{label:"Tenants",value:tenants.length},{label:"Vehicles",value:totals.vehicles},{label:"Bookings",value:totals.bookings},{label:"Workspace users",value:totals.users}].map((item)=><div key={item.label} className="rounded-2xl border border-white/10 bg-slate-900 p-5"><p className="text-sm text-slate-400">{item.label}</p><p className="mt-2 text-3xl font-bold">{item.value}</p></div>)}</div></section>
  {error && <p role="alert" className="mb-5 rounded-xl bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
  <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900"><div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold">Registered tenants</h2></div>{tenants.length === 0 ? <p className="p-8 text-sm text-slate-400">No tenant workspaces have been registered yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Business</th><th className="px-5 py-4">Plan</th><th className="px-5 py-4">Usage</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Registered</th><th className="px-5 py-4">Manage</th></tr></thead><tbody>{tenants.map((tenant)=><tr key={tenant.id} className="border-t border-white/5 align-top"><td className="px-5 py-4"><p className="font-semibold">{tenant.name}</p><p className="mt-1 text-xs text-slate-400">{tenant.email}</p><p className="mt-1 text-xs text-slate-500">{tenant.slug}</p></td><td className="px-5 py-4">{tenant.subscription?.plan || "No plan"}<p className="mt-1 text-xs text-slate-500">{tenant.subscription?.tier || "—"}</p></td><td className="px-5 py-4 text-slate-300">{tenant.counts.vehicles} vehicles · {tenant.counts.branches} branches<p className="mt-1 text-xs text-slate-500">{tenant.counts.memberships} users · {tenant.counts.bookings} bookings</p></td><td className="px-5 py-4"><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{tenant.status}</span></td><td className="px-5 py-4 text-slate-400">{new Date(tenant.createdAt).toLocaleDateString()}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-2">{tenant.status !== "ACTIVE" && <button disabled={busy===tenant.id} onClick={()=>void changeStatus(tenant.id,"ACTIVE")} className="rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-50">Activate</button>}{tenant.status !== "SUSPENDED" && <button disabled={busy===tenant.id} onClick={()=>void changeStatus(tenant.id,"SUSPENDED")} className="rounded-lg bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50">Suspend</button>}{tenant.status !== "CANCELLED" && <button disabled={busy===tenant.id} onClick={()=>void changeStatus(tenant.id,"CANCELLED")} className="rounded-lg bg-red-400/15 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-50">Cancel</button>}</div></td></tr>)}</tbody></table></div>}</section>
  <p className="mt-5 text-xs text-slate-500">Tenant status changes are applied immediately. Confirm workspace access enforcement before using suspension as an access-control measure in production.</p></div></main>;
}
