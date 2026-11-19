"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, RefreshCw } from "lucide-react";

type AuditLog = { id: string; actorUserId: string; actorEmail: string; action: string; entityType: string; entityId: string; details: unknown; createdAt: string };

export default function PlatformAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/audit-logs?limit=100", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load audit history.");
      setLogs(body.logs || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load audit history.");
    } finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load retrieves the audit feed when the page opens.
  useEffect(() => { void load(); }, []);

  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6"><div><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft size={15}/> Platform console</Link><p className="mt-4 text-xs font-bold tracking-[.2em] text-cyan-400">SECURITY & OVERSIGHT</p><h1 className="mt-2 text-3xl font-bold">Platform audit history</h1><p className="mt-2 text-sm text-slate-400">Review administrative changes to tenant status, plans and subscription assignments.</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"><RefreshCw size={15}/> Refresh</button></header>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
    <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-slate-900"><div className="flex items-center gap-2 border-b border-white/10 px-5 py-4"><ClipboardList size={18}/><h2 className="font-semibold">Recent administrative activity</h2><span className="ml-auto text-xs text-slate-500">{logs.length} records</span></div>
      {loading ? <p className="p-8 text-sm text-slate-400">Loading audit history…</p> : logs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Time</th><th className="px-5 py-4">Administrator</th><th className="px-5 py-4">Action</th><th className="px-5 py-4">Entity</th><th className="px-5 py-4">Details</th></tr></thead><tbody>{logs.map(log=><tr key={log.id} className="border-t border-white/5 align-top"><td className="whitespace-nowrap px-5 py-4 text-slate-400">{new Date(log.createdAt).toLocaleString("en-PH")}</td><td className="px-5 py-4">{log.actorEmail}<p className="text-xs text-slate-500">{log.actorUserId}</p></td><td className="px-5 py-4 font-medium text-cyan-200">{log.action}</td><td className="px-5 py-4">{log.entityType}<p className="text-xs text-slate-500">{log.entityId}</p></td><td className="max-w-sm px-5 py-4 text-xs text-slate-400"><pre className="whitespace-pre-wrap break-words">{JSON.stringify(log.details, null, 2)}</pre></td></tr>)}</tbody></table></div> : <div className="p-10 text-center text-sm text-slate-400"><ClipboardList className="mx-auto mb-3" size={28}/><p>No platform activity has been recorded yet.</p></div>}
    </section>
    <p className="mt-4 text-xs text-slate-500">Audit records are append-only through the platform console. This view shows the latest 100 events.</p>
  </div></main>;
}
