"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Wallet, RefreshCw, BadgeDollarSign, CircleAlert, ReceiptText,
  ArrowDownLeft, CheckCircle2, CalendarClock, Plus,
} from "lucide-react";
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
      setNotice(kind === "PAYMENT" ? "Payment recorded successfully." : "Refund recorded successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save transaction.");
    } finally { setSaving(false); }
  }

  const availableBookings = kind === "PAYMENT"
    ? data?.openBookings || []
    : data?.bookings.filter((booking) => booking.collected > 0) || [];
  const selectedBooking = availableBookings.find((booking) => booking.reference === bookingReference);

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Financial reporting" role="Workspace team" active="finance" />
    <main className="roam-main roam-finance-page">
      <header className="roam-page-header finance-page-header">
        <div>
          <span className="roam-eyebrow">RENTAL FINANCIALS</span>
          <h1>Financials</h1>
          <p>A clear view of rental income, unpaid balances, and recorded transactions.</p>
        </div>
        <button type="button" className="roam-button roam-button-secondary finance-refresh" onClick={() => { void load(); }} disabled={loading}>
          <RefreshCw size={16} className={loading ? "finance-spin" : ""} /> {loading ? "Updating…" : "Refresh data"}
        </button>
      </header>

      {error && <p className="roam-error finance-alert" role="alert">{error}</p>}
      {notice && <p className="roam-success finance-alert" role="status"><CheckCircle2 size={16}/>{notice}</p>}

      <section className="finance-section" aria-labelledby="finance-overview-title">
        <div className="finance-section-heading">
          <div><span className="roam-eyebrow">AT A GLANCE</span><h2 id="finance-overview-title">Rental overview</h2></div>
          <span className="finance-updated">{loading ? "Updating figures…" : "Based on recorded booking and payment data"}</span>
        </div>
        <div className="roam-finance-metrics">
          <article className="roam-metric-card finance-metric">
            <div className="finance-metric-top"><span>Total rent due</span><span className="finance-icon"><BadgeDollarSign size={19}/></span></div>
            <strong>{money(data?.summary.rentDue || 0)}</strong><small>Value of confirmed, active, and completed bookings</small>
          </article>
          <article className="roam-metric-card finance-metric finance-metric-positive">
            <div className="finance-metric-top"><span>Rent paid</span><span className="finance-icon"><Wallet size={19}/></span></div>
            <strong>{money(data?.summary.rentPaid || 0)}</strong><small>Verified payments, less refunds</small>
          </article>
          <article className="roam-metric-card finance-metric">
            <div className="finance-metric-top"><span>Outstanding rent</span><span className="finance-icon"><ReceiptText size={19}/></span></div>
            <strong>{money(data?.summary.outstanding || 0)}</strong><small>Remaining unpaid booking balances</small>
          </article>
          <article className="roam-metric-card finance-metric finance-metric-warning">
            <div className="finance-metric-top"><span>Overdue rent</span><span className="finance-icon"><CircleAlert size={19}/></span></div>
            <strong>{money(data?.summary.overdueRent || 0)}</strong><small>{data?.summary.overdueBookings || 0} active rentals past their return time</small>
          </article>
          <article className="roam-metric-card finance-metric">
            <div className="finance-metric-top"><span>Transactions recorded</span><span className="finance-icon"><ArrowDownLeft size={19}/></span></div>
            <strong className="finance-transaction-count">{data?.summary.payments || 0}<i>/</i>{data?.summary.refunds || 0}</strong><small>Payments <span>•</span> Refunds</small>
          </article>
        </div>
        <p className="finance-footnote">Rent due is booking value, not profit. Only verified transactions are included in rent paid.</p>
        <aside className="finance-verification-note" aria-label="Security deposit refund procedure"><CircleAlert size={16}/><p><strong>Security deposit refunds:</strong> Complete and save the return inspection first. Compare the vehicle condition with the handover record, list any supported deductions (such as documented damage or missing items), and tell the customer the calculation. Refund only the remaining deposit actually due, using the original payment channel where practical. Record the refund here with the transfer reference and an itemized note. ROAM records the refund; it does not send money or decide whether a deduction is lawful.</p></aside>
      </section>

      <section className="roam-finance-grid finance-workspace">
        <article className="roam-panel finance-entry-panel">
          <div className="roam-panel-heading finance-panel-heading">
            <div><span className="roam-eyebrow">MANUAL ENTRY</span><h2>Record a transaction</h2><p>Log a payment received or a refund issued for a booking.</p></div>
            <span className="finance-panel-icon"><Plus size={19}/></span>
          </div>
          <form onSubmit={save} className="roam-finance-form finance-form">
            <label>Transaction type
              <select value={kind} onChange={(e) => { setKind(e.target.value as "PAYMENT" | "REFUND"); setBookingReference(""); }}>
                <option value="PAYMENT">Customer payment</option><option value="REFUND">Customer refund</option>
              </select>
            </label>
            <label>Booking
              <select required value={bookingReference} onChange={(e) => setBookingReference(e.target.value)}>
                <option value="">{kind === "PAYMENT" ? "Select a booking with a balance" : "Select a booking with a payment"}</option>
                {availableBookings.map((booking) => <option key={booking.reference} value={booking.reference}>#{booking.reference} · {booking.customer} · {money(kind === "PAYMENT" ? booking.outstanding : booking.collected)}</option>)}
              </select>
              <small>{kind === "PAYMENT" ? "Choose the booking this payment should be applied to." : "Only bookings with recorded collections are listed."}</small>
            </label>
            <div className="finance-form-row">
              <label>Amount (PHP)
                <input required type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"/>
              </label>
              <label>Payment method
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CARD">Card</option><option value="E_WALLET">E-wallet</option><option value="OTHER">Other</option>
                </select>
              </label>
            </div>
            <label>{kind === "PAYMENT" ? "Receipt / transaction reference" : "Refund transaction reference"} <span className="finance-optional">Optional, but recommended</span>
              <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="Receipt number or transaction ID"/>
            </label>
            <label>{kind === "REFUND" ? "Refund reason" : "Additional notes"} {kind === "REFUND" ? <span className="finance-optional">Required</span> : <span className="finance-optional">Optional</span>}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} required={kind === "REFUND"} placeholder={kind === "REFUND" ? "Explain why the refund was issued. For deposits, list each deduction and its amount." : "Add any useful details for your records"}/>
            </label>
            <button className="roam-button finance-submit" type="submit" disabled={saving || !bookingReference || !amount || Number(amount) <= 0 || (kind === "REFUND" && !notes.trim())}>
              {saving ? "Saving transaction…" : kind === "PAYMENT" ? "Save payment record" : "Save refund record"}
            </button>
          </form>
          <div className="finance-verification-note"><CircleAlert size={16}/><p><strong>Before you save:</strong> ROAM only records the transaction. Confirm the money was actually received or sent. For deposit refunds, record the amount returned and explain any deductions.</p></div>
        </article>

        <article className="roam-panel finance-balances-panel">
          <div className="roam-panel-heading finance-panel-heading">
            <div><span className="roam-eyebrow">ACCOUNTS RECEIVABLE</span><h2>Outstanding balances</h2><p>Bookings that still have rent to collect.</p></div>
            <span className="finance-count">{data?.openBookings.length || 0}</span>
          </div>
          {loading && !data ? <div className="finance-empty"><CalendarClock size={22}/><span>Loading balances…</span></div>
            : !data?.openBookings.length ? <div className="finance-empty"><CheckCircle2 size={24}/><strong>All caught up</strong><span>No outstanding booking balances right now.</span></div>
            : <div className="roam-finance-table">{data.openBookings.map((booking) => <div className="roam-finance-balance" key={booking.reference}>
              <div><strong>{booking.customer}</strong><span>Booking #{booking.reference} · {booking.status.toLowerCase()}</span></div>
              <div><b>{money(booking.outstanding)}</b><small>of {money(booking.total)}</small></div>
            </div>)}</div>}
          <div className="finance-balance-footnote">Amounts shown are the remaining balances from recorded booking transactions.</div>
        </article>
      </section>

      <section className="roam-panel roam-finance-history finance-history-panel">
        <div className="roam-panel-heading finance-panel-heading">
          <div><span className="roam-eyebrow">TRANSACTION HISTORY</span><h2>Recent payments and refunds</h2><p>A record of transactions entered by your team.</p></div>
          <span className="finance-count">{data?.payments.length || 0} records</span>
        </div>
        {loading && !data ? <div className="finance-empty">Loading transaction history…</div>
          : !data?.payments.length ? <div className="finance-empty"><ReceiptText size={24}/><strong>No transactions yet</strong><span>Payments and refunds you record will appear here.</span></div>
          : <div className="roam-table-wrap"><table className="roam-table finance-table"><thead><tr><th>Date</th><th>Customer / booking</th><th>Type</th><th>Method</th><th>Reference</th><th className="text-end">Amount</th></tr></thead><tbody>{data.payments.map((payment) => <tr key={payment.id}>
            <td>{new Date(payment.receivedAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</td>
            <td><strong>{payment.customer}</strong><small>Booking #{payment.bookingReference}</small></td>
            <td><span className={payment.kind === "REFUND" ? "finance-type finance-type-refund" : "finance-type finance-type-payment"}>{payment.kind === "REFUND" ? "Refund" : "Payment"}</span></td>
            <td>{payment.method.replaceAll("_", " ")}</td><td>{payment.reference || "—"}</td>
            <td className="text-end"><strong>{payment.kind === "REFUND" ? "−" : ""}{money(payment.amount, payment.currency)}</strong></td>
          </tr>)}</tbody></table></div>}
      </section>
    </main>
    <style jsx>{`
      .roam-finance-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px;margin:0}
      .finance-page-header{align-items:flex-end;margin-bottom:27px}
      .finance-page-header h1{font-size:clamp(32px,3.8vw,44px);line-height:1.12;letter-spacing:-1.7px;margin:10px 0 8px}
      .finance-page-header p{max-width:640px;margin:0;color:var(--roam-muted,#64748b);font-size:14px;line-height:1.65}
      .finance-refresh{white-space:nowrap;min-height:42px}
      .finance-section{margin:0 0 22px}
      .finance-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:13px}
      .finance-section-heading h2{margin:5px 0 0;font-size:18px;letter-spacing:-.35px}
      .finance-updated{color:var(--roam-muted,#64748b);font-size:11px}
      .finance-metric{padding:17px 16px;min-height:145px;display:flex;flex-direction:column;gap:8px;border:1px solid var(--roam-border,#e2e8f0);border-radius:13px;background:var(--roam-card,#fff);box-shadow:0 3px 12px rgba(15,23,42,.035)}
      .finance-metric-top{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--roam-muted,#64748b);font-size:11px;font-weight:700}
      .finance-icon{display:grid;place-items:center;width:33px;height:33px;border-radius:10px;background:#eef6f8;color:#08758a;flex:0 0 auto}
      .finance-metric>strong{font-size:clamp(19px,1.8vw,25px);line-height:1.2;letter-spacing:-.7px;font-weight:800;color:var(--roam-ink,#17243a);overflow-wrap:anywhere}
      .finance-metric small{font-size:10px;line-height:1.5;color:var(--roam-muted,#64748b)}
      .finance-metric-positive .finance-icon{background:#eaf7f0;color:#15804b}
      .finance-metric-warning .finance-icon{background:#fff5e8;color:#b66b12}
      .finance-transaction-count{display:flex;align-items:center;gap:9px}.finance-transaction-count i{font-size:17px;font-style:normal;color:var(--roam-muted,#94a3b8);font-weight:500}
      .finance-footnote{margin:10px 2px 0;color:var(--roam-muted,#64748b);font-size:10px;line-height:1.5}
      .finance-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
      .finance-panel-heading{align-items:flex-start;margin-bottom:18px}
      .finance-panel-heading h2{margin:5px 0 5px;font-size:18px;letter-spacing:-.4px}
      .finance-panel-heading p{margin:0;color:var(--roam-muted,#64748b);font-size:11px;line-height:1.5}
      .finance-panel-icon{display:grid;place-items:center;width:35px;height:35px;border-radius:10px;background:#eaf5f7;color:#08758a;flex:0 0 auto}
      .finance-form{gap:14px}
      .finance-kind-field{min-width:0;margin:0;padding:0;border:0}
      .finance-kind-field legend{margin-bottom:8px;color:var(--roam-ink,#243449);font-size:11px;font-weight:750}
      .finance-kind-options{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .finance-kind-option{display:flex;align-items:center;gap:10px;min-width:0;min-height:66px;padding:11px;border:1px solid var(--roam-border,#d8e1eb);border-radius:10px;background:var(--roam-card,#fff);color:var(--roam-ink,#243449);text-align:left;cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s}
      .finance-kind-option>svg{flex:0 0 auto;color:var(--roam-muted,#64748b)}
      .finance-kind-option span{display:grid;gap:4px;min-width:0}
      .finance-kind-option strong{font-size:11px}
      .finance-kind-option small{font-size:9px;line-height:1.4;color:var(--roam-muted,#64748b)}
      .finance-kind-option.is-selected{border-color:#16889b;background:#eff9fa;box-shadow:0 0 0 2px rgba(22,136,155,.1)}
      .finance-kind-option.is-selected>svg{color:#08758a}
      .finance-selected-booking{display:grid;gap:5px;padding:12px 13px;border:1px solid #cde7e8;border-radius:10px;background:#f1faf9}
      .finance-selected-booking>div{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .finance-selected-booking span{font-size:10px;color:#526b73}
      .finance-selected-booking strong{font-size:16px;color:#0b6572}
      .finance-selected-booking>small{font-size:9px;color:#647989}
      .finance-form label{gap:7px;color:var(--roam-ink,#243449);font-size:11px;font-weight:700}
      .finance-form label small{color:var(--roam-muted,#64748b);font-size:10px;font-weight:400;line-height:1.45}
      .finance-form input,.finance-form select,.finance-form textarea{min-height:42px;border:1px solid var(--roam-border,#d8e1eb);border-radius:9px;padding:10px 12px;background:var(--roam-card,#fff);color:var(--roam-ink,#17243a);font:500 12px inherit;outline:none;transition:border-color .15s,box-shadow .15s}
      .finance-form input:focus,.finance-form select:focus,.finance-form textarea:focus{border-color:#16889b;box-shadow:0 0 0 3px rgba(22,136,155,.12)}
      .finance-form textarea{resize:vertical;min-height:68px}
      .finance-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .finance-optional{margin-left:4px;color:var(--roam-muted,#94a3b8);font-size:10px;font-weight:400}
      .finance-submit{width:100%;justify-content:center;min-height:44px;margin-top:2px}
      .finance-verification-note{display:flex;align-items:flex-start;gap:9px;margin-top:16px;padding:11px 12px;border:1px solid #f0dfbd;border-radius:9px;background:#fffaf0;color:#825b20}
      .finance-verification-note svg{flex:0 0 auto;margin-top:1px}
      .finance-verification-note p{margin:0;font-size:10px;line-height:1.55}
      .finance-balances-panel{min-width:0}
      .finance-count{display:inline-flex;align-items:center;justify-content:center;min-height:26px;padding:4px 9px;border-radius:999px;background:#f0f5f8;color:#526579;font-size:10px;font-weight:700;white-space:nowrap}
      .roam-finance-table{display:grid;max-height:440px;overflow:auto}
      .roam-finance-balance{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 2px;border-bottom:1px solid var(--roam-border,#e5e7eb)}
      .roam-finance-balance div{display:grid;gap:5px;min-width:0}
      .roam-finance-balance strong{font-size:12px;overflow-wrap:anywhere}
      .roam-finance-balance span,.roam-finance-balance small{font-size:10px;color:var(--roam-muted,#64748b)}
      .roam-finance-balance>div:last-child{text-align:right;flex:0 0 auto}
      .roam-finance-balance b{font-size:13px}
      .finance-balance-footnote{margin-top:13px;padding-top:11px;border-top:1px solid var(--roam-border,#e5e7eb);color:var(--roam-muted,#64748b);font-size:10px;line-height:1.5}
      .finance-history-panel{margin-top:16px}
      .roam-table-wrap{overflow:auto;border:1px solid var(--roam-border,#e5e7eb);border-radius:10px}
      .finance-table{min-width:760px;width:100%;border-collapse:collapse;font-size:11px}
      .finance-table th,.finance-table td{padding:13px 12px;text-align:left;border-bottom:1px solid var(--roam-border,#e5e7eb);white-space:nowrap}
      .finance-table th{background:var(--roam-surface-2,#f8fafc);font-size:10px;font-weight:750;color:var(--roam-muted,#64748b)}
      .finance-table tbody tr:last-child td{border-bottom:0}
      .finance-table tbody tr:hover{background:var(--roam-surface-2,#f8fafc)}
      .finance-table td strong{font-weight:700}
      .finance-table td small{display:block;color:var(--roam-muted,#64748b);margin-top:4px;font-size:10px}
      .finance-type{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:750}
      .finance-type-payment{background:#eaf7f0;color:#16764b}.finance-type-refund{background:#fff2e9;color:#a65b27}
      .finance-empty{display:flex;min-height:150px;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;color:var(--roam-muted,#64748b);font-size:11px}
      .finance-empty svg{color:#0b8293}.finance-empty strong{color:var(--roam-ink,#243449);font-size:13px}
      .finance-alert{display:flex;align-items:center;gap:8px;padding:11px 14px;border-radius:9px;font-size:12px}
      .finance-spin{animation:finance-spin 1s linear infinite}
      @keyframes finance-spin{to{transform:rotate(360deg)}}
      @media(max-width:1180px){.roam-finance-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:900px){.finance-workspace{grid-template-columns:1fr}.finance-page-header{align-items:flex-start}}
      @media(max-width:650px){
        .roam-finance-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
        .finance-metric{padding:13px 12px;min-height:137px}
        .finance-metric>strong{font-size:19px}
        .finance-metric small{font-size:9px}
        .finance-section-heading{align-items:flex-start;flex-direction:column;gap:6px}
        .finance-page-header{gap:14px}
        .finance-page-header h1{font-size:32px}
        .finance-refresh{min-height:38px}
        .finance-form-row{grid-template-columns:1fr}
      }
      @media(max-width:380px){.roam-finance-metrics{grid-template-columns:1fr}.finance-metric{min-height:0}}
    `}</style>
  </div>;
}
