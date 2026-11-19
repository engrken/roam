"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Building2, CalendarDays, Check,
  ChevronRight, CircleHelp, Clock3, CreditCard, LockKeyhole, Mail,
  ReceiptText, ShieldCheck, Sparkles, UserRound,
} from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type AccountData = {
  user: { id: string; name: string | null; email: string };
  tenant: {
    name: string; email: string; phone: string | null; status: string; createdAt: string; referralCode: string;
    referralsSent: { id: string; referredBusiness: string; status: string; registeredAt: string; expiresAt: string; qualifiedAt: string | null; rewardedAt: string | null }[];
    referralReceived: null | { status: string; registeredAt: string; expiresAt: string; qualifiedAt: string | null; rewardedAt: string | null; referrerBusiness: string };
  };
  subscription: null | { tier: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; trialEndsAt: string | null; plan: { name: string; monthlyPrice: number; maxVehicles: number | null; maxBranches: number | null; maxStaff: number | null } };
  plans: { tier: string; name: string; monthlyPrice: number; maxVehicles: number | null; maxBranches: number | null; maxStaff: number | null }[];
  billingRecords: { id: string; description: string; reference: string | null; amount: number; currency: string; status: string; issuedAt: string; dueAt: string | null; paidAt: string | null }[];
  requests: { id: string; currentTier: string; requestedTier: string; status: string; createdAt: string }[];
};

