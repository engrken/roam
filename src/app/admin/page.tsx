"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Building2, CarFront, ClipboardList, Download, RefreshCw, ShieldCheck, Users, Wallet } from "lucide-react";

type Tenant = {
  id: string; name: string; slug: string; email: string; phone: string | null;
  status: string; createdAt: string;
  counts: { memberships: number; vehicles: number; branches: number; bookings: number };
  subscription: { tier: string; status: string; plan: string; currentPeriodEnd?: string | null } | null;
};
type StatusFilter = "ALL" | "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";

const statusStyle: Record<string, string> = {
  ACTIVE: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
  TRIAL: "bg-sky-400/10 text-sky-300 ring-sky-400/20",
  SUSPENDED: "bg-amber-400/10 text-amber-200 ring-amber-400/20",
  CANCELLED: "bg-rose-400/10 text-rose-200 ring-rose-400/20",
};

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const text = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + text.replace(/"/g, '""') + '"';
}

export default function AdminPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/tenants", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 403) { setDenied(true); return; }
      if (!response.ok) throw new Error(data.error || "Unable to load tenants.");
      setTenants(data.tenants || []); setDenied(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load tenants.");
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- retrieve the latest tenant directory on entry.
  useEffect(() => { void load(); }, [load]);

  const filteredTenants = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tenants.filter(tenant => {
      const matchesStatus = statusFilter === "ALL" || tenant.status === statusFilter;
      const matchesQuery = !needle || [tenant.name, tenant.slug, tenant.email, tenant.phone || ""].some(value => value.toLowerCase().includes(needle));
      return matchesStatus && matchesQuery;
    });
  }, [tenants, query, statusFilter]);

  const totals = useMemo(() => tenants.reduce((sum, tenant) => ({
    vehicles: sum.vehicles + tenant.counts.vehicles,
    bookings: sum.bookings + tenant.counts.bookings,
    users: sum.users + tenant.counts.memberships,
    branches: sum.branches + tenant.counts.branches,
  }), { vehicles: 0, bookings: 0, users: 0, branches: 0 }), [tenants]);

  async function changeStatus(tenant: Tenant, status: string) {
    const action = status === "CANCELLED" ? "cancel" : status === "SUSPENDED" ? "suspend" : "activate";
    const detail = status === "ACTIVE" || status === "TRIAL"
      ? `Reactivate ${tenant.name}?`
      : `${status === "CANCELLED" ? "Cancel" : "Suspend"} ${tenant.name}? Their workspace access will be blocked.`;
    if (!window.confirm(detail)) return;
    setBusy(tenant.id); setError("");
    try {
      const response = await fetch("/api/admin/tenants", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to ${action} tenant.`);
      setTenants(items => items.map(item => item.id === tenant.id ? { ...item, status: data.tenant.status } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update tenant.");
    } finally { setBusy(""); }
  }

  function exportTenants() {
    const rows = [
      ["Business", "Workspace", "Owner email", "Phone", "Status", "Plan", "Subscription", "Vehicles", "Branches", "Users", "Bookings", "Registered"],
      ...filteredTenants.map(tenant => [
        tenant.name, tenant.slug, tenant.email, tenant.phone || "", tenant.status,
        tenant.subscription?.plan || "", tenant.subscription?.status || "",
        tenant.counts.vehicles, tenant.counts.branches, tenant.counts.memberships,
        tenant.counts.bookings, new Date(tenant.createdAt).toISOString(),
      ]),
    ];
    const blob = new Blob([rows.map(row => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "roam-tenants.csv"; anchor.click();
    URL.revokeObjectURL(url);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login"); router.refresh();
  }

  if (loading) return <main className="min-h-screen bg-slate-950 p-6 text-slate-300"><div className="mx-auto max-w-7xl"><div className="h-8 w-48 animate-pulse rounded bg-slate-800"/><div className="mt-8 h-10 w-72 animate-pulse rounded bg-slate-800"/><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(item=><div key={item} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-slate-900"/>)}</div><p className="mt-6 text-sm">Loading platform console…</p></div></main>;
  if (error && tenants.length === 0) return <main className="min-h-screen bg-slate-950 px-5 py-16 text-slate-100"><section className="mx-auto max-w-xl rounded-2xl border border-red-400/20 bg-slate-900 p-8"><p className="text-xs font-bold tracking-[.2em] text-red-300">PLATFORM DATA UNAVAILABLE</p><h1 className="mt-3 text-2xl font-bold">Unable to load the tenant directory</h1><p className="mt-3 text-sm leading-6 text-slate-400">{error}</p><button onClick={() => void load()} disabled={loading} className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{loading ? "Retrying…" : "Retry loading data"}</button><Link href="/" className="ml-4 text-sm text-slate-300">Home</Link></section></main>;
  if (denied) return <main className="min-h-screen bg-slate-950 px-5 py-16 text-slate-100"><section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-8"><p className="text-xs font-bold tracking-[.2em] text-amber-300">RESTRICTED AREA</p><h1 className="mt-3 text-3xl font-bold">Admin access required</h1><p className="mt-3 text-sm leading-6 text-slate-400">This console is reserved for platform administrators. Your current ROAM sign-in must match an entry in the server-side ROAM_ADMIN_EMAILS setting. If that setting is already configured, verify that it contains the email on this ROAM account and that the latest value is active in the deployment. This check is performed securely on the server.</p><div className="mt-6 flex gap-4"><Link href="/login" className="rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950">Sign in</Link><Link href="/" className="px-4 py-3 text-slate-300">Home</Link></div></section></main>;

  const stats = [
    { label: "Tenants", value: tenants.length, icon: Building2, note: `${tenants.filter(t => t.status === "ACTIVE").length} active` },
    { label: "Vehicles", value: totals.vehicles, icon: CarFront, note: "Across all workspaces" },
    { label: "Bookings", value: totals.bookings, icon: ClipboardList, note: "All-time records" },
    { label: "Workspace users", value: totals.users, icon: Users, note: `${totals.branches} branches` },
  ];

  return <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-7">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-6">
        <div><Link href="/" className="text-2xl font-black tracking-[.2em]">ROAM</Link><p className="mt-1 text-[11px] font-bold tracking-[.2em] text-cyan-400">PLATFORM CONTROL CENTER</p></div>
        <nav aria-label="Platform navigation" className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <Link href="/admin" aria-current="page" className="text-white">Overview</Link>
          <Link href="/admin/plans" className="text-slate-400 hover:text-white">Plans & billing</Link>
          <Link href="/admin/audit-logs" className="text-slate-400 hover:text-white">Audit history</Link>
          <Link href="/workspace" className="text-slate-400 hover:text-white">My workspace</Link>
          <button onClick={signOut} className="text-cyan-300 hover:text-white">Sign out</button>
        </nav>
      </header>

      <section className="py-9">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold tracking-[.18em] text-cyan-300">ADMINISTRATION</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Platform overview</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Monitor rental businesses using ROAM, manage workspace access and review platform activity.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5"><RefreshCw size={15}/> Refresh data</button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(item => <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-400">{item.label}</span><item.icon size={18} className="text-cyan-300"/></div>
            <p className="mt-3 text-3xl font-bold tabular-nums">{item.value.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{item.note}</p>
          </article>)}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {(["TRIAL", "ACTIVE", "SUSPENDED", "CANCELLED"] as const).map(status => <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "ALL" : status)} aria-pressed={statusFilter === status} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-xs transition ${statusFilter === status ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-slate-900 hover:bg-white/5"}`}><span className="text-slate-300">{status}</span><b className="text-sm tabular-nums">{tenants.filter(t => t.status === status).length}</b></button>)}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div><h2 className="font-semibold">Tenant directory</h2><p className="mt-1 text-xs text-slate-500">Search, review and manage every registered workspace.</p></div>
          <button onClick={exportTenants} disabled={!filteredTenants.length} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"><Download size={14}/> Export CSV</button>
        </div>
        <div className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-[minmax(220px,1fr)_190px]">
          <label className="text-xs text-slate-400">Search tenants<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Business, workspace slug, email or phone" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-cyan-300 focus:outline-none"/></label>
          <label className="text-xs text-slate-400">Filter by status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="ALL">All statuses</option><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="CANCELLED">Cancelled</option></select></label>
        </div>
        {error && <div role="alert" className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-950/60 p-3 text-sm text-red-200"><span>{error}</span><button onClick={() => void load()} disabled={loading} className="rounded-lg border border-red-200/20 px-3 py-2 text-xs font-semibold hover:bg-red-200/10 disabled:opacity-50">{loading ? "Retrying…" : "Retry"}</button></div>}
        {filteredTenants.length === 0 ? <div className="p-10 text-center"><Building2 className="mx-auto mb-3 text-slate-600" size={28}/><p className="font-medium text-slate-300">{tenants.length ? "No tenants match your filters." : "No tenant workspaces registered yet."}</p><p className="mt-1 text-xs text-slate-500">{tenants.length ? "Try another search or status filter." : "New rental businesses will appear here after registration."}</p></div> : <>
          <div className="grid gap-3 p-4 lg:hidden">
            {filteredTenants.map(tenant => <article key={tenant.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="break-words font-semibold text-white">{tenant.name}</h3><p className="mt-1 break-all text-xs text-slate-400">{tenant.email}</p><p className="mt-1 break-all text-[11px] text-slate-500">{tenant.slug}{tenant.phone ? " · " + tenant.phone : ""}</p></div>
                <span className={"inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset " + (statusStyle[tenant.status] || "bg-white/10 text-slate-300 ring-white/10")}>{tenant.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-white/5 py-3 text-xs">
                <div><p className="text-slate-500">Plan</p><p className="mt-1 font-semibold text-slate-200">{tenant.subscription?.plan || "No plan"}</p><p className="mt-1 text-slate-500">{tenant.subscription?.status || "No subscription"}</p>{tenant.subscription?.currentPeriodEnd && <p className="mt-1 text-[11px] text-slate-500">Period ends {new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString("en-PH")}</p>}</div>
                <div><p className="text-slate-500">Registered</p><p className="mt-1 text-slate-200">{new Date(tenant.createdAt).toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"})}</p></div>
                <div className="col-span-2 flex flex-wrap gap-x-3 gap-y-1 text-slate-300"><span>{tenant.counts.vehicles} vehicles</span><span>{tenant.counts.branches} branches</span><span>{tenant.counts.memberships} users</span><span>{tenant.counts.bookings} bookings</span></div>
              </div>
              <div className="mt-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Workspace access</p><div className="flex flex-wrap gap-2">
                {tenant.status !== "ACTIVE" && <button disabled={busy===tenant.id} onClick={() => void changeStatus(tenant,"ACTIVE")} className="rounded-lg bg-emerald-400/15 px-3 py-2 text-[11px] font-semibold text-emerald-300 disabled:opacity-50">Activate</button>}
                {tenant.status !== "SUSPENDED" && <button disabled={busy===tenant.id} onClick={() => void changeStatus(tenant,"SUSPENDED")} className="rounded-lg bg-amber-400/15 px-3 py-2 text-[11px] font-semibold text-amber-200 disabled:opacity-50">Suspend</button>}
                {tenant.status !== "CANCELLED" && <button disabled={busy===tenant.id} onClick={() => void changeStatus(tenant,"CANCELLED")} className="rounded-lg bg-rose-400/15 px-3 py-2 text-[11px] font-semibold text-rose-200 disabled:opacity-50">Cancel</button>}
                {busy===tenant.id && <span className="self-center text-[10px] text-slate-500">Saving…</span>}
              </div></div>
            </article>)}
          </div>
          <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Business / owner</th><th className="px-5 py-4">Plan</th><th className="px-5 py-4">Workspace usage</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Registered</th><th className="px-5 py-4">Access controls</th></tr></thead>
            <tbody>{filteredTenants.map(tenant => <tr key={tenant.id} className="border-t border-white/5 align-top hover:bg-white/[.025]">
              <td className="px-5 py-4"><p className="font-semibold text-white">{tenant.name}</p><p className="mt-1 text-xs text-slate-400">{tenant.email}</p><p className="mt-1 text-[11px] text-slate-500">{tenant.slug}{tenant.phone ? ` · ${tenant.phone}` : ""}</p></td>
              <td className="px-5 py-4"><p className="font-medium">{tenant.subscription?.plan || "No plan"}</p><p className="mt-1 text-xs text-slate-500">{tenant.subscription?.tier || "—"}</p><p className="mt-1 text-[10px] text-slate-500">{tenant.subscription?.status || "No subscription"}</p>{tenant.subscription?.currentPeriodEnd && <p className="mt-1 text-[10px] text-slate-500">Ends {new Date(tenant.subscription.currentPeriodEnd).toLocaleDateString("en-PH")}</p>}</td>
              <td className="px-5 py-4 text-xs text-slate-300"><p>{tenant.counts.vehicles} vehicles · {tenant.counts.branches} branches</p><p className="mt-1 text-slate-500">{tenant.counts.memberships} users · {tenant.counts.bookings} bookings</p></td>
              <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${statusStyle[tenant.status] || "bg-white/10 text-slate-300 ring-white/10"}`}>{tenant.status}</span></td>
              <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400">{new Date(tenant.createdAt).toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"})}</td>
              <td className="px-5 py-4"><div className="flex flex-wrap gap-2">
                {tenant.status !== "ACTIVE" && <button disabled={busy===tenant.id} onClick={() => void changeStatus(tenant,"ACTIVE")} className="rounded-lg bg-emerald-400/15 px-3 py-2 text-[11px] font-semibold text-emerald-300 disabled:opacity-50">Activate</button>}
                {tenant.status !== "SUSPENDED" && <button disabled={busy===tenant.id} onClick={() => void changeStatus(tenant,"SUSPENDED")} className="rounded-lg bg-amber-400/15 px-3 py-2 text-[11px] font-semibold text-amber-200 disabled:opacity-50">Suspend</button>}
                {tenant.status !== "CANCELLED" && <button disabled={busy===tenant.id} onClick={() => void changeStatus(tenant,"CANCELLED")} className="rounded-lg bg-rose-400/15 px-3 py-2 text-[11px] font-semibold text-rose-200 disabled:opacity-50">Cancel</button>}
                {busy===tenant.id && <span className="self-center text-[10px] text-slate-500">Saving…</span>}
              </div></td>
            </tr>)}</tbody>
          </table></div></>}
        <div className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">Showing {filteredTenants.length} of {tenants.length} tenants. Status changes take effect immediately and are recorded in audit history.</div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <Link href="/admin/plans" className="group rounded-2xl border border-white/10 bg-slate-900 p-5 hover:border-cyan-300/40"><Wallet className="mb-4 text-cyan-300" size={21}/><h3 className="font-semibold">Plans & subscriptions</h3><p className="mt-1 text-xs leading-5 text-slate-400">Configure plan allowances and manage tenant plan assignments.</p><span className="mt-4 inline-block text-xs font-semibold text-cyan-300">Manage plans →</span></Link>
        <Link href="/admin/audit-logs" className="group rounded-2xl border border-white/10 bg-slate-900 p-5 hover:border-cyan-300/40"><ShieldCheck className="mb-4 text-cyan-300" size={21}/><h3 className="font-semibold">Audit history</h3><p className="mt-1 text-xs leading-5 text-slate-400">Review platform administrator actions and tenant changes.</p><span className="mt-4 inline-block text-xs font-semibold text-cyan-300">View audit trail →</span></Link>
        <div className="rounded-2xl border border-white/10 bg-slate-900 p-5"><Activity className="mb-4 text-cyan-300" size={21}/><h3 className="font-semibold">Platform operations</h3><p className="mt-1 text-xs leading-5 text-slate-400">Tenant access is controlled independently of subscription payment. Confirm billing outside ROAM until a payment provider is integrated.</p></div>
      </section>
      <p className="mt-5 text-[11px] leading-5 text-slate-500">Suspended and cancelled tenants are blocked from workspace access. Reactivate only after reviewing the account. Plan prices are catalog metadata; ROAM does not currently charge cards or automatically renew subscriptions.</p>
    </div>
  </main>;
}
