"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CarFront, RefreshCw, Search, Store, ClipboardCheck, Building2 } from "lucide-react";

type ReviewStatus = "IN_REVIEW" | "NEEDS_INFORMATION" | "PREQUALIFIED" | "DECLINED" | "SUSPENDED";
type HostStatus = "DRAFT" | "SUBMITTED" | ReviewStatus;
type ListingStatus = "DRAFT" | "SUBMITTED" | ReviewStatus;
type Listing = {
  id: string; headline: string; description: string | null; status: ListingStatus; isPublished: boolean;
  submittedAt: string | null; reviewedAt: string | null; internalNotes: string | null; hostMessage: string | null;
  vehicle: { id: string; type: string; make: string; model: string; year: number | null; dailyRate: number; status: string; branchName: string };
};
type HostNotification = { id: string; targetType: string; targetId: string; status: string; title: string; message: string; emailStatus: "PENDING" | "SENDING" | "SENT" | "FAILED"; emailError: string | null; emailSentAt: string | null; createdAt: string };
type ListingDraft = { status: ReviewStatus; hostMessage: string };
type Profile = {
  id: string; tenantId: string; providerType: string; displayName: string; description: string | null;
  email: string; phone: string | null; city: string; province: string | null; status: HostStatus;
  submittedAt: string | null; reviewedAt: string | null; internalNotes: string | null; hostMessage: string | null;
  createdAt: string;
  tenant: { id: string; name: string; slug: string; email: string; phone: string | null; owner: { name: string | null; email: string } | null };
  listings: Listing[];
  notifications: HostNotification[];
};
type ReviewDraft = { status: ReviewStatus; internalNotes: string; hostMessage: string };
const reviewStatuses: ReviewStatus[] = ["IN_REVIEW", "NEEDS_INFORMATION", "PREQUALIFIED", "DECLINED", "SUSPENDED"];
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "Not submitted";
const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

