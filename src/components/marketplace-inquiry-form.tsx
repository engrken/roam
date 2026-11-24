"use client";

import { useState, type FormEvent } from "react";

export function MarketplaceInquiryForm({ listingId, selfDriveEnabled, withDriverEnabled }: { listingId: string; selfDriveEnabled: boolean; withDriverEnabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({ requesterName: "", requesterEmail: "", requesterPhone: "", startDate: "", endDate: "", rentalMode: selfDriveEnabled ? "SELF_DRIVE" : "WITH_DRIVER", message: "", contactConsent: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/marketplace/${encodeURIComponent(listingId)}/inquiries`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send inquiry.");
      setSuccess(data.message || "Inquiry sent to the Host.");
      setForm({ requesterName: "", requesterEmail: "", requesterPhone: "", startDate: "", endDate: "", rentalMode: selfDriveEnabled ? "SELF_DRIVE" : "WITH_DRIVER", message: "", contactConsent: false });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send inquiry.");
    } finally { setBusy(false); }
  }

  const minReturnDate = form.startDate ? new Date(new Date(`${form.startDate}T00:00:00`).getTime() + 86_400_000).toLocaleDateString("en-CA") : new Date().toLocaleDateString("en-CA");

  return <form onSubmit={submit} className="mt-6 space-y-3 border-t border-slate-100 pt-5">
    <h3 className="font-semibold text-slate-900">Ask the Host about these dates</h3>
    <p className="text-xs leading-5 text-slate-500">This sends a rental inquiry only. It does not reserve the vehicle or create a booking.</p>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
    {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{success}</p>}
    <label className="block text-xs font-medium text-slate-700">Your name<input required minLength={2} maxLength={120} autoComplete="name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.requesterName} onChange={e=>setForm({...form,requesterName:e.target.value})}/></label>
    <label className="block text-xs font-medium text-slate-700">Email<input required type="email" maxLength={254} autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.requesterEmail} onChange={e=>setForm({...form,requesterEmail:e.target.value})}/></label>
    <label className="block text-xs font-medium text-slate-700">Phone (optional)<input type="tel" maxLength={40} autoComplete="tel" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.requesterPhone} onChange={e=>setForm({...form,requesterPhone:e.target.value})}/></label>
    <label className="block text-xs font-medium text-slate-700">Rental option<select required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.rentalMode} onChange={e=>setForm({...form,rentalMode:e.target.value})}>{selfDriveEnabled && <option value="SELF_DRIVE">Self-drive</option>}{withDriverEnabled && <option value="WITH_DRIVER">With driver</option>}</select></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs font-medium text-slate-700">Pickup date<input required type="date" min={new Date().toLocaleDateString("en-CA")} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 px-2 py-2.5 text-sm" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></label>
      <label className="block text-xs font-medium text-slate-700">Return date<input required type="date" min={minReturnDate} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 px-2 py-2.5 text-sm" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label>
    </div>
    <label className="block text-xs font-medium text-slate-700">Message (optional)<textarea maxLength={1500} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Any questions for the Host?"/></label>
    <label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input required type="checkbox" checked={form.contactConsent} onChange={e=>setForm({...form,contactConsent:e.target.checked})} className="mt-0.5"/><span>I agree that ROAM may share these contact details and dates with this vehicle&apos;s Host so they can respond to my inquiry.</span></label>
    <button disabled={busy} className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Sending…" : "Send rental inquiry"}</button>
  </form>;
}
