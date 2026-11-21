"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardCopy, FileCheck2, RefreshCw } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type LineItem = { label: string; amount: number };
type Quote = {
  id: string; version: number; status: string; currency: string; dailyRate: number;
  rentalDays: number; baseAmount: number; addOns: LineItem[]; discountAmount: number;
  fees: LineItem[]; totalAmount: number; validUntil: string; agreementReference: string | null;
  agreementReviewedAt: string | null; approvedAt: string | null; createdAt: string;
};
type Inquiry = {
  id: string; requesterName: string; requesterEmail: string; requesterPhone: string | null;
  startAt: string; endAt: string; dailyRateSnapshot: number; status: string; message: string | null;
  listing: { headline: string; vehicle: { make: string; model: string; year: number | null } };
  rentalQuotes: Quote[];
};

const date = (value: string) => new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
const money = (value: number, currency: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(value);
const parseLineItems = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
  const separator = line.lastIndexOf("|");
  if (separator < 1) throw new Error("Enter each line item as: Description | Amount");
  const label = line.slice(0, separator).trim();
  const amount = Number(line.slice(separator + 1).trim());
  if (!label || !Number.isFinite(amount) || amount < 0) throw new Error("Each line item needs a description and a non-negative amount.");
  return { label, amount };
});
const defaultExpiry = () => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const value = new Date(`${today}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 7);
  return value.toISOString().slice(0, 10);
};
const quoteText = (inquiry: Inquiry, quote: Quote) => [
  `ROAM RENTAL QUOTATION — VERSION ${quote.version}`,
  `Renter: ${inquiry.requesterName}`,
  `Vehicle: ${inquiry.listing.vehicle.make} ${inquiry.listing.vehicle.model} — ${inquiry.listing.headline}`,
  `Rental period: ${date(inquiry.startAt)} to ${date(inquiry.endAt)} (${quote.rentalDays} day(s))`,
  `Daily rate: ${money(quote.dailyRate, quote.currency)}`,
  `Rental subtotal: ${money(quote.baseAmount, quote.currency)}`,
  ...(quote.addOns || []).map((item) => `Add-on — ${item.label}: ${money(item.amount, quote.currency)}`),
  ...(quote.fees || []).map((item) => `Fee — ${item.label}: ${money(item.amount, quote.currency)}`),
  `Discount: -${money(quote.discountAmount, quote.currency)}`,
  `TOTAL: ${money(quote.totalAmount, quote.currency)}`,
  `Quote valid until: ${date(quote.validUntil)}`,
  `Agreement reference: ${quote.agreementReference || "Not yet reviewed"}`,
  "",
  "NON-BINDING QUOTATION — This is not a reservation or booking confirmation. Final availability, vehicle condition, pickup/return arrangements, renter requirements, deposits and applicable terms must be confirmed before a booking is made. No vehicle is held and no payment has been collected.",
].join("\n");

export default function MarketplaceQuotesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [currency, setCurrency] = useState("PHP");
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace/quotes`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load rental quotes.");
      setInquiries(data.inquiries || []);
      setCurrency(data.currency || "PHP");
      setRole(data.role || "STAFF");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load rental quotes.");
    } finally { setLoading(false); }
  }, [slug]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load the quote workspace on entry.
  useEffect(() => { void load(); }, [load]);

  async function createQuote(event: FormEvent<HTMLFormElement>, inquiry: Inquiry) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace/quotes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiryId: inquiry.id,
          dailyRate: Number(values.get("dailyRate")),
          addOns: parseLineItems(String(values.get("addOns") || "")),
          discountAmount: Number(values.get("discountAmount") || 0),
          fees: parseLineItems(String(values.get("fees") || "")),
          validUntil: String(values.get("validUntil") || ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create quote draft.");
      setNotice(`Quote version ${data.quote.version} created as a draft. Review it before approval.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create quote draft."); }
    finally { setSaving(false); }
  }

  async function approveQuote(event: FormEvent<HTMLFormElement>, quote: Quote) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace/quotes`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          agreementReference: String(values.get("agreementReference") || ""),
          agreementReviewed: values.get("agreementReviewed") === "on",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to approve quote.");
      setNotice(`Quote version ${quote.version} approved and agreement review recorded.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to approve quote."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="roam-loading">Loading Marketplace quotes…</main>;

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Marketplace" role={role} active="marketplace"/>
    <main className="roam-main">
      <header className="roam-topbar">
        <div>
          <Link href={`/workspace/${slug}/marketplace/operations`} className="roam-back-link"><ArrowLeft size={14}/> Availability & inquiries</Link>
          <span className="roam-eyebrow">MARKETPLACE COMMERCIAL REVIEW</span>
          <h1>Rental quotes & agreement review</h1>
          <p>Prepare itemized, versioned quotations and record staff approval of the applicable agreement reference.</p>
        </div>
        <div className="roam-topbar-actions"><button className="roam-secondary-btn" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div>
      </header>
      {error && <p className="client-alert mt-4" role="alert">{error}</p>}
      {notice && <p className="client-success-inline mt-4" role="status">{notice}</p>}
      <section className="roam-panel mt-5" style={{borderColor:"#d97706",background:"#fffbeb"}}>
        <div className="flex items-start gap-3"><FileCheck2 className="mt-1 shrink-0 text-amber-700"/><div>
          <h2 className="font-semibold text-amber-950">Draft and approval only — no booking or payment</h2>
          <p className="mt-1 text-sm leading-6 text-amber-900">Quotes are non-binding snapshots. Approval records that staff reviewed the identified agreement version; it does not mean the renter accepted it or that a contract was signed. Copying a quote does not send it. This workspace never creates a reservation, holds dates, allocates a vehicle, sends renter messages or collects payment.</p>
        </div></div>
      </section>
      {inquiries.length ? <div className="mt-5 grid gap-5">{inquiries.map((inquiry) => {
        const latest = inquiry.rentalQuotes[0];
        const eligible = ["QUALIFIED", "READY_FOR_MANUAL_BOOKING"].includes(inquiry.status);
        return <section key={inquiry.id} className="roam-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><span className="roam-eyebrow">RENTER INQUIRY · {inquiry.status.replaceAll("_", " ")}</span><h2 className="mt-1 text-lg font-semibold">{inquiry.requesterName}</h2>
              <p className="mt-1 text-xs text-slate-500">{inquiry.listing.vehicle.make} {inquiry.listing.vehicle.model} {inquiry.listing.vehicle.year || ""} · {inquiry.listing.headline}</p>
            </div>
            <div className="text-right text-xs text-slate-600"><p>{inquiry.requesterEmail}</p><p className="mt-1">{date(inquiry.startAt)} – {date(inquiry.endAt)}</p><p className="mt-1">Original rate snapshot: {money(inquiry.dailyRateSnapshot, currency)} / day</p></div>
          </div>
          {latest ? <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold text-slate-900">Quote v{latest.version} · {latest.status}</p><p className="mt-1 text-xs text-slate-500">Valid until {date(latest.validUntil)}</p></div><div className="text-right"><p className="text-xs text-slate-500">Quoted total</p><p className="text-lg font-bold">{money(latest.totalAmount, latest.currency)}</p></div></div>
              <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2"><p>{latest.rentalDays} rental day(s) × {money(latest.dailyRate, latest.currency)} = {money(latest.baseAmount, latest.currency)}</p><p>Discount: −{money(latest.discountAmount, latest.currency)}</p>
                {(latest.addOns || []).map((item, index) => <p key={`addon-${index}`}>Add-on: {item.label} · {money(item.amount, latest.currency)}</p>)}
                {(latest.fees || []).map((item, index) => <p key={`fee-${index}`}>Fee: {item.label} · {money(item.amount, latest.currency)}</p>)}
              </div>
              {latest.status === "APPROVED" && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">Approved by staff on {date(latest.approvedAt || latest.createdAt)}. Agreement reviewed: {latest.agreementReference}. This is internal staff approval only, not renter acceptance.</p>}
              {latest.status === "DRAFT" && <form onSubmit={(event) => void approveQuote(event, latest)} className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">Review agreement and approve this quote</p>
                <label className="grid gap-1 text-xs font-medium text-slate-700">Applicable agreement reference / version
                  <input name="agreementReference" required maxLength={160} className="roam-input" placeholder="e.g. Renter Booking Terms v1.2 — 2026-11-22"/>
                </label>
                <label className="flex items-start gap-2 text-xs leading-5 text-slate-700"><input name="agreementReviewed" type="checkbox" required className="mt-0.5"/> I have reviewed the identified agreement version and confirmed it is the applicable document for this quote.</label>
                <button disabled={saving} className="justify-self-start rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? "Saving…" : "Record agreement review & approve"}</button>
              </form>}
              <button type="button" onClick={() => { void navigator.clipboard.writeText(quoteText(inquiry, latest)).then(() => setNotice("Quote draft copied. Review all details before sharing."), () => setError("Clipboard access was unavailable. Select and copy the quote text manually.")); }} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><ClipboardCopy size={14}/> Copy quote draft</button>
            </div>
            {inquiry.rentalQuotes.length > 1 && <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Earlier quote versions</p>
              <div className="mt-3 grid gap-2">{inquiry.rentalQuotes.slice(1).map((quote) => <div key={quote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <div><p className="text-xs font-semibold text-slate-800">Version {quote.version} · {quote.status}</p><p className="mt-1 text-xs text-slate-500">{money(quote.totalAmount, quote.currency)} · valid until {date(quote.validUntil)}</p></div>
                <button type="button" onClick={() => { void navigator.clipboard.writeText(quoteText(inquiry, quote)).then(() => setNotice("Earlier quote version copied."), () => setError("Clipboard access was unavailable. Select and copy the quote text manually.")); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Copy v{quote.version}</button>
              </div>)}</div>
            </div>}
          </div> : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">No quote has been prepared for this inquiry.</p>}
          {eligible ? <form onSubmit={(event) => void createQuote(event, inquiry)} className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
            <div><h3 className="text-sm font-semibold text-slate-900">{latest ? "Prepare a revised quote version" : "Prepare quote draft"}</h3><p className="mt-1 text-xs text-slate-500">Each save creates a new immutable version and supersedes earlier active versions. Amounts are in {currency}.</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-medium text-slate-700">Daily rate<input name="dailyRate" type="number" min="0" max="1000000" step="0.01" required defaultValue={inquiry.dailyRateSnapshot} className="roam-input"/></label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">Discount amount<input name="discountAmount" type="number" min="0" max="1000000" step="0.01" defaultValue="0" className="roam-input"/></label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">Quote valid until<input name="validUntil" type="date" min={new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Manila"}).format(new Date())} required defaultValue={defaultExpiry()} className="roam-input"/></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-slate-700">Add-ons (one per line: Description | Amount)
                <textarea name="addOns" rows={3} className="roam-input" placeholder={"Child seat | 250\nDelivery | 500"}/>
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">Fees (one per line: Description | Amount)
                <textarea name="fees" rows={3} className="roam-input" placeholder={"Cleaning fee | 300\nOther fee | 100"}/>
              </label>
            </div>
            <button disabled={saving} className="justify-self-start rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? "Saving…" : "Save new quote draft"}</button>
          </form> : <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Qualify this inquiry in Availability & inquiries before preparing a quote.</p>}
        </section>;
      })}</div> : <div className="roam-panel mt-5 p-8 text-center"><p className="text-sm text-slate-600">No renter inquiries are available for quote preparation.</p></div>}
    </main>
  </div>;
}
