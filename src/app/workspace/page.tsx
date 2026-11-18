"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, LogOut, Plus, ShieldCheck } from "lucide-react";

type Workspace={id:string;name:string;slug:string;role:string;status:string};
type Account={id:string;email:string;name:string|null};

export default function WorkspacePage(){
 const router=useRouter();const [user,setUser]=useState<Account|null>(null);const [workspaces,setWorkspaces]=useState<Workspace[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 useEffect(()=>{fetch("/api/auth/me",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Please sign in to continue.");return r.json();}).then(d=>{setUser(d.user);setWorkspaces(d.workspaces||[]);}).catch(()=>router.replace("/login")).finally(()=>setLoading(false));},[router]);
 async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/login");router.refresh();}
 if(loading)return <main className="roam-loading">Loading your ROAM account…</main>;
 return <main className="roam-workspace-page"><header className="roam-workspace-header"><Link href="/" className="roam-auth-brand"><span className="roam-brand-mark">R</span> ROAM</Link><div><span>{user?.email}</span><button onClick={logout}><LogOut size={15}/> Sign out</button></div></header><section className="roam-workspace-content"><div className="roam-auth-eyebrow">YOUR ACCOUNT</div><h1>Your rental workspaces</h1><p className="roam-auth-description">Choose a business workspace or set up your rental operation.</p>{error&&<p className="roam-auth-error">{error}</p>}
 {workspaces.length?<div className="roam-workspace-grid">{workspaces.map(w=><Link key={w.id} href={`/workspace/${w.slug}`} className="roam-workspace-card"><div className="roam-workspace-card-top"><span className="roam-setup-icon"><Building2 size={21}/></span><span className={`roam-tenant-status ${w.status.toLowerCase()}`}>{w.status}</span></div><h2>{w.name}</h2><p>{w.role} · Rental workspace</p><span className="roam-workspace-open">Open business overview <ArrowRight size={15}/></span></Link>)}</div>:<div className="roam-no-workspace"><div className="roam-setup-icon"><Building2 size={24}/></div><h2>No workspace yet</h2><p>Create your rental business workspace. The account that creates it becomes its Owner and can manage branches, vehicles and staff.</p><Link className="roam-primary-btn" href="/workspace/new">Create my workspace <ArrowRight size={16}/></Link></div>}
 <div className="roam-workspace-foot"><ShieldCheck size={16}/> Your business data is separated from other ROAM workspaces.</div></section></main>;
}
