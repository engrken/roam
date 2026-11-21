"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal";

export default function LegalConsentPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => { if (!response.ok) router.replace("/login"); })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accepted) { setError("You must agree to the Terms and acknowledge the Privacy Policy to continue."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save your acceptance.");
      router.replace("/workspace");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally { setBusy(false); }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (loading) return <main className="roam-loading">Checking your account…</main>;
  return <main className="roam-auth-page"><section className="roam-auth-card roam-consent-card">
    <Link href="/" className="roam-auth-brand"><span className="roam-brand-mark">R</span> ROAM</Link>
    <div className="roam-auth-eyebrow"><ShieldCheck size={14}/> ACCOUNT & DATA PROTECTION</div>
    <h1>Before you continue</h1>
    <p className="roam-auth-description">Please review the documents below. You must agree to the Terms of Service and acknowledge the Privacy Policy to access your ROAM workspace. We record the document versions and time of your response.</p>
    <div className="roam-consent-docs">
      <Link href="/terms" target="_blank">Terms of Service <span>Version {TERMS_VERSION}</span></Link>
      <Link href="/privacy" target="_blank">Privacy Policy <span>Version {PRIVACY_VERSION}</span></Link>
    </div>
    <form onSubmit={submit} className="roam-auth-form">
      <label className="roam-consent-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)}/><span>I have read and agree to the <Link href="/terms" target="_blank">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
      {error && <p className="roam-auth-error" role="alert">{error}</p>}
      <button className="roam-primary-btn roam-auth-submit" disabled={busy || !accepted}>{busy ? "Saving acceptance…" : "Accept and continue"} <CheckCircle2 size={16}/></button>
    </form>
    <button className="roam-auth-back" onClick={signOut}>Sign out instead</button>
  </section></main>;
}
