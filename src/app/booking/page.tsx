"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function BookingLookupPage() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/public/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to request your booking link.");
      setMessage(body.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to request your booking link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="client-page">
      <header className="client-topbar">
        <Link className="client-brand" href="/"><span>R</span> ROAM</Link>
        <div className="client-topbar-links"><span>BOOKING ACCESS</span><Link href="/help">Booking help</Link></div>
      </header>
      <div className="client-container">
        <section className="client-success client-loading-card" style={{ maxWidth: 560, margin: "56px auto", textAlign: "left" }}>
          <div className="client-eyebrow">CUSTOMER BOOKING PORTAL</div>
          <h1>Find your booking</h1>
          <p>Enter the booking reference and the email address you used when you made the request. We’ll email you a fresh private access link if the details match.</p>
          {error && <div className="client-alert" role="alert">{error}</div>}
          {message && <div className="client-notice" role="status">{message}</div>}
          <form onSubmit={submit} style={{ display: "grid", gap: 16, marginTop: 24 }}>
            <label style={{ display: "grid", gap: 7, fontWeight: 600 }}>
              Booking reference
              <input required value={reference} onChange={event => setReference(event.target.value.toUpperCase())} placeholder="RM-XXXXXXXXXXXX" autoComplete="off" maxLength={15} style={{ width: "100%", padding: "13px 14px", border: "1px solid #cbd5e1", borderRadius: 9, font: "inherit", letterSpacing: 1 }} />
            </label>
            <label style={{ display: "grid", gap: 7, fontWeight: 600 }}>
              Booking email address
              <input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={254} style={{ width: "100%", padding: "13px 14px", border: "1px solid #cbd5e1", borderRadius: 9, font: "inherit" }} />
            </label>
            <button className="client-primary" type="submit" disabled={busy || !reference.trim() || !email.trim()}>{busy ? "Checking…" : "Email me my booking link"} <span>→</span></button>
          </form>
          <p className="client-panel-copy" style={{ marginTop: 20 }}>For your privacy, this page won’t reveal whether a booking reference or email address exists. If you no longer have access to that email, please contact the rental business.</p>
          <p style={{ marginTop: 22 }}><Link href="/" style={{ color: "inherit" }}>← Back to ROAM</Link></p>
        </section>
      </div>
    </main>
  );
}
