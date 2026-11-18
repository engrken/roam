"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const endpoint = step === "email" ? "/api/auth/request-otp" : "/api/auth/verify-otp";
      const payload = step === "email" ? { email } : { email, code };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Something went wrong.");
      if (step === "email") {
        setStep("code");
        setMessage("If this address can receive ROAM sign-in messages, a six-digit code has been sent. Check your inbox.");
      } else {
        router.replace("/workspace");
        router.refresh();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-5 py-12">
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
      <Link href="/" className="text-2xl font-black tracking-[.2em] text-white">ROAM</Link>
      <p className="mt-2 text-xs font-semibold tracking-[.18em] text-cyan-400">RENTAL OPERATIONS AND ASSET MANAGEMENT</p>
      <h1 className="mt-10 text-3xl font-bold">{step === "email" ? "Welcome back." : "Check your email."}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">{step === "email" ? "Sign in securely using a one-time code. No password required." : "Enter the six-digit code we sent. It expires in five minutes."}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-slate-300">Email address
          <input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={step === "code"} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400 disabled:opacity-70"/>
        </label>
        {step === "code" && <label className="block text-sm font-medium text-slate-300">Six-digit verification code
          <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-4 text-center text-2xl font-bold tracking-[.5em] text-white outline-none focus:border-cyan-400"/>
        </label>}
        {message && <p role="status" className="rounded-xl bg-cyan-950/60 p-3 text-sm text-cyan-200">{message}</p>}
        {error && <p role="alert" className="rounded-xl bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50">{busy ? "Please wait…" : step === "email" ? "Email me a sign-in code" : "Verify and sign in"}</button>
      </form>
      {step === "code" && <button onClick={()=>{setStep("email");setCode("");setMessage("");setError("");}} className="mt-4 w-full text-sm text-slate-400 hover:text-white">Use a different email address</button>}
      <p className="mt-8 text-center text-xs leading-5 text-slate-500">Passwordless sign-in · One-time codes expire after five minutes.</p>
    </section>
  </main>;
}