export default function MarketplaceHostsAdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [publicationEnabled, setPublicationEnabled] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [listingDrafts, setListingDrafts] = useState<Record<string, ListingDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/marketplace-hosts", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load Host applications.");
      const items: Profile[] = data.profiles || [];
      setPublicationEnabled(data.publicationEnabled === true);
      setProfiles(items);
      setDrafts(Object.fromEntries(items.map((profile) => [profile.id, {
        status: reviewStatuses.includes(profile.status as ReviewStatus) ? profile.status as ReviewStatus : "IN_REVIEW",
        internalNotes: profile.internalNotes || "",
        hostMessage: profile.hostMessage || "",
      }])));
      setListingDrafts(Object.fromEntries(items.flatMap((profile) => profile.listings.map((listing) => [listing.id, {
        status: reviewStatuses.includes(listing.status as ReviewStatus) ? listing.status as ReviewStatus : "IN_REVIEW",
        hostMessage: listing.hostMessage || "",
      }]))));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Host applications.");
    } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the protected Host review queue on entry.
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return profiles.filter((profile) =>
      (filter === "ALL" || profile.status === filter)
      && (!needle || [profile.displayName, profile.email, profile.city, profile.province || "", profile.tenant.name, profile.tenant.slug, profile.tenant.owner?.email || ""].some((value) => value.toLowerCase().includes(needle))),
    );
  }, [profiles, query, filter]);

  const totals = useMemo(() => ({
    submitted: profiles.filter((profile) => ["SUBMITTED", "IN_REVIEW"].includes(profile.status)).length,
    prequalified: profiles.filter((profile) => profile.status === "PREQUALIFIED").length,
    listings: profiles.reduce((sum, profile) => sum + profile.listings.length, 0),
  }), [profiles]);

  async function saveReview(profile: Profile) {
    const draft = drafts[profile.id];
    if (!draft) return;
    setSaving(profile.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/marketplace-hosts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "HOST_PROFILE", id: profile.id, ...draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Host review.");
      setNotice("Host review saved.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save Host review.");
    } finally { setSaving(""); }
  }

  async function reviewListing(profile: Profile, listing: Listing) {
    const draft = listingDrafts[listing.id];
    if (!draft) return;
    if (draft.status === "NEEDS_INFORMATION" && !draft.hostMessage.trim()) {
      setError("Add a clear message describing what the Host needs to provide.");
      return;
    }
    setSaving(listing.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/marketplace-hosts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "LISTING", id: listing.id, status: draft.status, hostMessage: draft.hostMessage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update listing review.");
      setProfiles((items) => items.map((item) => item.id === profile.id
        ? { ...item, listings: item.listings.map((entry) => entry.id === listing.id ? { ...entry, status: data.record.status, hostMessage: draft.hostMessage } : entry) }
        : item));
      setNotice(data.notification?.emailStatus === "SENT" ? "Vehicle listing review updated and Host email sent." : data.notification ? "Vehicle listing review updated. Email delivery needs attention." : "Vehicle listing review updated.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update listing review.");
    } finally { setSaving(""); }
  }

  async function togglePublication(listing: Listing) {
    const action = listing.isPublished ? "UNPUBLISH_LISTING" : "PUBLISH_LISTING";
    setSaving(listing.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/marketplace-hosts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: listing.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update listing publication.");
      setNotice(data.listing?.isPublished ? "Listing published in the public catalog." : "Listing removed from the public catalog.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update listing publication.");
    } finally { setSaving(""); }
  }

  async function retryNotification(notification: HostNotification) {
    setSaving(notification.id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/marketplace-hosts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RETRY_NOTIFICATION", id: notification.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to retry Host email.");
      setNotice(data.notification?.emailStatus === "SENT" ? "Host update email sent." : "Host update email could not be delivered. Check SMTP configuration.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to retry Host email.");
    } finally { setSaving(""); }
  }

  function updateDraft(id: string, key: keyof ReviewDraft, value: string) {
    setDrafts((items) => ({ ...items, [id]: { ...items[id], [key]: value } }));
  }

  function updateListingDraft(id: string, key: keyof ListingDraft, value: string) {
    setListingDrafts((items) => ({ ...items, [id]: { ...items[id], [key]: value } }));
  }

  return <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-7">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-6">
        <div>
          <div className="flex flex-wrap gap-4">
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft size={15}/> Platform console</Link>
            <Link href="/admin/marketplace-leads" className="text-sm text-slate-400 hover:text-white">Marketplace leads</Link>
            <Link href="/admin/audit-logs" className="text-sm text-slate-400 hover:text-white">Audit history</Link>
          </div>
          <p className="mt-4 text-xs font-bold tracking-[.2em] text-cyan-400">MARKETPLACE PRE-LAUNCH</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Host onboarding review</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Review workspace Host profiles and vehicle listing drafts. This is a preliminary workflow only; no identity documents, vehicle documents or payment details are collected here.</p>
          <p className="mt-2 text-xs text-slate-500">Public catalog: {publicationEnabled ? "enabled" : "disabled pending launch readiness"}.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm hover:bg-white/5 disabled:opacity-50"><RefreshCw size={15}/> Refresh</button>
      </header>

      <aside className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">
        <b>Prequalification is not verification or publication.</b> A PREQUALIFIED status means only that preliminary information has been screened. It does not certify Host identity, vehicle ownership, registration, safety, insurance or legal authority, and it does not make any listing visible to renters.
      </aside>

      {error && <p role="alert" className="mt-5 rounded-xl bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-950/60 p-3 text-sm text-emerald-200">{notice}</p>}

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-slate-900 p-5"><div className="flex items-center justify-between text-sm text-slate-400"><span>Submitted / in review</span><ClipboardCheck size={18}/></div><p className="mt-3 text-3xl font-bold">{totals.submitted}</p></article>
        <article className="rounded-2xl border border-white/10 bg-slate-900 p-5"><div className="flex items-center justify-between text-sm text-slate-400"><span>Prequalified</span><Store size={18}/></div><p className="mt-3 text-3xl font-bold">{totals.prequalified}</p></article>
        <article className="rounded-2xl border border-white/10 bg-slate-900 p-5"><div className="flex items-center justify-between text-sm text-slate-400"><span>Vehicle drafts</span><CarFront size={18}/></div><p className="mt-3 text-3xl font-bold">{totals.listings}</p></article>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-slate-950 px-3 py-2"><Search size={14} className="text-slate-500"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Host, workspace or city…" className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600"/></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter Host status" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white">
            <option value="ALL">All statuses</option>{["SUBMITTED", ...reviewStatuses].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <span className="text-xs text-slate-500">{filtered.length} of {profiles.length} Host profiles</span>
        </div>

        {loading ? <p className="p-8 text-sm text-slate-400">Loading Host applications…</p> : filtered.length ? <div className="divide-y divide-white/10">
          {filtered.map((profile) => {
            const draft = drafts[profile.id];
            return <article key={profile.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{profile.displayName}</h2><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200">{profile.status.replaceAll("_", " ")}</span><span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-300">{profile.providerType}</span></div>
                  <p className="mt-2 text-sm text-slate-300">{profile.email}{profile.phone ? " · " + profile.phone : ""}</p>
                  <p className="mt-1 text-xs text-slate-400">{[profile.city, profile.province].filter(Boolean).join(", ")} · Submitted {dateLabel(profile.submittedAt)}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Building2 size={13}/><Link href={`/admin/tenants/${profile.tenant.id}`} className="text-cyan-300 hover:underline">{profile.tenant.name}</Link> · Workspace owner: {profile.tenant.owner?.email || "Not available"}</p>
                  {profile.description && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-400">{profile.description}</p>}
                  {profile.hostMessage && <p className="mt-3 rounded-lg bg-sky-950/40 p-3 text-xs text-sky-100">Last message to Host: {profile.hostMessage}</p>}
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-4 lg:grid-cols-[180px_1fr_1fr_auto]">
                <label className="text-xs text-slate-400">Review status<select value={draft?.status || "IN_REVIEW"} onChange={(event) => updateDraft(profile.id, "status", event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white">{reviewStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
                <label className="text-xs text-slate-400">Internal notes<textarea value={draft?.internalNotes || ""} onChange={(event) => updateDraft(profile.id, "internalNotes", event.target.value)} rows={2} maxLength={3000} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white" placeholder="Private notes for the ROAM team"/></label>
                <label className="text-xs text-slate-400">Message to Host<textarea value={draft?.hostMessage || ""} onChange={(event) => updateDraft(profile.id, "hostMessage", event.target.value)} rows={2} maxLength={1500} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white" placeholder="Visible in the Host workspace"/></label>
                <button onClick={() => void saveReview(profile)} disabled={saving === profile.id || !draft} className="self-end rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">{saving === profile.id ? "Saving…" : "Save review"}</button>
              </div>

              {profile.notifications.length > 0 && <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Host update history</h3><span className="text-xs text-slate-500">Latest {profile.notifications.length}</span></div>
                <div className="grid gap-2">{profile.notifications.map((notification) => <div key={notification.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/5 bg-slate-900/70 p-3">
                  <div className="min-w-0 flex-1"><p className="text-xs font-semibold">{notification.title}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-400">{notification.message}</p><p className="mt-2 text-[10px] text-slate-500">{dateLabel(notification.createdAt)} · Email: {notification.emailStatus}{notification.emailSentAt ? " at " + dateLabel(notification.emailSentAt) : ""}</p>{notification.emailError && <p className="mt-1 text-[10px] text-rose-300">{notification.emailError}</p>}</div>
                  {notification.emailStatus === "FAILED" && <button onClick={() => void retryNotification(notification)} disabled={saving === notification.id} className="rounded-lg border border-amber-300/30 px-3 py-2 text-[10px] font-bold text-amber-200 disabled:opacity-50">{saving === notification.id ? "Retrying…" : "Retry email"}</button>}
                </div>)}</div>
              </div>}

              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Vehicle listing drafts</h3><span className="text-xs text-slate-500">{profile.listings.length} listing(s)</span></div>
                {profile.listings.length ? <div className="grid gap-3 xl:grid-cols-2">
                  {profile.listings.map((listing) => <div key={listing.id} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{listing.vehicle.make} {listing.vehicle.model} {listing.vehicle.year || ""}</p><p className="mt-1 text-xs text-slate-400">{listing.vehicle.type.replaceAll("_", " ")} · {listing.vehicle.branchName} · {money(listing.vehicle.dailyRate)}/day</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-slate-300">{listing.status.replaceAll("_", " ")}</span>{listing.isPublished && <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-200">PUBLIC</span>}</div></div>
                    <p className="mt-3 text-sm font-semibold">{listing.headline}</p>{listing.description && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-400">{listing.description}</p>}
                    <div className="mt-4 grid gap-3 border-t border-white/10 pt-3 sm:grid-cols-[190px_1fr]">
                      <label className="text-xs text-slate-400">Review status<select disabled={saving === listing.id} value={listingDrafts[listing.id]?.status || "IN_REVIEW"} onChange={(event) => updateListingDraft(listing.id, "status", event.target.value)} aria-label={`Review status for ${listing.headline}`} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white">{reviewStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
                      <label className="text-xs text-slate-400">Message to Host<textarea value={listingDrafts[listing.id]?.hostMessage || ""} onChange={(event) => updateListingDraft(listing.id, "hostMessage", event.target.value)} rows={2} maxLength={1500} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white" placeholder="Explain the decision or information needed"/></label>
                      <div className="sm:col-span-2"><button onClick={() => void reviewListing(profile, listing)} disabled={saving === listing.id || !listingDrafts[listing.id]} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50">{saving === listing.id ? "Saving…" : "Save listing review"}</button></div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                      <p className="text-[11px] text-slate-500">{listing.isPublished ? "Visible in public vehicle discovery while all eligibility checks pass." : publicationEnabled ? "Not visible to renters until published." : "Public publication is disabled until launch readiness is approved."}</p>
                      {(listing.isPublished || publicationEnabled) && <button onClick={() => void togglePublication(listing)} disabled={saving === listing.id || (!listing.isPublished && listing.status !== "PREQUALIFIED")} className="rounded-lg border border-cyan-300/30 px-3 py-2 text-[10px] font-bold text-cyan-200 disabled:opacity-40">{saving === listing.id ? "Saving…" : listing.isPublished ? "Unpublish listing" : "Publish listing"}</button>}
                    </div>
                    {listing.hostMessage && <p className="mt-3 text-xs text-sky-200">Current Host message: {listing.hostMessage}</p>}
                  </div>)}
                </div> : <p className="rounded-lg border border-dashed border-white/10 p-5 text-xs text-slate-500">No vehicle listing drafts have been submitted.</p>}
              </div>
            </article>;
          })}
        </div> : <div className="p-12 text-center"><Store className="mx-auto mb-3 text-slate-500" size={28}/><p className="font-semibold">No Host profiles yet</p><p className="mt-2 text-sm text-slate-500">Workspace owners can create a Host profile from their Marketplace workspace page.</p></div>}
      </section>
      <p className="mt-4 text-xs text-slate-500">The page shows up to 200 Host profiles. Access is restricted to platform administrators. Review actions are recorded in platform audit history.</p>
    </div>
  </main>;
}
