"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CreditCard, ShieldCheck, Building2, ReceiptText, ArrowUpRight } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type AccountData = {
  tenant: { name: string; email: string; phone: string | null; status: string; createdAt: string };
  subscription: null | { tier: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; trialEndsAt: string | null; plan: { name: string; monthlyPrice: number; maxVehicles: number | null; maxBranches: number | null; maxStaff: number | null } };
  plans: { tier: string; name: string; monthlyPrice: number; maxVehicles: number | null; maxBranches: number | null; maxStaff: number | null }[];
  billingRecords: { id: string; description: string; reference: string | null; amount: number; currency: string; status: string; issuedAt: string; dueAt: string | null; paidAt: string | null }[];
  requests: { id: string; currentTier: string; requestedTier: string; status: string; createdAt: string }[];
};

const money = (amount: number, currency: string) => new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
const date = (value: string | null) => value ? new Date(value).toLocaleDateString() : "—";

export default function AccountPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/account", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load account information.");
    setData(body);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/workspaces/" + encodeURIComponent(slug) + "/account", { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load account information."); if (active) setData(body); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load account information."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  async function requestChange() {
    if (!selectedTier) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: selectedTier }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to submit plan change.");
      setNotice(body.message || "Subscription change request submitted.");
      setSelectedTier("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit plan change."); }
    finally { setSaving(false); }
  }

  const subscription = data?.subscription;
  const tier = subscription?.tier || "FREE";
  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Account & subscription" role="OWNER" active="account"/>
    <main className="roam-main">
      <header className="roam-topbar"><div><span className="roam-eyebrow">OWNER CONSOLE</span><h1>Account & subscription</h1><p>Manage your ROAM workspace account, subscription and billing records.</p></div></header>
      {error && <div className="client-alert" role="alert">{error}</div>}
      {notice && <div className="client-success-inline" role="status">{notice}</div>}
      {loading ? <section className="roam-panel"><p>Loading account details…</p></section> : data && <>
        <section className="roam-panel">
          <div className="roam-settings-heading"><span className="roam-help-card-icon"><ShieldCheck size={20}/></span><div><h2>Account overview</h2><p>Your workspace standing and current subscription.</p></div></div>
          <div className="roam-stats-grid">
            <article className="roam-stat-card"><span>ACCOUNT STATUS</span><strong>{data.tenant.status}</strong></article>
            <article className="roam-stat-card"><span>CURRENT TIER</span><strong>{subscription?.plan.name || "No active plan"}</strong><small>{tier}</small></article>
            <article className="roam-stat-card"><span>SUBSCRIPTION STATUS</span><strong>{subscription?.status || "Not assigned"}</strong></article>
            <article className="roam-stat-card"><span>MEMBER SINCE</span><strong>{date(data.tenant.createdAt)}</strong></article>
          </div>
          {subscription && <p className="roam-settings-footnote">Next period end: {date(subscription.currentPeriodEnd)} · Trial ends: {date(subscription.trialEndsAt)} · Plan price: {money(subscription.plan.monthlyPrice, "PHP")}/month</p>}
        </section>

        <section className="roam-panel">
          <div className="roam-settings-heading"><span className="roam-help-card-icon"><Building2 size={20}/></span><div><h2>Business information</h2><p>{data.tenant.name} · {data.tenant.email} · {data.tenant.phone || "No phone added"}</p></div><a className="roam-secondary-button" href={"/workspace/" + slug + "/settings"}>Edit business details <ArrowUpRight size={15}/></a></div>
          <p className="roam-settings-footnote">Business contact details are separate from your personal sign-in email. Only the workspace owner can manage subscription and billing information.</p>
        </section>

        <section className="roam-panel">
          <div className="roam-settings-heading"><span className="roam-help-card-icon"><CreditCard size={20}/></span><div><h2>Change subscription tier</h2><p>Request an upgrade or downgrade. Your current plan stays in place until ROAM reviews and approves the request.</p></div></div>
          <div className="roam-stats-grid">
            {data.plans.map(plan => <article className="roam-stat-card" key={plan.tier}><span>{plan.tier}</span><strong>{plan.name}</strong><small>{money(plan.monthlyPrice, "PHP")} / month</small><small>Vehicles: {plan.maxVehicles ?? "Unlimited"} · Branches: {plan.maxBranches ?? "Unlimited"} · Staff: {plan.maxStaff ?? "Unlimited"}</small></article>)}
          </div>
          <div className="roam-settings-actions">
            <label htmlFor="account-tier">Requested plan</label>
            <select id="account-tier" value={selectedTier} onChange={event => setSelectedTier(event.target.value)}><option value="">Select a plan</option>{data.plans.filter(plan => plan.tier !== tier).map(plan => <option key={plan.tier} value={plan.tier}>{plan.name} ({plan.tier}) — {money(plan.monthlyPrice, "PHP")}/month</option>)}</select>
            <button className="roam-primary-button" type="button" disabled={!selectedTier || saving || data.requests.some(item => item.status === "PENDING")} onClick={requestChange}>{saving ? "Submitting…" : "Request plan change"}</button>
          </div>
          {data.requests.length > 0 && <div className="roam-table-wrap"><table><thead><tr><th>Requested</th><th>From</th><th>To</th><th>Status</th></tr></thead><tbody>{data.requests.map(item => <tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.currentTier}</td><td>{item.requestedTier}</td><td>{item.status}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="roam-panel">
          <div className="roam-settings-heading"><span className="roam-help-card-icon"><ReceiptText size={20}/></span><div><h2>Billing history</h2><p>Invoices and payment records posted to your workspace.</p></div></div>
          {data.billingRecords.length ? <div className="roam-table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th>Reference</th><th>Amount</th><th>Status</th><th>Paid</th></tr></thead><tbody>{data.billingRecords.map(record => <tr key={record.id}><td>{date(record.issuedAt)}</td><td>{record.description}</td><td>{record.reference || "—"}</td><td>{money(record.amount, record.currency)}</td><td>{record.status}</td><td>{date(record.paidAt)}</td></tr>)}</tbody></table></div> : <p className="roam-settings-footnote">No billing records have been posted yet. Plan assignments and subscription requests are not proof of payment. Billing entries will appear here when ROAM records an invoice or confirmed transaction.</p>}
        </section>

        <section className="roam-panel">
          <div className="roam-settings-heading"><span className="roam-help-card-icon"><ShieldCheck size={20}/></span><div><h2>Sign-in & security</h2><p>ROAM currently uses passwordless email verification codes. There is no account password to change.</p></div></div>
          <p className="roam-settings-footnote">To secure your account, keep access to your sign-in email private and sign out on shared devices. A verified sign-in email change and active-session management are planned as separate security controls.</p>
        </section>
      </>}
    </main>
  </div>;
}
