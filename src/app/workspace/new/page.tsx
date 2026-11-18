"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewWorkspacePage() {
  const router=useRouter();
  const [businessName,setBusinessName]=useState("");
  const [phone,setPhone]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  async function submit(event:FormEvent){
    event.preventDefault();setBusy(true);setError("");
    try{
      const response=await fetch("/api/workspaces",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessName,phone})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Unable to create workspace.");
      router.replace("/workspace");router.refresh();
    }catch(e){setError(e instanceof Error?e.message:"Please try again.");}
    finally{setBusy(false);}
  }

  return <main className="min-h-screen bg-slate-950 px-5 py-12 text-slate-100"><div className="mx-auto max-w-xl">
    <Link href="/workspace" className="text-sm text-cyan-300 hover:text-white">← Back to workspaces</Link>
    <p className="mt-10 text-xs font-bold tracking-[.2em] text-cyan-400">WORKSPACE SETUP</p><h1 className="mt-3 text-3xl font-bold">Set up your rental business</h1>
    <p className="mt-3 text-sm leading-6 text-slate-400">Your signed-in account will become the workspace Owner and initial tenant manager.</p>
    <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-slate-900 p-7">
      <label className="block text-sm font-medium text-slate-300">Business or rental company name<input required minLength={2} maxLength={100} value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="e.g. ABC Vehicle Rentals" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"/></label>
      <label className="block text-sm font-medium text-slate-300">Business contact number <span className="text-slate-500">(optional)</span><input type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+63…" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"/></label>
      {error&&<p role="alert" className="text-sm text-red-300">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-cyan-400 px-5 py-3.5 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{busy?"Creating…":"Create workspace"}</button>
      <p className="text-xs leading-5 text-slate-500">Your workspace starts on the Free plan. Plan limits are enforced by the server.</p>
    </form>
  </div></main>;
}
