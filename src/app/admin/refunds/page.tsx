"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, RefreshCw, Wallet, XCircle } from "lucide-react";

type Payment = {
  id: string; tenantId: string; tenantName: string; tenantSlug: string; tenantEmail: string;
  description: string; reference: string | null; amount: number; currency: string; paidAt: string | null;
  reservedRefundAmount: number; remainingRefundable: number;
};
type Refund = {
  id: string; tenantName: string; tenantSlug: string; billingRecordId: string; paymentReference: string | null;
  paymentDescription: string; paymentAmount: number; amount: number; currency: string; method: string;
  reference: string | null; reason: string; status: string; completedAt: string | null; createdAt: string;
};

const money = (amount: number, currency = "PHP") => new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
const date = (value: string | null) => value ? new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function AdminRefundsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("GCASH");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/subscription-refunds", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load refund records.");
      setPayments(body.payments || []); setRefunds(body.refunds || []);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to load refund records.");
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load admin refund data on entry.
  useEffect(() => { void load(); }, [load]);

  async function createRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentId) { setError("Choose a subscription payment."); return; }
    setBusy("create"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/subscription-refunds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingRecordId: paymentId, amount: Number(amount), method, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to create refund record.");
      setNotice(body.message || "Refund record created.");
      setPaymentId(""); setAmount(""); setReason("");
      await load();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to create refund record.");
    } finally { setBusy(""); }
  }

  async function updateRefund(item: Refund, decision: "complete" | "cancel") {
    const reference = decision === "complete" ? window.prompt("Enter the external refund transaction reference (GCash/Maya/bank):", "")?.trim() || "" : "";
    if (decision === "complete" && !reference) return;
    if (decision === "cancel" && !window.confirm("Cancel this pending refund entry? Its reserved amount will become refundable again.")) return;
    setBusy(item.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/subscription-refunds", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundId: item.id, decision, reference }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update refund.");
      setNotice(body.message || "Refund updated.");
      await load();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Unable to update refund.");
    } finally { setBusy(""); }
  }

  const selected = payments.find(item => item.id === paymentId);
  const pending = refunds.filter(item => item.status === "PENDING");
  const history = refunds.filter(item => item.status !== "PENDING");

  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
      <div><div className="flex flex-wrap gap-4"><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft size={15}/> Platform console</Link><Link href="/admin/payments" className="text-sm text-cyan-300">Payment settings</Link><Link href="/admin/plans" className="text-sm text-cyan-300">Plans & subscriptions</Link></div>
        <p className="mt-4 text-xs font-bold tracking-[.2em] text-cyan-400">PLATFORM BILLING</p><h1 className="mt-2 text-3xl font-bold">Subscription refunds</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">Record manual subscription refunds after sending funds outside ROAM. ROAM tracks the amount, reason, payout method and external transaction reference; it does not transfer money.</p>
      </div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/5 disabled:opacity-50"><RefreshCw size={15}/> Refresh</button>
    </header>

    {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-950/50 p-3 text-sm text-red-200">{error}</div>}
    {notice && <div role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</div>}

    <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.85fr)]">
      <form onSubmit={createRefund} className="rounded-2xl border border-white/10 bg-slate-900 p-5">
        <div className="flex items-center gap-2 text-cyan-300"><Wallet size={18}/><span className="text-xs font-bold tracking-[.16em]">NEW REFUND ENTRY</span></div>
        <h2 className="mt-2 text-lg font-semibold">Record a manual refund</h2>
        <p className="mt-1 text-xs leading-5 text-slate-400">Create a pending ledger entry first. After the money has been sent, mark it completed and enter the payout reference.</p>
        <label className="mt-5 block text-xs text-slate-400">Paid subscription transaction
          <select required value={paymentId} onChange={event => setPaymentId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white">
            <option value="">Choose a payment</option>
            {payments.filter(item => item.remainingRefundable > 0).map(item => <option key={item.id} value={item.id}>{item.tenantName} · {money(item.amount,item.currency)} · {item.reference || item.id.slice(0,10)} · refundable {money(item.remainingRefundable,item.currency)}</option>)}
          </select>
        </label>
        {selected && <p className="mt-2 text-xs text-slate-500">Payment date: {date(selected.paidAt)} · Remaining refundable: {money(selected.remainingRefundable, selected.currency)}</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-slate-400">Refund amount
            <input required type="number" min="0.01" max={selected?.remainingRefundable || undefined} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white"/>
          </label>
          <label className="block text-xs text-slate-400">Refund method
            <select value={method} onChange={event => setMethod(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white"><option value="GCASH">GCash</option><option value="MAYA">Maya</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select>
          </label>
        </div>
        <label className="mt-4 block text-xs text-slate-400">Reason
          <textarea required minLength={3} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} rows={3} placeholder="Explain why the subscription payment is being refunded." className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white placeholder:text-slate-600"/>
        </label>
        <button type="submit" disabled={busy === "create" || !payments.some(item => item.id === paymentId && item.remainingRefundable > 0)} className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{busy === "create" ? "Saving…" : "Create pending refund record"}</button>
      </form>

      <aside className="rounded-2xl border border-white/10 bg-slate-900 p-5">
        <h2 className="font-semibold">Refund controls</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <li>• Only paid subscription billing records can be refunded here.</li>
          <li>• Pending and completed refunds reserve part of the original payment, preventing over-refunds.</li>
          <li>• Cancelled entries release the reserved balance.</li>
          <li>• Completing a refund requires the external GCash, Maya, bank or cash transaction reference.</li>
          <li>• Existing payment and billing records are never edited or deleted.</li>
        </ul>
      </aside>
    </section>

    <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold">Pending refunds <span className="ml-2 rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-200">{pending.length}</span></h2><p className="mt-1 text-xs text-slate-500">Send the refund externally before marking it completed.</p></div>
      {loading ? <p className="p-6 text-sm text-slate-500">Loading refunds…</p> : pending.length === 0 ? <p className="p-6 text-sm text-slate-500">No pending refund entries.</p> : <div className="divide-y divide-white/5">{pending.map(item => <article key={item.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto]">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.tenantName}</h3><span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-200">PENDING</span></div><p className="mt-1 text-sm font-semibold text-cyan-200">{money(item.amount,item.currency)} · {item.method.replace("_"," ")}</p><p className="mt-1 text-xs text-slate-400">{item.paymentDescription} · payment ref {item.paymentReference || "—"}</p><p className="mt-2 text-sm text-slate-300">{item.reason}</p><p className="mt-1 text-[11px] text-slate-500">Created {date(item.createdAt)}</p></div>
        <div className="flex flex-wrap items-center gap-2"><button disabled={!!busy} onClick={() => void updateRefund(item,"complete")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-50"><CheckCircle2 size={14}/> Mark completed</button><button disabled={!!busy} onClick={() => void updateRefund(item,"cancel")} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-50"><XCircle size={14}/> Cancel</button></div>
      </article>)}</div>}
    </section>

    <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <div className="border-b border-white/10 px-5 py-4"><h2 className="font-semibold">Refund history</h2><p className="mt-1 text-xs text-slate-500">Completed and cancelled refund entries · latest 200.</p></div>
      {history.length === 0 ? <p className="p-6 text-sm text-slate-500">No refund history yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-950/60 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Workspace</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Method / reference</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Date</th></tr></thead><tbody>{history.map(item => <tr key={item.id} className="border-t border-white/5"><td className="px-5 py-4"><p className="font-medium">{item.tenantName}</p><p className="mt-1 text-xs text-slate-500">{item.reason}</p></td><td className="px-5 py-4 font-semibold">{money(item.amount,item.currency)}</td><td className="px-5 py-4 text-xs text-slate-300">{item.method.replace("_"," ")}<p className="mt-1 text-slate-500">{item.reference || "—"}</p></td><td className="px-5 py-4"><span className={"rounded-full px-2 py-1 text-[10px] font-bold " + (item.status === "COMPLETED" ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-700 text-slate-300")}>{item.status}</span></td><td className="px-5 py-4 text-xs text-slate-400">{date(item.completedAt || item.createdAt)}</td></tr>)}</tbody></table></div>}
    </section>
    <p className="mt-5 text-[11px] leading-5 text-slate-500">This is an administrative accounting record only. ROAM does not initiate, transmit, or verify the external transfer of refund funds.</p>
  </div></main>;
}
