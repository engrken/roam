"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { FileText, Save, RotateCcw } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

const DEFAULT_TERMS = "The rental business will confirm the rental agreement, payment arrangements, deposit, permitted use, cancellation terms and vehicle return requirements before handover.";

export default function RentalTermsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [terms, setTerms] = useState("");
  const [savedTerms, setSavedTerms] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/workspaces/" + encodeURIComponent(slug) + "/rental-terms", { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load rental terms.");
        if (active) { setTerms(body.rentalTerms || ""); setSavedTerms(body.rentalTerms || ""); }
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load rental terms."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/rental-terms", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rentalTerms: terms }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save rental terms.");
      setTerms(body.rentalTerms || ""); setSavedTerms(body.rentalTerms || "");
      setNotice("Rental terms saved. New booking requests will display this version.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save rental terms.");
    } finally { setSaving(false); }
  }

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Rental terms" role="Workspace" active="rental-terms"/>
    <main className="roam-main">
      <header className="roam-topbar"><div><span className="roam-eyebrow">CUSTOMER AGREEMENT</span><h1>Rental terms & conditions</h1><p>Set the rules customers review when requesting one of your vehicles.</p></div></header>
      <section className="roam-panel roam-settings-panel">
        <div className="roam-settings-heading"><span className="roam-help-card-icon"><FileText size={20}/></span><div><h2>Your business rental terms</h2><p>These conditions belong to your rental business, not to ROAM. Customers must accept the current text before submitting a booking request.</p></div></div>
        <div className="roam-legal-notice">Write clear, accurate conditions for your own rental operation. Consider pickup and return rules, driver eligibility, permitted use, mileage, fuel, deposits, cancellations, late returns, damage, fines and payment arrangements. Get appropriate legal advice before publishing.</div>
        {error && <div className="client-alert" role="alert">{error}</div>}
        {notice && <div className="client-success-inline" role="status">{notice}</div>}
        {loading ? <p>Loading your rental terms…</p> : <form onSubmit={save} className="roam-settings-form">
          <label htmlFor="rental-terms">Terms shown to customers</label>
          <textarea id="rental-terms" value={terms} onChange={event => setTerms(event.target.value)} maxLength={12000} rows={16} placeholder="Enter your rental terms and conditions…"/>
          <div className="roam-settings-meta"><span>{terms.length.toLocaleString()} / 12,000 characters</span><span>{terms.trim() ? "Custom terms active" : "ROAM starter notice will be shown"}</span></div>
          <div className="roam-settings-actions">
            <button type="button" className="roam-secondary-button" onClick={() => setTerms(DEFAULT_TERMS)}><RotateCcw size={16}/> Use starter text</button>
            <button type="submit" className="roam-primary-button" disabled={saving || terms === savedTerms}><Save size={16}/>{saving ? "Saving…" : "Save rental terms"}</button>
          </div>
        </form>}
        <p className="roam-settings-footnote">Each booking stores the exact terms version accepted by the customer and the acceptance time. Editing these terms affects future booking requests only.</p>
      </section>
    </main>
  </div>;
}
