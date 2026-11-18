"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";

export function EmailOtpForm({ mode = "login" }: { mode?: "login" | "register" }) {
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [code,setCode]=useState("");
  const [step,setStep]=useState<"email"|"code">("email");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const registering=mode==="register";

  useEffect(()=>{fetch("/api/auth/me",{cache:"no-store"}).then(r=>{if(r.ok)router.replace("/workspace");}).catch(()=>undefined);},[router]);

  async function submit(event:FormEvent){
    event.preventDefault();setBusy(true);setError("");setMessage("");
    try{
      const endpoint=step==="email"?"/api/auth/request-otp":"/api/auth/verify-otp";
      const payload=step==="email"?{email,purpose:registering?"register":"login"}:{email,code};
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Something went wrong.");
      if(step==="email"){setStep("code");setMessage("A six-digit verification code has been sent if this email is eligible. Check your inbox.");}
      else{router.replace("/workspace");router.refresh();}
    }catch(e){setError(e instanceof Error?e.message:"Please try again.");}
    finally{setBusy(false);}
  }

  return <main className="roam-auth-page">
    <section className="roam-auth-card">
      <Link href="/" className="roam-auth-brand"><span className="roam-brand-mark">R</span> ROAM</Link>
      <div className="roam-auth-eyebrow"><ShieldCheck size={14}/> SECURE, PASSWORDLESS ACCESS</div>
      <h1>{step==="email"?(registering?"Create your ROAM account":"Welcome back"):"Verify your email"}</h1>
      <p className="roam-auth-description">{step==="email"?(registering?"Start managing your rental business with a secure email account. No password or credit card required.":"Sign in to your rental workspace using a one-time verification code."):"Enter the six-digit code sent to your email. It expires in five minutes."}</p>
      <form onSubmit={submit} className="roam-auth-form">
        <label>Email address<div className="roam-auth-input-wrap"><Mail size={17}/><input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={step==="code"} placeholder="you@business.com"/></div></label>
        {step==="code"&&<label>Six-digit verification code<input className="roam-otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></label>}
        {message&&<p className="roam-auth-message" role="status"><CheckCircle2 size={16}/>{message}</p>}
        {error&&<p className="roam-auth-error" role="alert">{error}</p>}
        <button className="roam-primary-btn roam-auth-submit" disabled={busy}>{busy?"Please wait…":step==="email"?(registering?"Create account":"Email me a sign-in code"):"Verify and continue"}<ArrowRight size={16}/></button>
      </form>
      {step==="code"&&<button className="roam-auth-back" onClick={()=>{setStep("email");setCode("");setMessage("");setError("");}}><ArrowLeft size={14}/> Use a different email</button>}
      <div className="roam-auth-switch">{registering?"Already have an account?":"New to ROAM?"} <Link href={registering?"/login":"/register"}>{registering?"Sign in":"Create a free account"}</Link></div>
      <Link href="/" className="roam-auth-home">Back to ROAM home</Link>
    </section>
  </main>;
}
