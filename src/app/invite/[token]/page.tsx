"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Mail, ShieldCheck } from "lucide-react";

type CurrentUser = { email: string } | null;

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async response => response.ok ? response.json() : null)
      .then(body => { if (active) setUser(body?.user || null); })
      .catch(() => undefined)
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  async function accept() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/invitations/" + encodeURIComponent(token) + "/accept", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to accept this invitation.");
      setNotice("Invitation accepted. Opening your workspace…");
      router.replace("/workspace/" + encodeURIComponent(body.workspace.slug));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to accept this invitation.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="roam-auth-page">
    <section className="roam-auth-card">
      <Link href="/" className="roam-auth-brand"><span className="roam-brand-mark">R</span> ROAM</Link>
      <div className="roam-auth-eyebrow"><ShieldCheck size={14}/> WORKSPACE INVITATION</div>
      <h1>Join a rental workspace</h1>
      <p className="roam-auth-description">Accept this invitation to access the workspace. The invitation is tied to the email address it was sent to and expires after seven days.</p>
      {checking ? <p className="roam-muted">Checking your sign-in…</p> : user ? <>
        <p className="roam-auth-message"><Mail size={16}/> Signed in as <strong>{user.email}</strong></p>
        <p className="roam-muted">Make sure this is the same email address that received the invitation.</p>
        {error && <p className="roam-auth-error" role="alert">{error}</p>}
        {notice && <p className="roam-auth-message" role="status"><CheckCircle2 size={16}/>{notice}</p>}
        <button className="roam-primary-btn roam-auth-submit" disabled={busy} onClick={() => void accept()}>{busy ? "Accepting…" : "Accept invitation"}</button>
      </> : <>
        <p className="roam-muted">First, sign in or create a ROAM account using the invited email address. Keep this page open, then return here to accept the invitation.</p>
        <div className="roam-settings-actions">
          <a className="roam-primary-btn" href="/login" target="_blank" rel="noreferrer">Sign in</a>
          <a className="roam-secondary-btn" href="/register" target="_blank" rel="noreferrer">Create account</a>
        </div>
      </>}
      <Link href="/" className="roam-auth-home">Back to ROAM home</Link>
    </section>
  </main>;
}
