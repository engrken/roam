"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Wallet, RefreshCw, PlusCircle, RotateCcw } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type BookingBalance = { reference: string; customer: string; status: string; total: number; collected: number; outstanding: number };
type Payment = { id: string; amount: number; currency: string; method: string; kind: string; reference: string | null; notes: string | null; receivedAt: string; bookingReference: string; customer: string };
type FinanceData = { summary: { collected: number; outstanding: number; rentDue: number; rentPaid: number; overdueRent: number; overdueBookings: number; payments: number; refunds: number }; payments: Payment[]; bookings: BookingBalance[]; openBookings: BookingBalance[] };

const money = (amount: number, currency = "PHP") => new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

export default function FinancePage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<"PAYMENT" | "REFUND">("PAYMENT");
  const [bookingReference, setBookingReference] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/payments`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load financial records.");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load financial records.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, bookingReference, amount, method, reference, notes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save transaction.");
      setAmount(""); setReference(""); setNotes("");
      setNotice(kind === "PAYMENT" ? "Payment recorded." : "Refund recorded.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save transaction.");
    } finally { setSaving(false); }
  }

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Financial reporting" role="Workspace team" active="finance" />
    <main className="roam-main">
      <header className="roam-page-header">
        <div><span className="roam-eyebrow">RENTAL FINANCIALS</span><h1>Financials</h1><p>Record customer payments and refunds, and track outstanding booking balances.</p></div>
        <button type="button" className="roam-button roam-button-secondary" onClick={() => { void load(); }}><RefreshCw size={16}/> Refresh</button>
      </header>
      {error && <p className="roam-error" role="alert">{error}</p>}
      {notice && <p className="roam-success" role="status">{notice}</p>}
      <section className="roam-finance-metrics">
        <article className="roam-metric-card"><div className="roam-metric-icon"><PlusCircle/></div><span>Total rent due</span><strong>{money(data?.summary.rentDue || 0)}</strong><small>Confirmed, active and completed booking value</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><Wallet/></div><span>Rent paid</span><strong>{money(data?.summary.rentPaid || 0)}</strong><small>Verified payments less refunds</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><PlusCircle/></div><span>Outstanding rent</span><strong>{money(data?.summary.outstanding || 0)}</strong><small>Remaining unpaid booking balances</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><RotateCcw/></div><span>Overdue rent</span><strong>{money(data?.summary.overdueRent || 0)}</strong><small>{data?.summary.overdueBookings || 0} active rentals past return time</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><RotateCcw/></div><span>Transactions recorded</span><strong>{data?.summary.payments || 0} / {data?.summary.refunds || 0}</strong><small>Payments / refunds</small></article>
      </section>

      <section className="roam-finance-grid">
        <article className="roam-panel">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">MANUAL ENTRY</span><h2>Record a transaction</h2></div></div>
          <form onSubmit={save} className="roam-finance-form">
            <label>Transaction type<select value={kind} onChange={(e) => setKind(e.target.value as "PAYMENT" | "REFUND")}><option value="PAYMENT">Customer payment</option><option value="REFUND">Customer refund</option></select></label>
            <label>Booking<select required value={bookingReference} onChange={(e) => setBookingReference(e.target.value)}><option value="">Choose a booking</option>{(kind === "PAYMENT" ? data?.openBookings || [] : data?.bookings.filter((booking) => booking.collected > 0) || []).map((booking) => <option key={booking.reference} value={booking.reference}>#{booking.reference} · {booking.customer} · {money(kind === "PAYMENT" ? booking.outstanding : booking.collected)}</option>)}</select></label>
            <label>Amount<input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"/></label>
            <label>Method<select value={method} onChange={(e) => setMethod(e.target.value)}><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CARD">Card</option><option value="E_WALLET">E-wallet</option><option value="OTHER">Other</option></select></label>
            <label>Transaction reference (optional)<input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="Receipt or transaction ID"/></label>
            <label>Notes (optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} placeholder="Additional details"/></label>
            <button className="roam-button" type="submit" disabled={saving || !bookingReference || !amount}>{saving ? "Saving…" : kind === "PAYMENT" ? "Record payment" : "Record refund"}</button>
          </form>
          <p className="roam-finance-disclaimer">These are manually recorded transactions, not payments processed by ROAM. Verify each receipt against your actual cash, bank, or e-wallet records.</p>
        </article>

        <article className="roam-panel">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">ACCOUNTS RECEIVABLE</span><h2>Outstanding balances</h2></div></div>
          {loading ? <p>Loading…</p> : !data?.openBookings.length ? <p className="roam-muted">No outstanding booking balances.</p> : <div className="roam-finance-table">{data.openBookings.map((booking) => <div className="roam-finance-balance" key={booking.reference}><div><strong>{booking.customer}</strong><span>#{booking.reference} · {booking.status}</span></div><div><b>{money(booking.outstanding)}</b><small>of {money(booking.total)}</small></div></div>)}</div>}
        </article>
      </section>

      <section className="roam-panel roam-finance-history">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">TRANSACTION HISTORY</span><h2>Recent payments and refunds</h2></div></div>
        {loading ? <p>Loading transactions…</p> : !data?.payments.length ? <p className="roam-muted">No customer transactions have been recorded yet.</p> : <div className="roam-table-wrap"><table className="roam-table"><thead><tr><th>Date</th><th>Customer / booking</th><th>Type</th><th>Method</th><th>Reference</th><th className="text-end">Amount</th></tr></thead><tbody>{data.payments.map((payment) => <tr key={payment.id}><td>{new Date(payment.receivedAt).toLocaleString("en-PH")}</td><td>{payment.customer}<small>#{payment.bookingReference}</small></td><td>{payment.kind === "REFUND" ? "Refund" : "Payment"}</td><td>{payment.method.replaceAll("_", " ")}</td><td>{payment.reference || "—"}</td><td className="text-end">{payment.kind === "REFUND" ? "−" : ""}{money(payment.amount, payment.currency)}</td></tr>)}</tbody></table></div>}
      </section>
    </main>
    <style jsx>{`
      .roam-finance-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:20px 0}
      .roam-finance-grid{display:grid;grid-template-columns:minmax(280px,.9fr) minmax(0,1.1fr);gap:16px}
      .roam-finance-form{display:grid;gap:12px}.roam-finance-form label{display:grid;gap:6px;font-size:12px;font-weight:650}.roam-finance-form input,.roam-finance-form select,.roam-finance-form textarea{width:100%;border:1px solid var(--roam-border,#d1d5db);border-radius:9px;padding:10px;background:var(--roam-card,#fff);color:inherit;font:inherit;font-size:13px}
      .roam-finance-disclaimer{font-size:11px;line-height:1.5;color:var(--roam-muted,#6b7280);margin:14px 0 0}
      .roam-finance-table{display:grid}.roam-finance-balance{display:flex;justify-content:space-between;gap:12px;padding:13px 0;border-bottom:1px solid var(--roam-border,#e5e7eb)}.roam-finance-balance div{display:grid;gap:4px}.roam-finance-balance strong{font-size:13px}.roam-finance-balance span,.roam-finance-balance small{font-size:11px;color:var(--roam-muted,#6b7280)}.roam-finance-balance>div:last-child{text-align:right}.roam-finance-balance b{font-size:14px}
      .roam-finance-history{margin-top:16px}.roam-table-wrap{overflow:auto}.roam-table{width:100%;border-collapse:collapse;font-size:12px}.roam-table th,.roam-table td{padding:11px 9px;text-align:left;border-bottom:1px solid var(--roam-border,#e5e7eb);white-space:nowrap}.roam-table th{font-weight:700;color:var(--roam-muted,#6b7280)}.roam-table td small{display:block;color:var(--roam-muted,#6b7280);margin-top:3px}.text-end{text-align:right!important}
      @media(max-width:900px){.roam-finance-metrics{grid-template-columns:1fr}.roam-finance-grid{grid-template-columns:1fr}}
    `}</style>
  </div>;
}
