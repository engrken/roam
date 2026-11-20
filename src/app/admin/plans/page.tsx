"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, RefreshCw, Layers3 } from "lucide-react";

type Plan = { id: string; tier: string; name: string; monthlyPrice: number; maxVehicles: number | null; maxBranches: number | null; maxStaff: number | null; active: boolean };
type SubscriptionRequest = { id: string; tenantId: string; tenantName: string; tenantSlug: string; currentTier: string; requestedTier: string; status: string; createdAt: string };
type Tenant = { id: string; name: string; slug: string; subscription: { tier: string; status: string; currentPeriodEnd: string | null; trialEndsAt: string | null; monthlyPrice: number } | null };

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [subscriptionRequests, setSubscriptionRequests] = useState<SubscriptionRequest[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/plans", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load plans.");
      const loadedTenants = body.tenants || [];
      setPlans(body.plans || []); setTenants(loadedTenants); setSubscriptionRequests(body.subscriptionRequests || []);
      setPaymentAmounts(Object.fromEntries(loadedTenants.map((tenant: Tenant) => [tenant.id, String(tenant.subscription?.monthlyPrice || "")])));
      const firstActiveTier = (body.plans || []).find((plan: Plan) => plan.active)?.tier || "";
      setAssignments(Object.fromEntries((body.tenants || []).map((tenant: Tenant) => [
        tenant.id,
        tenant.subscription && (body.plans || []).some((plan: Plan) => plan.active && plan.tier === tenant.subscription?.tier)
          ? tenant.subscription.tier
          : firstActiveTier,
      ])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load plans.");
    } finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load fetches platform plans and tenant assignments on entry.
  useEffect(() => { void load(); }, []);

  function editPlan(id: string, field: keyof Plan, value: string | number | boolean) {
    setPlans(items => items.map(plan => plan.id === id ? ({ ...plan, [field]: value } as Plan) : plan));
  }

  async function savePlan(plan: Plan) {
    setBusy(plan.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-plan", ...plan }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save plan.");
      setPlans(items => items.map(item => item.id === plan.id ? body.plan : item));
      setNotice(plan.name + " plan saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save plan.");
    } finally { setBusy(""); }
  }

  async function assignPlan(tenant: Tenant) {
    const tier = assignments[tenant.id] || (plans.some(plan => plan.active && plan.tier === tenant.subscription?.tier) ? tenant.subscription?.tier : plans.find(plan => plan.active)?.tier) || "";
    if (!tier || !plans.some(plan => plan.active && plan.tier === tier)) {
      setError("Choose an active plan before assigning it.");
      return;
    }
    if (tenant.subscription?.tier === tier) {
      setNotice(tenant.name + " is already assigned to this plan.");
      return;
    }
    if (!window.confirm(`Assign the ${tier} plan to ${tenant.name}? This changes the workspace's plan limits immediately. Complimentary access is free; paid plans still require verified payment.`)) return;
    setBusy(tenant.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "assign-plan", tenantId: tenant.id, tier }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to assign plan.");
      setTenants(items => items.map(item => item.id === tenant.id ? { ...item, subscription: { tier: body.subscription.tier, status: body.subscription.status, currentPeriodEnd: body.subscription.currentPeriodEnd, trialEndsAt: item.subscription?.trialEndsAt || null, monthlyPrice: plans.find(plan => plan.tier === body.subscription.tier)?.monthlyPrice || 0 } } : item));
      setNotice("Plan assigned to " + tenant.name + ". Subscription activation remains subject to billing review and verified payment.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to assign plan.");
    } finally { setBusy(""); }
  }

  async function recordPayment(tenant: Tenant) {
    const amount = Number(paymentAmounts[tenant.id]);
    if (!tenant.subscription || !Number.isFinite(amount) || amount <= 0) {
      setError("Assign a plan and enter the verified amount received before confirming payment.");
      return;
    }
    const reference = paymentReferences[tenant.id]?.trim() || "";
    if (!window.confirm("Confirm that " + amount.toLocaleString("en-PH") + " has actually been received from " + tenant.name + "? Only confirm after verifying the payment outside ROAM.")) return;
    setBusy("payment-" + tenant.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/plans", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "record-subscription-payment", tenantId: tenant.id, amount, reference }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to confirm payment.");
      setNotice(body.message || "Payment recorded and subscription activated.");
      setPaymentReferences(current => ({ ...current, [tenant.id]: "" }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to confirm payment.");
    } finally { setBusy(""); }
  }

  async function reviewRequest(item: SubscriptionRequest, decision: "approve" | "reject") {
    const action = decision === "approve" ? "approve" : "reject";
    if (!window.confirm((decision === "approve" ? "Approve" : "Reject") + " the " + item.currentTier + " → " + item.requestedTier + " request for " + item.tenantName + "?")) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review-subscription-request", requestId: item.id, decision: action }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to review request.");
      setNotice(body.message); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to review request."); }
    finally { setBusy(""); }
  }

  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6"><div><div className="flex flex-wrap gap-4"><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft size={15}/> Platform console</Link><Link href="/admin/audit-logs" className="text-sm text-cyan-300">Audit history</Link><Link href="/admin/payments" className="text-sm text-cyan-300">Payment settings</Link></div><p className="mt-4 text-xs font-bold tracking-[.2em] text-cyan-400">PLATFORM CONFIGURATION</p><h1 className="mt-2 text-3xl font-bold">Plans & subscriptions</h1><p className="mt-2 text-sm text-slate-400">Configure paid plans, assign entitlements, and review tenant billing.</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"><RefreshCw size={15}/> Refresh</button></header>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-950/50 p-3 text-sm text-emerald-200">{notice}</p>}
    {loading ? <p className="py-12 text-slate-400">Loading platform plans…</p> : <>
      <section className="py-8"><div className="mb-4 flex items-center gap-2"><Layers3 size={18}/><h2 className="text-xl font-semibold">Available plans</h2></div>
        {plans.length ? <div className="grid gap-4 lg:grid-cols-2">{plans.map(plan => <article key={plan.id} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-cyan-300">{plan.tier}</p><input className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-lg font-semibold" value={plan.name} onChange={event => editPlan(plan.id,"name",event.target.value)}/></div><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={plan.active} onChange={event => editPlan(plan.id,"active",event.target.checked)}/> Active</label></div>
          <label className="mt-4 block text-sm text-slate-400">Monthly list price (PHP)<input type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white" value={plan.monthlyPrice} onChange={event => editPlan(plan.id,"monthlyPrice",event.target.value === "" ? 0 : Number(event.target.value))}/></label>
          <div className="mt-4 grid grid-cols-3 gap-2">{([["maxVehicles","Vehicles"],["maxBranches","Branches"],["maxStaff","Staff"]] as const).map(([field,label])=><label key={field} className="text-xs text-slate-400">{label}<input type="number" min="1" placeholder="Unlimited" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-sm text-white" value={plan[field] ?? ""} onChange={event => editPlan(plan.id,field,event.target.value === "" ? "" : Number(event.target.value))}/></label>)}</div>
          <button disabled={busy===plan.id} onClick={() => void savePlan(plan)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"><Save size={15}/>{busy===plan.id ? "Saving…" : "Save plan"}</button>
        </article>)}</div> : <p className="rounded-xl border border-white/10 p-5 text-sm text-slate-400">No plans have been initialized yet. Create a workspace to initialize the standard plans.</p>}
      </section>
      <section className="border-t border-white/10 py-8"><h2 className="mb-4 text-xl font-semibold">Tenant subscription requests</h2>
        {subscriptionRequests.length ? <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Tenant</th><th className="px-5 py-4">Current tier</th><th className="px-5 py-4">Requested tier</th><th className="px-5 py-4">Requested</th><th className="px-5 py-4">Review</th></tr></thead><tbody>{subscriptionRequests.map(item=><tr key={item.id} className="border-t border-white/5"><td className="px-5 py-4"><b>{item.tenantName}</b><p className="text-xs text-slate-500">{item.tenantSlug}</p></td><td className="px-5 py-4">{item.currentTier}</td><td className="px-5 py-4">{item.requestedTier}</td><td className="px-5 py-4">{new Date(item.createdAt).toLocaleDateString()}</td><td className="px-5 py-4"><div className="flex gap-2"><button disabled={busy===item.id} onClick={()=>void reviewRequest(item,"approve")} className="rounded-lg bg-emerald-400 px-3 py-2 font-semibold text-slate-950 disabled:opacity-50">Approve</button><button disabled={busy===item.id} onClick={()=>void reviewRequest(item,"reject")} className="rounded-lg border border-rose-400/40 px-3 py-2 text-rose-200 disabled:opacity-50">Reject</button></div></td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-white/10 bg-slate-900 p-5 text-sm text-slate-400">No pending tenant subscription requests.</p>}
      </section>
      <section className="border-t border-white/10 py-8"><h2 className="mb-4 text-xl font-semibold">Tenant plan assignment</h2>
        {tenants.length === 0 ? <p className="rounded-xl border border-white/10 bg-slate-900 p-5 text-sm text-slate-400">No tenant workspaces are available for plan assignment yet.</p> : <>
        <div className="grid gap-3 lg:hidden">{tenants.map(tenant=><article key={tenant.id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><b className="text-sm">{tenant.name}</b><p className="mt-1 text-xs text-slate-500">{tenant.slug}</p></div><span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-300">{tenant.subscription?.status || "Not configured"}</span></div>
          <p className="mt-3 text-xs text-slate-400">Current plan: <strong className="text-slate-200">{tenant.subscription?.tier || "None"}</strong></p>
          <div className="mt-3 flex flex-wrap gap-2"><select aria-label={"Plan for " + tenant.name} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={assignments[tenant.id] || tenant.subscription?.tier || plans.find(plan=>plan.active)?.tier || ""} onChange={event => setAssignments(current => ({...current,[tenant.id]:event.target.value}))}>{!plans.some(plan=>plan.active) && <option value="">No active plans</option>}{plans.filter(plan=>plan.active).map(plan=><option key={plan.id} value={plan.tier}>{plan.name}</option>)}</select><button disabled={busy===tenant.id || !plans.some(plan=>plan.active)} onClick={()=>void assignPlan(tenant)} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{busy===tenant.id ? "Assigning…" : "Assign"}</button></div>
          {tenant.subscription?.tier === "FREE" ? <p className="mt-4 border-t border-white/10 pt-3 text-xs text-amber-300">Retired Complimentary plan — assign a paid plan to continue.</p> : <div className="mt-4 grid gap-2 border-t border-white/10 pt-3">
            <p className="text-xs font-semibold text-slate-300">Record verified payment</p>
            <input aria-label={"Verified payment amount for " + tenant.name} type="number" min="0.01" step="0.01" placeholder="Amount received" value={paymentAmounts[tenant.id] || ""} onChange={event=>setPaymentAmounts(current=>({...current,[tenant.id]:event.target.value}))} className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"/>
            <input aria-label={"Payment reference for " + tenant.name} maxLength={100} placeholder="Payment reference (optional)" value={paymentReferences[tenant.id] || ""} onChange={event=>setPaymentReferences(current=>({...current,[tenant.id]:event.target.value}))} className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm"/>
            <button disabled={!tenant.subscription || busy==="payment-"+tenant.id} onClick={()=>void recordPayment(tenant)} className="rounded-lg border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-40">{busy==="payment-"+tenant.id ? "Recording…" : "Confirm payment received"}</button>
          </div>}
        </article>)}</div>
        <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-slate-900 lg:block"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Tenant</th><th className="px-5 py-4">Current plan</th><th className="px-5 py-4">Subscription status</th><th className="px-5 py-4">Assign plan</th></tr></thead><tbody>{tenants.map(tenant=><tr key={tenant.id} className="border-t border-white/5"><td className="px-5 py-4"><b>{tenant.name}</b><p className="text-xs text-slate-500">{tenant.slug}</p></td><td className="px-5 py-4">{tenant.subscription?.tier || "None"}</td><td className="px-5 py-4">{tenant.subscription?.status || "Not configured"}</td><td className="px-5 py-4"><div className="flex items-center gap-2"><select className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2" value={assignments[tenant.id] || tenant.subscription?.tier || plans.find(plan=>plan.active)?.tier || ""} onChange={event => setAssignments(current => ({...current,[tenant.id]:event.target.value}))}>{!plans.some(plan=>plan.active) && <option value="">No active plans</option>}{plans.filter(plan=>plan.active).map(plan=><option key={plan.id} value={plan.tier}>{plan.name}</option>)}</select><button disabled={busy===tenant.id || !plans.some(plan=>plan.active)} onClick={()=>void assignPlan(tenant)} className="rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-950 disabled:opacity-50">{busy===tenant.id ? "…" : "Assign"}</button></div>
          {tenant.subscription?.tier === "FREE" ? <p className="mt-3 text-xs text-amber-300">Retired Complimentary plan — assign a paid plan to continue.</p> : <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
            <input aria-label={"Verified payment amount for " + tenant.name} type="number" min="0.01" step="0.01" placeholder="Amount received" value={paymentAmounts[tenant.id] || ""} onChange={event=>setPaymentAmounts(current=>({...current,[tenant.id]:event.target.value}))} className="min-w-0 rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs"/>
            <input aria-label={"Payment reference for " + tenant.name} maxLength={100} placeholder="Payment reference" value={paymentReferences[tenant.id] || ""} onChange={event=>setPaymentReferences(current=>({...current,[tenant.id]:event.target.value}))} className="min-w-0 rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs"/>
            <button disabled={!tenant.subscription || busy==="payment-"+tenant.id} onClick={()=>void recordPayment(tenant)} className="rounded-lg border border-emerald-400/40 px-2 py-2 text-xs text-emerald-200 disabled:opacity-40">{busy==="payment-"+tenant.id ? "…" : "Confirm paid"}</button>
          </div>}</td></tr>)}</tbody></table></div></>}
      </section>
    </>}
    <p className="mt-4 text-xs leading-5 text-slate-500">Plan assignments remain subject to manual billing review. Use “Confirm payment received” only after independently verifying funds. This records the billing entry, activates the subscription, applies eligible referral credits, and qualifies an eligible first paid referral. ROAM does not yet collect payments automatically.</p>
  </div></main>;
}
