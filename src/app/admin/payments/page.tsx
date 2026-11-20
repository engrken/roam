"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, RefreshCw, Save, ShieldCheck, X } from "lucide-react";

type Method = { clearQr?: boolean; id: string; key: string; label: string; accountName: string | null; instructions: string | null; qrImageData: string | null; qrContentType: string | null; enabled: boolean; sortOrder: number };
type Submission = { id: string; tenantId: string; tenantName: string; tenantSlug: string; tenantEmail: string; methodLabel: string; accountName: string | null; reference: string; amount: number; paidAt: string; receiptData: string | null; receiptContentType: string | null; status: string; provisionalUntil: string; rejectionReason: string | null; createdAt: string; reviewedAt: string | null };

const initialMethods = [
  { key: "GCASH", label: "GCash" },
  { key: "MAYA", label: "Maya" },
  { key: "BANK", label: "Bank transfer / QR" },
];

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read this image."));
    reader.readAsDataURL(file);
  });
}

export default function AdminPaymentsPage() {
  const [methods, setMethods] = useState<Method[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/subscription-payments", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load subscription payment settings.");
      const loaded = body.methods || [];
      setMethods(initialMethods.map(seed => loaded.find((item: Method) => item.key === seed.key) || ({ id: "", ...seed, accountName: "", instructions: "", qrImageData: null, qrContentType: null, enabled: false, sortOrder: 0 })));
      setSubmissions(body.submissions || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load payment settings.");
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch platform payment settings on entry.
  useEffect(() => { void load(); }, [load]);

  function edit(key: string, field: keyof Method, value: string | boolean | null) {
    setMethods(items => items.map(item => item.key === key ? { ...item, [field]: value } : item));
  }

  async function chooseQr(key: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError("QR images must be PNG, JPG or WebP and no larger than 2 MB.");
      event.target.value = "";
      return;
    }
    try {
      const data = await readImage(file);
      edit(key, "qrImageData", data);
      edit(key, "qrContentType", file.type);
      edit(key, "clearQr", false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to read the QR image.");
    }
  }

  async function saveMethod(method: Method) {
    setBusy(method.key); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/subscription-payments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-method", key: method.key, label: method.label, accountName: method.accountName || "", instructions: method.instructions || "", enabled: method.enabled, qrImageData: method.qrImageData, qrContentType: method.qrContentType, clearQr: method.clearQr === true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save payment method.");
      setMethods(items => items.map(item => item.key === method.key ? body.method : item));
      setNotice(method.label + " settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save payment method.");
    } finally { setBusy(""); }
  }

  async function review(item: Submission, decision: "approve" | "reject") {
    const reason = reasons[item.id] || "";
    if (!window.confirm((decision === "approve" ? "Approve this payment from " : "Reject this payment from ") + item.tenantName + "?")) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/subscription-payments", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "review-submission", submissionId: item.id, decision, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to review payment.");
      setNotice(body.message || "Payment reviewed.");
      await load();
    } catch (reasonError) {
      setError(reasonError instanceof Error ? reasonError.message : "Unable to review payment.");
    } finally { setBusy(""); }
  }

  const pending = submissions.filter(item => item.status === "PENDING");
  const history = submissions.filter(item => item.status !== "PENDING");

  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
      <div><div className="flex flex-wrap gap-4"><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft size={15}/> Platform console</Link><Link href="/admin/plans" className="text-sm text-cyan-300">Plans & subscriptions</Link><Link href="/admin/audit-logs" className="text-sm text-cyan-300">Audit history</Link></div>
        <p className="mt-4 text-xs font-bold tracking-[.2em] text-cyan-400">PLATFORM BILLING</p><h1 className="mt-2 text-3xl font-bold">Manual payment settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Manage QR payment destinations and verify tenant subscription payments. Payments are not recorded as received until approved.</p>
      </div>
      <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm"><RefreshCw size={15}/> Refresh</button>
    </header>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-950/50 p-3 text-sm text-emerald-200">{notice}</p>}
    {loading ? <p className="py-12 text-slate-400">Loading payment settings…</p> : <>
      <section className="py-8">
        <div className="mb-4 flex items-center gap-2"><ShieldCheck size={18}/><h2 className="text-xl font-semibold">Payment methods</h2></div>
        <div className="grid gap-4 lg:grid-cols-3">{methods.map(method => <article key={method.key} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-cyan-300">{method.key}</p><h3 className="mt-1 text-lg font-semibold">{method.label}</h3></div><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={method.enabled} onChange={event => edit(method.key, "enabled", event.target.checked)}/> Enabled</label></div>
          <label className="mt-4 block text-xs text-slate-400">Display name<input value={method.label} onChange={event => edit(method.key, "label", event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"/></label>
          <label className="mt-3 block text-xs text-slate-400">Account name / recipient<input value={method.accountName || ""} onChange={event => edit(method.key, "accountName", event.target.value)} placeholder="Name shown to tenants" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"/></label>
          <label className="mt-3 block text-xs text-slate-400">Payment instructions<textarea value={method.instructions || ""} onChange={event => edit(method.key, "instructions", event.target.value)} rows={3} placeholder="Add payment instructions…" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"/></label>
          <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-slate-950/60 p-3">
            {method.qrImageData ? <img src={method.qrImageData} alt={method.label + " payment QR code"} className="mx-auto max-h-48 rounded-lg object-contain"/> : <div className="grid h-36 place-items-center text-center text-xs text-slate-500">No QR code uploaded yet</div>}
            <label className="mt-3 block cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-center text-xs font-semibold text-slate-200 hover:bg-white/5">{method.qrImageData ? "Replace QR code" : "Upload QR code"}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => void chooseQr(method.key, event)}/></label>
            {method.qrImageData && <button onClick={() => { edit(method.key, "qrImageData", null); edit(method.key, "qrContentType", null); edit(method.key, "clearQr", true); }} className="mt-2 w-full text-xs text-rose-300">Remove QR image</button>}
            <p className="mt-2 text-[10px] text-slate-500">PNG, JPG or WebP · maximum 2 MB. QR data is stored in ROAM and shown only in authenticated tenant payment pages.</p>
          </div>
          <button disabled={busy === method.key} onClick={() => void saveMethod(method)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50"><Save size={15}/>{busy === method.key ? "Saving…" : "Save payment method"}</button>
        </article>)}</div>
      </section>

      <section className="border-t border-white/10 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Payment review queue</h2><p className="mt-1 text-xs text-slate-500">Pending submissions temporarily unlock eligible workspaces for up to 3 days.</p></div><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">{pending.length} pending</span></div>
        {pending.length ? <div className="grid gap-4">{pending.map(item => <article key={item.id} className="rounded-2xl border border-amber-400/20 bg-slate-900 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{item.tenantName}</h3><p className="mt-1 text-xs text-slate-400">{item.tenantSlug} · {item.tenantEmail}</p></div><span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">PENDING REVIEW</span></div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-slate-500">Payment method</p><p className="mt-1">{item.methodLabel}</p><p className="text-xs text-slate-400">{item.accountName || "—"}</p></div>
            <div><p className="text-xs text-slate-500">Amount</p><p className="mt-1 font-semibold">₱{item.amount.toLocaleString("en-PH",{minimumFractionDigits:2})}</p></div>
            <div><p className="text-xs text-slate-500">Transaction reference</p><p className="mt-1 break-all">{item.reference}</p></div>
            <div><p className="text-xs text-slate-500">Paid on / submitted</p><p className="mt-1">{new Date(item.paidAt).toLocaleString("en-PH")}</p><p className="text-xs text-slate-400">Submitted {new Date(item.createdAt).toLocaleString("en-PH")}</p></div>
          </div>
          <p className="mt-3 text-xs text-amber-200">Provisional access ends {new Date(item.provisionalUntil).toLocaleString("en-PH")}</p>
          {item.receiptData && <a href={item.receiptData} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs font-semibold text-cyan-300 underline">Open submitted receipt screenshot</a>}
          <label className="mt-4 block text-xs text-slate-400">Rejection reason (optional)<textarea value={reasons[item.id] || ""} onChange={event => setReasons(current => ({...current,[item.id]:event.target.value}))} rows={2} placeholder="Explain what needs correction…" className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"/></label>
          <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy === item.id} onClick={() => void review(item,"approve")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"><Check size={15}/> Approve payment</button><button disabled={busy === item.id} onClick={() => void review(item,"reject")} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-200 disabled:opacity-50"><X size={15}/> Reject</button></div>
        </article>)}</div> : <p className="rounded-xl border border-white/10 bg-slate-900 p-6 text-sm text-slate-400">No pending subscription payments.</p>}
      </section>

      <section className="border-t border-white/10 py-8"><h2 className="mb-4 text-xl font-semibold">Payment history</h2>
        {history.length ? <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-950/70 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-4">Tenant</th><th className="px-5 py-4">Method / reference</th><th className="px-5 py-4">Amount</th><th className="px-5 py-4">Submitted</th><th className="px-5 py-4">Status</th></tr></thead><tbody>{history.map(item=><tr key={item.id} className="border-t border-white/5"><td className="px-5 py-4"><b>{item.tenantName}</b><p className="text-xs text-slate-500">{item.tenantSlug}</p></td><td className="px-5 py-4">{item.methodLabel}<p className="break-all text-xs text-slate-500">{item.reference}</p></td><td className="px-5 py-4">₱{item.amount.toLocaleString("en-PH",{minimumFractionDigits:2})}</td><td className="px-5 py-4 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString("en-PH")}</td><td className="px-5 py-4"><span className="rounded-full bg-white/5 px-2.5 py-1 text-xs">{item.status}</span>{item.rejectionReason && <p className="mt-1 max-w-xs text-xs text-rose-300">{item.rejectionReason}</p>}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-white/10 bg-slate-900 p-5 text-sm text-slate-400">No reviewed payments yet.</p>}
      </section>
    </>}
  </div></main>;
}
