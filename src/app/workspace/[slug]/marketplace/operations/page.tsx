"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarOff, RefreshCw, Inbox, Trash2 } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Block = { id: string; startAt: string; endAt: string; label: string | null };
type Listing = { id: string; headline: string; status: string; isPublished: boolean; vehicle: { make: string; model: string; year: number | null; dailyRate: number; hourlyRate: number | null; weeklyRate: number | null; monthlyRate: number | null; status: string }; availabilityBlocks: Block[] };
type Inquiry = { id: string; listingId: string; requesterName: string; requesterEmail: string; requesterPhone: string | null; startAt: string; endAt: string; dailyRateSnapshot: number; rentalMode: string; rateUnit: string; ratePeriods: number; deliveryRequested: boolean; deliveryAddress: string | null; deliveryFeeSnapshot: number; includedKmPerDaySnapshot: number | null; excessMileageRateSnapshot: number; overtimeGraceMinutesSnapshot: number; overtimeHourlyRateSnapshot: number | null; message: string | null; status: string; hostNote: string | null; createdAt: string; contactConsentAt: string; consentVersion: string; listing: { headline: string; vehicle: { make: string; model: string } } };

const date = (value: string) => new Date(value).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
const statusLabel = (value: string) => value.replaceAll("_", " ");
const nextInquiryStatuses: Record<string, string[]> = {
  NEW: ["CONTACTED", "QUALIFIED", "DECLINED", "CLOSED"],
  CONTACTED: ["QUALIFIED", "DECLINED", "CLOSED"],
  QUALIFIED: ["CONTACTED", "READY_FOR_MANUAL_BOOKING", "DECLINED", "CLOSED"],
  READY_FOR_MANUAL_BOOKING: ["DECLINED", "CLOSED"],
  DECLINED: ["CLOSED"],
  CLOSED: [],
};
const inquiryStatusOptions = (status: string) => [status, ...(nextInquiryStatuses[status] || [])];
const nights = (startAt: string, endAt: string) => Math.max(1, Math.ceil((new Date(endAt).getTime() - new Date(startAt).getTime()) / 86400000));
const renterReplyDraft = (item: Inquiry, style: string) => {
  const period = `${date(item.startAt)} to ${date(item.endAt)}`;
  const greeting = `Hello ${item.requesterName},`;
  const vehicle = `${item.listing.vehicle.make} ${item.listing.vehicle.model} — ${item.listing.headline}`;
  const details = `Your requested rental period is ${period}. Your selected option was ${item.rentalMode === "WITH_DRIVER" ? "with driver" : "self-drive"}; the rate shown when you enquired was ₱${item.dailyRateSnapshot.toLocaleString("en-PH")} per ${item.rateUnit.toLowerCase()} (${item.ratePeriods} unit(s)).${item.deliveryRequested ? ` Delivery requested to: ${item.deliveryAddress || "address to be confirmed"}.` : ""}`;
  const closing = "This is an enquiry only, not a reservation or booking confirmation. Availability, final pricing, any deposits or additional charges, pickup arrangements, and rental terms must be confirmed by our team before a booking can be made.";
  if (style === "FOLLOW_UP") return [greeting, "", `Thank you for your interest in ${vehicle}. ${details}`, "", "Could you please confirm your preferred pickup location and approximate pickup time? We will check the dates and get back to you with the applicable terms and final price.", "", closing].join("\n");
  if (style === "UNAVAILABLE") return [greeting, "", `Thank you for enquiring about ${vehicle} for ${period}. Unfortunately, we are unable to accommodate those dates.`, "", "If your plans are flexible, please share an alternative date range and we can check again.", "", closing].join("\n");
  return [greeting, "", `Thank you for your enquiry about ${vehicle}. ${details}`, "", "We are checking the requested dates and will confirm availability, final pricing, pickup arrangements, and applicable rental terms with you before any reservation is accepted.", "", closing].join("\n");
};
const handoffSummary = (item: Inquiry) => [
  "ROAM MARKETPLACE — MANUAL BOOKING HANDOFF",
  `Inquiry ID: ${item.id}`,
  `Listing: ${item.listing.vehicle.make} ${item.listing.vehicle.model} — ${item.listing.headline}`,
  `Renter: ${item.requesterName}`,
  `Email: ${item.requesterEmail}`,
  `Phone: ${item.requesterPhone || "Not provided"}`,
  `Requested rental period: ${date(item.startAt)} to ${date(item.endAt)}`,
  `Rate snapshot: PHP ${item.dailyRateSnapshot.toFixed(2)} per ${item.rateUnit.toLowerCase()} × ${item.ratePeriods} unit(s)`,
  `Rental option: ${item.rentalMode === "WITH_DRIVER" ? "With driver" : "Self-drive"} · Rate unit: ${item.rateUnit} · Rate periods: ${item.ratePeriods}`,
  `Delivery requested: ${item.deliveryRequested ? `Yes · ${item.deliveryAddress || "address pending"} · PHP ${item.deliveryFeeSnapshot.toFixed(2)}` : "No"}`,
  `Mileage allowance: ${item.includedKmPerDaySnapshot === null ? "Not set" : item.includedKmPerDaySnapshot + " km/day"} · Excess mileage PHP ${item.excessMileageRateSnapshot.toFixed(2)}/km`,
  `Overtime: ${item.overtimeGraceMinutesSnapshot}-minute grace · ${item.overtimeHourlyRateSnapshot === null ? "Rate to confirm" : "PHP " + item.overtimeHourlyRateSnapshot.toFixed(2) + "/hour"}`,
  `Rate snapshot is not a final quote.`,
  `Contact consent: recorded ${new Date(item.contactConsentAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} · ${item.consentVersion}`,
  `Renter message: ${item.message || "None"}`,
  `Workflow status: ${statusLabel(item.status)}`,
  "NEXT: Verify availability, vehicle condition, final price/fees, pickup arrangements, renter requirements and applicable terms. Only then use the existing workspace booking process.",
  "This handoff does not create a booking, hold dates, allocate a vehicle, or collect payment.",
].join("\n");


