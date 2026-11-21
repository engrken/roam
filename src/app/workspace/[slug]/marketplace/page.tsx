"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardCheck, Plus, RefreshCw, Store } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type HostStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "NEEDS_INFORMATION" | "PREQUALIFIED" | "DECLINED" | "SUSPENDED";
type ListingStatus = HostStatus;
type HostForm = { providerType: "INDIVIDUAL" | "BUSINESS"; displayName: string; description: string; email: string; phone: string; city: string; province: string };
type HostNotification = { id: string; targetType: "HOST_PROFILE" | "LISTING"; status: string; title: string; message: string; createdAt: string };
type Vehicle = { id: string; type: string; make: string; model: string; year: number | null; dailyRate: number; branchName: string };
type Listing = { id: string; headline: string; description: string | null; status: ListingStatus; submittedAt: string | null; hostMessage: string | null; vehicle: Vehicle & { color: string | null; status: string } };
const initialHostForm: HostForm = { providerType: "BUSINESS", displayName: "", description: "", email: "", phone: "", city: "", province: "" };
const statusText = (status: string) => status.replaceAll("_", " ");
const canEditListing = (status: string) => ["DRAFT", "NEEDS_INFORMATION", "DECLINED"].includes(status);
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

export default function WorkspaceMarketplacePage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<(HostForm & { id: string; status: HostStatus; hostMessage: string | null; submittedAt: string | null; listings: Listing[] }) | null>(null);
  const [form, setForm] = useState<HostForm>(initialHostForm);
  const [eligibleVehicles, setEligibleVehicles] = useState<Vehicle[]>([]);
  const [notifications, setNotifications] = useState<HostNotification[]>([]);
  const [role, setRole] = useState("STAFF");
  const [listingVehicleId, setListingVehicleId] = useState("");
  const [listingHeadline, setListingHeadline] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load marketplace workspace.");
      setRole(data.role || "STAFF");
      setEligibleVehicles(data.eligibleVehicles || []);
      setNotifications(data.notifications || []);
      if (data.profile) {
        const saved = data.profile;
        setProfile(saved);
        setForm({
          providerType: saved.providerType === "INDIVIDUAL" ? "INDIVIDUAL" : "BUSINESS",
          displayName: saved.displayName || "", description: saved.description || "",
          email: saved.email || "", phone: saved.phone || "", city: saved.city || "", province: saved.province || "",
        });
      } else {
        setProfile(null);
        setForm({
          ...initialHostForm,
          displayName: data.workspace?.name || "",
          email: data.workspace?.email || "",
          phone: data.workspace?.phone || "",
        });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load marketplace workspace.");
    } finally { setLoading(false); }
  }, [slug]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load the workspace Host dashboard on entry.
  useEffect(() => { void load(); }, [load]);

  const profileEditable = role === "OWNER" || role === "ADMIN";
  const listingEditable = ["OWNER", "ADMIN", "MANAGER"].includes(role);

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Host profile.");
      setNotice("Host profile saved as a draft.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save Host profile.");
    } finally { setSaving(false); }
  }

  async function submitProfile() {
    setSubmitting(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SUBMIT_PROFILE" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit Host profile.");
      setNotice("Host profile submitted for preliminary review.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit Host profile.");
    } finally { setSubmitting(false); }
  }

  function resetListingForm() {
    setEditingListingId(null); setListingVehicleId(""); setListingHeadline(""); setListingDescription("");
  }

  async function saveListing(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const url = `/api/workspaces/${encodeURIComponent(slug)}/marketplace/listings`;
      const response = await fetch(url, {
        method: editingListingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingListingId
          ? { id: editingListingId, headline: listingHeadline, description: listingDescription }
          : { vehicleId: listingVehicleId, headline: listingHeadline, description: listingDescription }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save vehicle listing.");
      setNotice(editingListingId ? "Vehicle listing draft updated." : "Vehicle listing draft created.");
      resetListingForm();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save vehicle listing.");
    } finally { setSaving(false); }
  }

  async function submitListing(id: string) {
    setSubmitting(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/marketplace/listings`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SUBMIT_LISTING", id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit vehicle listing.");
      setNotice("Vehicle listing submitted for preliminary review.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit vehicle listing.");
    } finally { setSubmitting(false); }
  }

  function editListing(listing: Listing) {
    setEditingListingId(listing.id); setListingHeadline(listing.headline); setListingDescription(listing.description || "");
    document.getElementById("marketplace-listing-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const profileStatus = profile?.status || "DRAFT";
  const canSubmitProfile = !!profile && ["DRAFT", "NEEDS_INFORMATION", "DECLINED"].includes(profile.status);
  const canCreateListing = !!profile && profile.status !== "SUSPENDED" && profile.status !== "DECLINED";

  if (loading) return <main className="roam-loading">Loading Marketplace workspace…</main>;

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Marketplace" role={role} active="marketplace"/>
    <main className="roam-main">
      <header className="roam-topbar">
        <div><Link href={`/workspace/${slug}`} className="roam-back-link"><ArrowLeft size={14}/> Overview</Link><span className="roam-eyebrow">MARKETPLACE · PRE-LAUNCH</span><h1>Host onboarding</h1><p>Prepare your Host profile and private vehicle listing drafts for preliminary review.</p></div>
        <div className="roam-topbar-actions"><Link className="roam-secondary-btn" href={`/workspace/${slug}/marketplace/operations`}><CalendarDays size={15}/> Availability & inquiries</Link><button className="roam-secondary-btn" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div>
      </header>

      <section className="roam-panel" style={{ borderColor: "#d97706", background: "#fffbeb" }}>
        <div className="flex items-start gap-3">
          <Store size={20} className="mt-1 shrink-0 text-amber-700"/>
          <div><h2 className="font-semibold text-amber-950">Development and review only — not a live listing</h2><p className="mt-1 text-sm leading-6 text-amber-900">Your Host profile and vehicle drafts are visible only to your workspace and authorized ROAM administrators. They are not shown to renters, do not accept bookings, and do not collect payments. This step does not verify your identity, vehicle ownership, registration, insurance or legal authority. No government ID or vehicle documents are requested here.</p></div>
        </div>
      </section>

      {error && <p className="client-alert mt-4" role="alert">{error}</p>}
      {notice && <p className="client-success-inline mt-4" role="status">{notice}</p>}

      <section className="roam-panel mt-5">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">HOST UPDATES</span><h2>Review messages</h2><p className="roam-guide-description">Status changes and messages from the ROAM review team appear here.</p></div><span className="roam-panel-total">{notifications.length} updates</span></div>
        {notifications.length ? <div className="mt-4 grid gap-3">{notifications.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold text-slate-900">{item.title}</div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-slate-600">{statusText(item.status)}</span></div>
          <p className="mt-1 text-[11px] text-slate-500">{item.targetType === "HOST_PROFILE" ? "Host profile" : "Vehicle listing"} · {new Date(item.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.message}</p>
        </article>)}</div> : <p className="mt-4 rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">No review updates yet. ROAM will post feedback here when your Host profile or vehicle submissions are reviewed.</p>}
      </section>

      <section className="roam-panel mt-5">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">HOST PROFILE</span><h2>Provider information</h2><p className="roam-guide-description">Use the contact details you want ROAM to use for onboarding communications.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{statusText(profileStatus)}</span></div>
        {profile?.hostMessage && <p className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">{profile.hostMessage}</p>}
        <form onSubmit={saveProfile} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Provider type<select className="roam-input" disabled={!profileEditable} value={form.providerType} onChange={(event) => setForm({ ...form, providerType: event.target.value as HostForm["providerType"] })}><option value="INDIVIDUAL">Individual vehicle owner</option><option value="BUSINESS">Rental business</option></select></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Public-facing display name<input className="roam-input" required minLength={2} maxLength={120} disabled={!profileEditable} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })}/></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Contact email<input className="roam-input" required type="email" maxLength={254} disabled={!profileEditable} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Contact phone<input className="roam-input" type="tel" maxLength={40} disabled={!profileEditable} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">City<input className="roam-input" required minLength={2} maxLength={100} disabled={!profileEditable} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="e.g. Cebu City"/></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Province<input className="roam-input" maxLength={100} disabled={!profileEditable} value={form.province} onChange={(event) => setForm({ ...form, province: event.target.value })} placeholder="e.g. Cebu"/></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">About the Host<textarea className="roam-input min-h-24" maxLength={1500} disabled={!profileEditable} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Tell renters and the ROAM review team about your rental operation."/></label>
          {profileEditable && <div className="flex flex-wrap items-center gap-3 md:col-span-2"><button className="roam-primary-btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Save Host profile"}</button>{canSubmitProfile && <button className="roam-secondary-btn" type="button" disabled={submitting || saving || !profile} onClick={() => void submitProfile()}><ClipboardCheck size={15}/>{submitting ? "Submitting…" : "Submit for preliminary review"}</button>}</div>}
          {!profileEditable && <p className="text-sm text-slate-500 md:col-span-2">Only workspace owners and administrators can edit the Host profile.</p>}
        </form>
      </section>

      <section className="roam-panel mt-5">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">VEHICLE LISTING DRAFTS</span><h2>Prepare a vehicle listing</h2><p className="roam-guide-description">Select an existing available fleet vehicle and add the public-facing listing text.</p></div><span className="roam-panel-total">{profile?.listings.length || 0} drafts</span></div>
        {!profile ? <p className="mt-4 text-sm text-slate-500">Save your Host profile before preparing vehicle listing drafts.</p>
        : !canCreateListing ? <p className="mt-4 text-sm text-slate-500">Your Host profile is declined or suspended. Contact ROAM support for assistance.</p>
        : !listingEditable ? <p className="mt-4 text-sm text-slate-500">Only workspace owners, administrators and managers can prepare vehicle listing drafts.</p>
        : <form id="marketplace-listing-form" onSubmit={saveListing} className="mt-5 grid gap-4 md:grid-cols-2">
          {!editingListingId && <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">Available fleet vehicle<select className="roam-input" required value={listingVehicleId} onChange={(event) => setListingVehicleId(event.target.value)}><option value="">Choose a vehicle</option>{eligibleVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} {vehicle.year || ""} · {vehicle.type.replaceAll("_", " ")} · {money(vehicle.dailyRate)}/day · {vehicle.branchName}</option>)}</select>{eligibleVehicles.length === 0 && <small className="font-normal text-slate-500">No unlisted, available vehicles found. Add a vehicle or check its fleet status first.</small>}</label>}
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">Listing headline<input className="roam-input" required minLength={5} maxLength={120} value={listingHeadline} onChange={(event) => setListingHeadline(event.target.value)} placeholder="e.g. Comfortable sedan for city trips"/></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">Vehicle description<textarea className="roam-input min-h-24" maxLength={2000} value={listingDescription} onChange={(event) => setListingDescription(event.target.value)} placeholder="Describe the vehicle and its practical features."/></label>
          <div className="flex flex-wrap gap-3 md:col-span-2"><button className="roam-primary-btn" type="submit" disabled={saving || (!editingListingId && !eligibleVehicles.length)}><Plus size={15}/>{saving ? "Saving…" : editingListingId ? "Save listing draft" : "Create listing draft"}</button>{editingListingId && <button type="button" className="roam-secondary-btn" onClick={resetListingForm}>Cancel edit</button>}</div>
        </form>}
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {(profile?.listings || []).map((listing) => <article key={listing.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{listing.vehicle.make} {listing.vehicle.model} {listing.vehicle.year || ""}</h3><p className="mt-1 text-xs text-slate-500">{listing.vehicle.type.replaceAll("_", " ")} · {listing.vehicle.branchName} · {money(listing.vehicle.dailyRate)}/day</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{statusText(listing.status)}</span></div>
            <h4 className="mt-4 text-sm font-semibold text-slate-900">{listing.headline}</h4>{listing.description && <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-600">{listing.description}</p>}
            {listing.hostMessage && <p className="mt-3 rounded-lg bg-sky-100 p-3 text-xs leading-5 text-sky-900">{listing.hostMessage}</p>}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              {listingEditable && canEditListing(listing.status) && <button type="button" className="roam-secondary-btn" onClick={() => editListing(listing)}>Edit draft</button>}
              {listingEditable && canEditListing(listing.status) && canCreateListing && <button type="button" className="roam-primary-btn" disabled={submitting || saving || !["SUBMITTED", "IN_REVIEW", "NEEDS_INFORMATION", "PREQUALIFIED"].includes(profileStatus)} onClick={() => void submitListing(listing.id)}><CheckCircle2 size={14}/>{submitting ? "Submitting…" : "Submit for review"}</button>}
            </div>
          </article>)}
          {profile && profile.listings.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500 lg:col-span-2">No vehicle listing drafts yet. Start by selecting a vehicle from your available fleet.</p>}
        </div>
      </section>
    </main>
  </div>;
}
