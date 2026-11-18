"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, CarFront, LogOut, ShieldCheck } from "lucide-react";

export function WorkspaceNav({ slug, name, role, active }: { slug: string; name: string; role: string; active: "overview" | "fleet" }) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return <aside className="roam-sidebar">
    <Link href="/" className="roam-brand"><span className="roam-brand-mark">R</span><span>ROAM</span></Link>
    <div className="roam-side-label">WORKSPACE</div>
    <div className="roam-workspace-name">{name}</div>
    <nav className="roam-side-nav" aria-label="Workspace navigation">
      <Link className={active === "overview" ? "active" : ""} href={`/workspace/${slug}`}><LayoutDashboard size={18}/> Overview</Link>
      <Link className={active === "fleet" ? "active" : ""} href={`/workspace/${slug}/fleet`}><CarFront size={18}/> Fleet management</Link>
      <Link href="/admin" className="roam-admin-link"><ShieldCheck size={18}/> Platform admin</Link>
    </nav>
    <div className="roam-sidebar-bottom"><span className="roam-role">{role}</span><button onClick={signOut}><LogOut size={16}/> Sign out</button></div>
  </aside>;
}