export default function MarketplaceOperationsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [listings, setListings] = useState<Listing[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiriesEnabled, setInquiriesEnabled] = useState(false);
  const [role, setRole] = useState("STAFF");
  const [listingId, setListingId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [replyStyles, setReplyStyles] = useState<Record<string, string>>({});
  const [handoffChecks, setHandoffChecks] = useState<Record<string, Record<string, boolean>>>({});
  const checklist = [
    ["availabilityRechecked", "Availability and date conflicts rechecked"],
    ["finalPriceAndFeesReviewed", "Final price, deposits and fees reviewed"],
    ["pickupAndReturnConfirmed", "Pickup and return logistics confirmed"],
    ["renterRequirementsReviewed", "Renter requirements reviewed"],
    ["rentalTermsReviewed", "Applicable rental terms reviewed"],
  ] as const;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace/operations`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load Marketplace operations.");
      setListings(data.listings || []); setInquiries(data.inquiries || []);
      setInquiriesEnabled(data.inquiriesEnabled === true); setRole(data.role || "STAFF");
      setListingId((current) => current || data.listings?.[0]?.id || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Marketplace operations.");
    } finally { setLoading(false); }
  }, [slug]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load the Host operations dashboard on entry.
  useEffect(() => { void load(); }, [load]);

  async function addBlock(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace/operations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, startDate, endDate, label }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to block these dates.");
      setStartDate(""); setEndDate(""); setLabel(""); setNotice("Availability block saved.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save availability block."); }
    finally { setSaving(false); }
  }

  async function deleteBlock(id: string) {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace/operations`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "DELETE_BLOCK", id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to remove availability block.");
      setNotice("Availability block removed."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to remove availability block."); }
    finally { setSaving(false); }
  }

  async function updateInquiry(inquiry: Inquiry) {
    const nextStatus = statuses[inquiry.id] || inquiry.status;
    const checks = handoffChecks[inquiry.id] || {};
    if (nextStatus === "READY_FOR_MANUAL_BOOKING" && inquiry.status !== "READY_FOR_MANUAL_BOOKING" && checklist.some(([key]) => checks[key] !== true)) {
      setError("Complete all five pre-handoff checks before marking this inquiry ready.");
      return;
    }
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace/operations`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inquiry.id, status: nextStatus, hostNote: notes[inquiry.id] ?? inquiry.hostNote ?? "", ...(nextStatus === "READY_FOR_MANUAL_BOOKING" ? { handoffChecks: checks } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update inquiry.");
      setStatuses((current) => { const next = { ...current }; delete next[inquiry.id]; return next; });
      setNotes((current) => { const next = { ...current }; delete next[inquiry.id]; return next; });
      setHandoffChecks((current) => { const next = { ...current }; delete next[inquiry.id]; return next; });
      setNotice("Inquiry updated."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update inquiry."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="roam-loading">Loading Marketplace operations…</main>;

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Marketplace" role={role} active="marketplace"/>
    <main className="roam-main">
      <header className="roam-topbar"><div><Link href={`/workspace/${slug}/marketplace`} className="roam-back-link"><ArrowLeft size={14}/> Host onboarding</Link><span className="roam-eyebrow">MARKETPLACE OPERATIONS</span><h1>Availability & renter inquiries</h1><p>Manage unavailable dates and respond to renter date enquiries. An inquiry is not a confirmed reservation.</p></div><div className="roam-topbar-actions"><Link href={`/workspace/${slug}/marketplace/quotes`} className="roam-secondary-btn">Quotes & agreement review</Link><button className="roam-secondary-btn" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div></header>
      {error && <p className="client-alert mt-4" role="alert">{error}</p>}
      {notice && <p className="client-success-inline mt-4" role="status">{notice}</p>}
      <section className="roam-panel mt-5" style={{borderColor:"#d97706",background:"#fffbeb"}}><div className="flex items-start gap-3"><CalendarOff className="mt-1 shrink-0 text-amber-700"/><div><h2 className="font-semibold text-amber-950">Development workflow — no reservations or payments</h2><p className="mt-1 text-sm leading-6 text-amber-900">Availability blocks help prevent enquiries for dates you cannot serve. Renter inquiries are held behind a separate production feature switch and are not active until ROAM completes privacy, contract and operational readiness. Hosts can prepare availability now; no booking is created by an inquiry.</p><p className="mt-2 text-xs font-semibold text-amber-900">Renter inquiries: {inquiriesEnabled ? "enabled" : "disabled"}</p></div></div></section>
      <section className="roam-panel mt-5">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">HOST CALENDAR</span><h2>Block unavailable dates</h2><p className="roam-guide-description">Blocks apply to a whole day, including the selected end date. Existing bookings and maintenance periods are protected.</p></div></div>
        <form onSubmit={addBlock} className="mt-4 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto]">
          <label className="grid gap-1 text-xs font-medium text-slate-700">Vehicle listing<select required className="roam-input" value={listingId} onChange={e=>setListingId(e.target.value)}><option value="">Select listing</option>{listings.map(item=><option key={item.id} value={item.id}>{item.vehicle.make} {item.vehicle.model} · {item.headline}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">Start date<input required type="date" min={new Date().toLocaleDateString("en-CA")} className="roam-input" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">End date<input required type="date" min={startDate || new Date().toLocaleDateString("en-CA")} className="roam-input" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">Reason (optional)<input maxLength={100} className="roam-input" value={label} onChange={e=>setLabel(e.target.value)} placeholder="Personal use, service…"/></label>
          <button disabled={saving || !listings.length} className="self-end rounded-lg bg-slate-950 px-4 py-3 text-xs font-bold text-white disabled:opacity-40">{saving ? "Saving…" : "Block dates"}</button>
        </form>
        <div className="mt-5 grid gap-3">{listings.map(listing=><article key={listing.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-slate-900">{listing.vehicle.make} {listing.vehicle.model} {listing.vehicle.year || ""}</div><span className="text-[10px] font-semibold text-slate-500">{listing.availabilityBlocks.length} future blocks</span></div>
          {listing.availabilityBlocks.length ? <div className="mt-3 grid gap-2">{listing.availabilityBlocks.map(block=><div key={block.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="text-slate-700">{date(block.startAt)} – {date(new Date(new Date(block.endAt).getTime()-86400000).toISOString())}{block.label ? ` · ${block.label}` : ""}</span><button disabled={saving} onClick={()=>void deleteBlock(block.id)} className="inline-flex items-center gap-1 font-semibold text-rose-700"><Trash2 size={13}/> Remove</button></div>)}</div> : <p className="mt-2 text-xs text-slate-500">No unavailable dates recorded.</p>}</article>)}</div>
      </section>
      <section className="roam-panel mt-5">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">RENTER INBOX</span><h2>Rental inquiries</h2><p className="roam-guide-description">Qualify the request and prepare a controlled handoff to your existing booking workflow. No booking is created here.</p></div><span className="roam-panel-total">{inquiries.length} inquiries</span></div>
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">Workflow: New → Contacted → Qualified → Ready for manual booking. “Ready for manual booking” is only an internal handoff marker; staff must separately review terms and create any booking through the existing workspace booking process. This action never creates a booking, reserves a vehicle, changes vehicle status, contacts the renter, or collects payment.</p>
        {!inquiriesEnabled && <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">The public inquiry form is disabled in production. This inbox is ready for the later launch-readiness step.</p>}
        {inquiries.length ? <div className="mt-4 grid gap-3">{inquiries.map(item=><article key={item.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{item.requesterName}</p><p className="mt-1 text-xs text-slate-500">{item.listing.vehicle.make} {item.listing.vehicle.model} · {item.listing.headline}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{statusLabel(item.status)}</span></div>
          <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2"><p>{item.requesterEmail}</p><p>{item.requesterPhone || "No phone provided"}</p><p>{date(item.startAt)} – {date(item.endAt)}</p><p>Rate when requested: ₱{item.dailyRateSnapshot.toLocaleString("en-PH")} / {item.rateUnit.toLowerCase()} × {item.ratePeriods}</p>{item.deliveryRequested && <p>Delivery requested: {item.deliveryAddress || "Address pending"} · ₱{item.deliveryFeeSnapshot.toLocaleString("en-PH")}</p>}{item.includedKmPerDaySnapshot !== null && <p>Mileage: {item.includedKmPerDaySnapshot} km/day included · ₱{item.excessMileageRateSnapshot}/excess km</p>}{item.overtimeHourlyRateSnapshot !== null && <p>Overtime: {item.overtimeGraceMinutesSnapshot}-minute grace · ₱{item.overtimeHourlyRateSnapshot}/hour</p>}</div>
          {item.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.message}</p>}
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-slate-900">Structured manual handoff</p><p className="mt-1 text-xs text-slate-600">Contact permission recorded {date(item.contactConsentAt)} · {item.consentVersion}</p></div><button type="button" onClick={() => { void navigator.clipboard.writeText(handoffSummary(item)).then(() => setNotice("Handoff summary copied."), () => setError("Clipboard access was unavailable. Select and copy the details manually.")); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Copy handoff summary</button></div>
            <p className="mt-2 text-xs leading-5 text-slate-600">Use this summary when transferring the qualified request to your existing booking process. The rate is a historical snapshot, not a final quote.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2"><label className="text-xs font-medium text-slate-700" htmlFor={`reply-style-${item.id}`}>Renter reply draft</label><select id={`reply-style-${item.id}`} className="roam-input max-w-xs" value={replyStyles[item.id] || "CHECKING"} onChange={e=>setReplyStyles({...replyStyles,[item.id]:e.target.value})}><option value="CHECKING">Checking availability</option><option value="FOLLOW_UP">Ask for details</option><option value="UNAVAILABLE">Dates unavailable</option></select><button type="button" onClick={() => { void navigator.clipboard.writeText(renterReplyDraft(item, replyStyles[item.id] || "CHECKING")).then(() => setNotice("Renter response draft copied. Review it before sending."), () => setError("Clipboard access was unavailable. Select and copy the draft manually.")); }} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Copy response draft</button></div>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">{renterReplyDraft(item, replyStyles[item.id] || "CHECKING")}</pre>
            <p className="mt-2 text-[11px] leading-5 text-amber-800">Draft only — ROAM does not send this message. Manually verify live availability, final price, fees, pickup details and current rental terms before sending. No reservation or payment is created here.</p>
          </div>
          {(statuses[item.id] || item.status) === "READY_FOR_MANUAL_BOOKING" && item.status !== "READY_FOR_MANUAL_BOOKING" && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-950">Manual booking readiness checks</p>
            <p className="mt-1 text-xs leading-5 text-amber-900">Confirm each item after checking your current operational records. Completion is recorded in the workspace audit trail; it does not create a reservation.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{checklist.map(([key, label]) => <label key={key} className="flex items-start gap-2 text-xs text-amber-950"><input type="checkbox" checked={handoffChecks[item.id]?.[key] === true} onChange={e=>setHandoffChecks(current=>({...current,[item.id]:{...(current[item.id]||{}),[key]:e.target.checked}}))} className="mt-0.5"/> <span>{label}</span></label>)}</div>
          </div>}
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><select className="roam-input" value={statuses[item.id] || item.status} onChange={e=>setStatuses({...statuses,[item.id]:e.target.value})}>{inquiryStatusOptions(item.status).map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select><input className="roam-input" maxLength={1500} placeholder="Internal note (optional)" value={notes[item.id] ?? item.hostNote ?? ""} onChange={e=>setNotes({...notes,[item.id]:e.target.value})}/><button disabled={saving} onClick={()=>void updateInquiry(item)} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Save</button></div>
        </article>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center"><Inbox className="mx-auto text-slate-400"/><p className="mt-2 text-sm text-slate-600">No renter inquiries yet.</p></div>}
      </section>
    </main>
  </div>;
}
