"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarOff, RefreshCw, Inbox, Trash2 } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Block = { id: string; startAt: string; endAt: string; label: string | null };
type Listing = { id: string; headline: string; status: string; isPublished: boolean; vehicle: { make: string; model: string; year: number | null; dailyRate: number; status: string }; availabilityBlocks: Block[] };
type Inquiry = { id: string; listingId: string; requesterName: string; requesterEmail: string; requesterPhone: string | null; startAt: string; endAt: string; dailyRateSnapshot: number; message: string | null; status: string; hostNote: string | null; createdAt: string; listing: { headline: string; vehicle: { make: string; model: string } } };

const date = (value: string) => new Date(value).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium" });
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
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace/operations`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inquiry.id, status: statuses[inquiry.id] || inquiry.status, hostNote: notes[inquiry.id] ?? inquiry.hostNote ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update inquiry.");
      setStatuses((current) => { const next = { ...current }; delete next[inquiry.id]; return next; });
      setNotes((current) => { const next = { ...current }; delete next[inquiry.id]; return next; });
      setNotice("Inquiry updated."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update inquiry."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="roam-loading">Loading Marketplace operations…</main>;

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Marketplace" role={role} active="marketplace"/>
    <main className="roam-main">
      <header className="roam-topbar"><div><Link href={`/workspace/${slug}/marketplace`} className="roam-back-link"><ArrowLeft size={14}/> Host onboarding</Link><span className="roam-eyebrow">MARKETPLACE OPERATIONS</span><h1>Availability & renter inquiries</h1><p>Manage unavailable dates and respond to renter date enquiries. An inquiry is not a confirmed reservation.</p></div><div className="roam-topbar-actions"><button className="roam-secondary-btn" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div></header>
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
          <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2"><p>{item.requesterEmail}</p><p>{item.requesterPhone || "No phone provided"}</p><p>{date(item.startAt)} – {date(item.endAt)}</p><p>Rate when requested: ₱{item.dailyRateSnapshot.toLocaleString("en-PH")} / day</p></div>
          {item.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.message}</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><select className="roam-input" value={statuses[item.id] || item.status} onChange={e=>setStatuses({...statuses,[item.id]:e.target.value})}>{inquiryStatusOptions(item.status).map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select><input className="roam-input" maxLength={1500} placeholder="Internal note (optional)" value={notes[item.id] ?? item.hostNote ?? ""} onChange={e=>setNotes({...notes,[item.id]:e.target.value})}/><button disabled={saving} onClick={()=>void updateInquiry(item)} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Save</button></div>
        </article>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center"><Inbox className="mx-auto text-slate-400"/><p className="mt-2 text-sm text-slate-600">No renter inquiries yet.</p></div>}
      </section>
    </main>
  </div>;
}
