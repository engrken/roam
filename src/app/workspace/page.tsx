"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Workspace = { id: string; name: string; slug: string; role: string; status: string };
type Account = { id: string; email: string; name: string | null };

export default function WorkspacePage() {
  const router = useRouter();
  const [user,setUser] = useState<Account|null>(null);
  const [workspaces,setWorkspaces] = useState<Workspace[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  useEffect(()=>{ fetch("/api/auth/me").then(async r=>{ if(!r.ok) throw new Error("Please sign in to continue."); return r.json(); }).then(data=>{setUser(data.user);setWorkspaces(data.workspaces||[]);}).catch(()=>router.replace("/login")).finally(()=>setLoading(false)); },[router]);

  async function logout(){ await fetch("/api/auth/logout",{method:"POST"}); router.replace("/login"); router.refresh(); }

  if(loading) return <main className="min-h-screen bg-slate-950 p-8 text-slate-300">Loading your ROAM workspace…</main>;
  return <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6"><Link href="/" className="text-2xl font-black tracking-[.2em]">ROAM</Link><div className="flex items-center gap-4 text-sm"><span className="text-slate-400">{user?.email}</span><button onClick={logout} className="text-cyan-300 hover:text-white">Sign out</button></div></header>
      <section className="py-12"><p className="text-xs font-bold tracking-[.2em] text-cyan-400">YOUR ACCOUNT</p><h1 className="mt-3 text-3xl font-bold">Your rental workspaces</h1><p className="mt-3 text-slate-400">Choose a business workspace or set up your rental operation.</p></section>
      {error && <p className="text-red-300">{error}</p>}
      {workspaces.length ? <div className="grid gap-4 sm:grid-cols-2">{workspaces.map(w=><article key={w.id} className="rounded-2xl border border-white/10 bg-slate-900 p-6"><p className="text-xs font-bold tracking-wider text-cyan-400">{w.role}</p><h2 className="mt-2 text-xl font-semibold">{w.name}</h2><p className="mt-1 text-sm text-slate-400">{w.status}</p><p className="mt-5 text-sm text-slate-500">Workspace setup is ready for the next module.</p></article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 p-8"><h2 className="text-xl font-semibold">No workspace yet</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Create your rental business workspace. The account that creates it becomes its Owner and can manage branches, vehicles, and staff.</p><Link href="/workspace/new" className="mt-6 inline-flex rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300">Create my workspace</Link></div>}
    </div>
  </main>;
}