const money = (amount: number, currency = "PHP") => new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
const date = (value: string | null) => value ? new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "—";
const titleCase = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const capacity = (value: number | null) => value == null ? "Unlimited" : String(value);
const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function AccountPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedTier, setSelectedTier] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailStep, setEmailStep] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  async function load() {
    const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/account", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load account information.");
    setData(body);
    setOwnerName(body.user?.name || "");
  }

  useEffect(() => {
    let active = true;
    fetch("/api/workspaces/" + encodeURIComponent(slug) + "/account", { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load account information.");
        if (active) { setData(body); setOwnerName(body.user?.name || ""); }
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load account information."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  async function copyReferralLink() {
    if (!data?.tenant.referralCode) return;
    const link = window.location.origin + "/register?ref=" + encodeURIComponent(data.tenant.referralCode);
    try {
      await navigator.clipboard.writeText(link);
      setReferralCopied(true);
      window.setTimeout(() => setReferralCopied(false), 2200);
      setNotice("Your referral link has been copied.");
    } catch {
      setError("Unable to copy the referral link. Please try again.");
    }
  }

  async function requestChange() {
    if (!selectedTier) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tier: selectedTier }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to submit plan change.");
      setNotice(body.message || "Your plan change request has been submitted.");
      setSelectedTier("");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit plan change."); }
    finally { setSaving(false); }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setProfileSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: ownerName }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save profile.");
      setNotice("Your profile has been updated.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save profile."); }
    finally { setProfileSaving(false); }
  }

  async function sendEmailCode() {
    setEmailBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/auth/request-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: newEmail, purpose: "change-email" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to send verification code.");
      setEmailStep(true); setNotice("A verification code has been sent to your new email address.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to send verification code."); }
    finally { setEmailBusy(false); }
  }

  async function verifyEmail() {
    setEmailBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/auth/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: newEmail, code: emailCode }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to verify new email.");
      setEmailStep(false); setEmailCode(""); setNewEmail("");
      setNotice("Your sign-in email has been changed.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to verify new email."); }
    finally { setEmailBusy(false); }
  }

  const subscription = data?.subscription;
  const tier = subscription?.tier || "FREE";
  const pendingRequest = data?.requests.find(item => item.status === "PENDING");
  const periodEnd = subscription?.currentPeriodEnd || subscription?.trialEndsAt || null;

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Account & subscription" role="OWNER" active="account"/>
    <main className="roam-main roam-account-main">
      <header className="roam-topbar roam-account-topbar">
        <div><span className="roam-eyebrow">WORKSPACE SETTINGS</span><h1>Account & subscription</h1><p>Your workspace profile, plan and billing activity in one place.</p></div>
        <a href="#account-security" className="roam-account-security-link"><LockKeyhole size={15}/> Account security</a>
      </header>

      {error && <div className="client-alert roam-account-alert" role="alert">{error}</div>}
      {notice && <div className="client-success-inline roam-account-notice" role="status"><Check size={16}/>{notice}</div>}

      {loading ? <section className="roam-panel roam-account-loading"><span className="roam-account-spinner"/><strong>Loading your account</strong><p>Fetching workspace and subscription details…</p></section> : !data ? <section className="roam-panel roam-account-empty"><CircleHelp size={28}/><h2>We couldn’t load this account</h2><p>Check your connection and try again. Your account information has not been changed.</p><button className="roam-primary-button" type="button" onClick={() => { setLoading(true); setError(""); void load().catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load account information.")).finally(() => setLoading(false)); }}>Try again</button></section> : <>
        <section className="roam-account-hero">
          <div className="roam-account-hero-copy">
            <span className="roam-account-kicker"><Sparkles size={14}/> YOUR ROAM WORKSPACE</span>
            <h2>{data.tenant.name}</h2>
            <p>Keep your business details current and choose the operating capacity that fits your rental business.</p>
            <div className="roam-account-hero-meta"><span><Building2 size={14}/>{data.tenant.email}</span><span><CalendarDays size={14}/>Member since {date(data.tenant.createdAt)}</span></div>
          </div>
          <div className="roam-account-plan-summary">
            <span>YOUR CURRENT PLAN</span>
            <strong>{subscription?.plan.name || "No plan assigned"}</strong>
            <div className="roam-account-plan-price">{subscription ? <>{money(subscription.plan.monthlyPrice)}<small>/ month</small></> : "Contact ROAM support"}</div>
            <span className={"roam-account-status " + statusClass(subscription?.status || data.tenant.status)}><i/> {titleCase(subscription?.status || data.tenant.status)}</span>
            {periodEnd && <small className="roam-account-renewal">{subscription?.trialEndsAt && !subscription.currentPeriodEnd ? "Trial ends" : "Current period ends"} · {date(periodEnd)}</small>}
          </div>
        </section>

        <nav className="roam-account-jumpnav" aria-label="Account sections">
          <a href="#subscription">Subscription <ChevronRight size={14}/></a><a href="#owner-profile">Owner profile <ChevronRight size={14}/></a><a href="#business-profile">Business <ChevronRight size={14}/></a><a href="#billing-history">Billing history <ChevronRight size={14}/></a>
        </nav>

        {pendingRequest && <section className="roam-account-pending" role="status"><span><Clock3 size={18}/></span><div><strong>Plan change awaiting review</strong><p>Your request to move from {pendingRequest.currentTier} to {pendingRequest.requestedTier} was submitted on {date(pendingRequest.createdAt)}. Your current plan remains active until it is reviewed.</p></div><span className="roam-account-pending-tag">Pending</span></section>}

        <section className="roam-panel roam-account-section" id="subscription">
          <div className="roam-account-section-heading"><div><span className="roam-eyebrow">PLAN & CAPACITY</span><h2>Subscription</h2><p>Compare available plans and request a change when your business needs more capacity.</p></div><span className="roam-account-heading-icon"><CreditCard size={20}/></span></div>
          <div className="roam-account-plan-grid">
            {data.plans.map(plan => {
              const isCurrent = plan.tier === tier;
              return <article className={"roam-account-plan-card" + (isCurrent ? " is-current" : "")} key={plan.tier}>
                {isCurrent && <span className="roam-account-current-label"><BadgeCheck size={13}/> CURRENT PLAN</span>}
                <div className="roam-account-plan-card-title"><h3>{plan.name}</h3><span>{plan.tier}</span></div>
                <div className="roam-account-plan-card-price">{money(plan.monthlyPrice)}<small>/ month</small></div>
                <p className="roam-account-plan-caption">{isCurrent ? "Your workspace is currently on this plan." : "Available for your workspace."}</p>
                <div className="roam-account-capacities"><div><span>Vehicles</span><strong>{capacity(plan.maxVehicles)}</strong></div><div><span>Branches</span><strong>{capacity(plan.maxBranches)}</strong></div><div><span>Staff</span><strong>{capacity(plan.maxStaff)}</strong></div></div>
                {isCurrent && <div className="roam-account-current-foot"><Check size={14}/> Active for this workspace</div>}
              </article>;
            })}
          </div>
          <div className="roam-account-request">
            <div><strong>Need a different plan?</strong><p>Choose a tier to submit a request. ROAM will review it before any plan change takes effect.</p></div>
            <div className="roam-account-request-controls">
              <label className="roam-account-visually-hidden" htmlFor="account-tier">Requested plan</label>
              <select id="account-tier" value={selectedTier} onChange={event => setSelectedTier(event.target.value)} disabled={!!pendingRequest || saving}>
                <option value="">Select a plan</option>{data.plans.filter(plan => plan.tier !== tier).map(plan => <option key={plan.tier} value={plan.tier}>{plan.name} · {money(plan.monthlyPrice)}/mo</option>)}
              </select>
              <button className="roam-primary-button" type="button" disabled={!selectedTier || saving || !!pendingRequest} onClick={requestChange}>{saving ? "Submitting…" : "Request plan change"} <ArrowRight size={16}/></button>
            </div>
          </div>
          {data.requests.length > 0 && <div className="roam-account-history"><h3>Plan change requests</h3><div className="roam-table-wrap"><table><thead><tr><th>Requested</th><th>From</th><th>To</th><th>Status</th></tr></thead><tbody>{data.requests.map(item => <tr key={item.id}><td>{date(item.createdAt)}</td><td>{item.currentTier}</td><td>{item.requestedTier}</td><td><span className={"roam-account-table-status " + statusClass(item.status)}>{titleCase(item.status)}</span></td></tr>)}</tbody></table></div></div>}
          <p className="roam-account-disclaimer"><ShieldCheck size={15}/> Plan changes are reviewed by ROAM. This page does not collect payments or automatically renew subscriptions.</p>
        </section>

        <section className="roam-panel roam-account-section" id="owner-profile">
          <div className="roam-account-section-heading"><div><span className="roam-eyebrow">PERSONAL DETAILS</span><h2>Owner profile</h2><p>Manage the name and sign-in email associated with your owner account.</p></div><span className="roam-account-heading-icon"><UserRound size={20}/></span></div>
          <form className="roam-account-form" onSubmit={saveProfile}>
            <div className="roam-account-field"><label htmlFor="owner-name">Your name</label><input id="owner-name" value={ownerName} maxLength={100} onChange={event => setOwnerName(event.target.value)} placeholder="Your full name"/></div>
            <div className="roam-account-field"><label htmlFor="current-signin-email">Sign-in email</label><input id="current-signin-email" value={data.user.email} readOnly/><small>This is the email you use to receive sign-in codes.</small></div>
            <div className="roam-account-form-actions"><button className="roam-primary-button" type="submit" disabled={profileSaving || ownerName.trim() === (data.user.name || "").trim()}>{profileSaving ? "Saving…" : "Save profile"}</button></div>
          </form>
          <div className="roam-account-email-change">
            <div className="roam-account-subheading"><Mail size={17}/><div><strong>Change sign-in email</strong><p>We’ll send a one-time verification code to the new address.</p></div></div>
            <div className="roam-account-email-controls">
              <div className="roam-account-field"><label htmlFor="new-signin-email">New email address</label><input id="new-signin-email" type="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="name@example.com" disabled={emailStep}/></div>
              {!emailStep ? <button className="roam-secondary-button" type="button" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail) || emailBusy} onClick={sendEmailCode}>{emailBusy ? "Sending…" : "Send verification code"}</button> : <div className="roam-account-code-group"><div className="roam-account-field"><label htmlFor="email-change-code">6-digit verification code</label><input id="email-change-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={emailCode} onChange={event => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000"/></div><button className="roam-primary-button" type="button" disabled={emailCode.length !== 6 || emailBusy} onClick={verifyEmail}>{emailBusy ? "Verifying…" : "Verify email"}</button><button className="roam-text-button" type="button" onClick={() => { setEmailStep(false); setEmailCode(""); }}>Cancel</button></div>}
            </div>
          </div>
        </section>

        <section className="roam-panel roam-account-section" id="business-profile">
          <div className="roam-account-section-heading"><div><span className="roam-eyebrow">WORKSPACE DETAILS</span><h2>Business information</h2><p>These details identify your rental business to customers and are separate from your personal sign-in email.</p></div><span className="roam-account-heading-icon"><Building2 size={20}/></span></div>
          <div className="roam-account-business-card"><div className="roam-account-business-mark"><Building2 size={21}/></div><div className="roam-account-business-copy"><strong>{data.tenant.name}</strong><span>{data.tenant.email}</span><span>{data.tenant.phone || "No business phone added"}</span></div><a className="roam-secondary-button" href={"/workspace/" + encodeURIComponent(slug) + "/settings"}>Edit business details <ArrowUpRight size={15}/></a></div>
        </section>

        <section className="roam-panel roam-account-section" id="referrals">
          <div className="roam-account-section-heading"><div><span className="roam-eyebrow">GROW WITH ROAM</span><h2>Refer a rental business</h2><p>Invite another rental business to ROAM and earn a free month together.</p></div><span className="roam-account-heading-icon"><Sparkles size={20}/></span></div>
          <div className="roam-account-business-card">
            <div className="roam-account-business-mark"><Sparkles size={21}/></div>
            <div className="roam-account-business-copy"><strong>Give one month. Get one month.</strong><span>Share your unique referral link with a new ROAM customer.</span><span>When they create their account and complete their first paid subscription within 30 days of registration, both workspaces receive one free month.</span></div>
            <button className="roam-secondary-button" type="button" onClick={copyReferralLink}>{referralCopied ? "Copied!" : "Copy referral link"} <ArrowUpRight size={15}/></button>
          </div>
          <div className="roam-account-referral-code"><span>Your referral code</span><strong>{data.tenant.referralCode}</strong></div>
          {data.tenant.referralReceived && <p className="roam-account-referral-note">You joined through {data.tenant.referralReceived.referrerBusiness}. Referral status: <strong>{titleCase(data.tenant.referralReceived.status)}</strong>{data.tenant.referralReceived.status === "PENDING" ? " · Qualifying payment deadline " + date(data.tenant.referralReceived.expiresAt) : ""}</p>}
          <div className="roam-account-history">
            <h3>Your referrals</h3>
            {data.tenant.referralsSent.length ? <div className="roam-table-wrap"><table><thead><tr><th>Business</th><th>Registered</th><th>Payment deadline</th><th>Status</th></tr></thead><tbody>{data.tenant.referralsSent.map(item=><tr key={item.id}><td>{item.referredBusiness}</td><td>{date(item.registeredAt)}</td><td>{date(item.expiresAt)}</td><td><span className={"roam-account-table-status " + statusClass(item.status)}>{titleCase(item.status)}</span></td></tr>)}</tbody></table></div> : <p className="roam-account-plan-caption">No referrals yet. Copy your link and share it with another rental business.</p>}
          </div>
          <p className="roam-account-disclaimer"><ShieldCheck size={15}/> A referral qualifies only after the new workspace's first paid subscription payment is verified by ROAM. Both one-month rewards are applied automatically after qualification. Self-referrals and duplicate claims are not eligible.</p>
        </section>

        <section className="roam-panel roam-account-section" id="billing-history">
          <div className="roam-account-section-heading"><div><span className="roam-eyebrow">PAYMENT RECORDS</span><h2>Billing history</h2><p>Invoices and payment records posted to this workspace.</p></div><span className="roam-account-heading-icon"><ReceiptText size={20}/></span></div>
          {data.billingRecords.length ? <div className="roam-table-wrap"><table><thead><tr><th>Date issued</th><th>Description</th><th>Reference</th><th>Amount</th><th>Status</th><th>Date paid</th></tr></thead><tbody>{data.billingRecords.map(record => <tr key={record.id}><td>{date(record.issuedAt)}</td><td>{record.description}</td><td>{record.reference || "—"}</td><td>{money(record.amount, record.currency)}</td><td><span className={"roam-account-table-status " + statusClass(record.status)}>{titleCase(record.status)}</span></td><td>{date(record.paidAt)}</td></tr>)}</tbody></table></div> : <div className="roam-account-empty-state"><span><ReceiptText size={20}/></span><div><strong>No billing records yet</strong><p>Invoices and confirmed payment entries will appear here when ROAM posts them. A plan request or assignment is not proof of payment.</p></div></div>}
        </section>

        <section className="roam-account-security" id="account-security">
          <span><LockKeyhole size={19}/></span><div><strong>Sign-in & security</strong><p>ROAM uses passwordless email verification codes. There is no account password to change. Keep access to your sign-in email private and sign out on shared devices.</p></div><a href="/help">Account help <ArrowUpRight size={14}/></a>
        </section>
        <footer className="roam-account-footer"><ShieldCheck size={14}/> Only workspace owners can manage subscription and billing information.</footer>
      </>}
    </main>
  </div>;
}
