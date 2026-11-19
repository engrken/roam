 "use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, CarFront, LogOut, ShieldCheck, CalendarDays, MapPin, Users, BookOpen, FileText, UserCog } from "lucide-react";

export function WorkspaceNav({ slug, name, role, active }: { slug: string; name: string; role: string; active: "overview" | "fleet" | "bookings" | "branches" | "customers" | "help" | "rental-terms" | "team" | "settings" | "reports" }) {
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
      <Link className={active === "bookings" ? "active" : ""} href={`/workspace/${slug}/bookings`}><CalendarDays size={18}/> Bookings & messages</Link>
      <Link className={active === "branches" ? "active" : ""} href={"/workspace/" + slug + "/branches"}><MapPin size={18}/> Branches</Link>
      <Link className={active === "customers" ? "active" : ""} href={"/workspace/" + slug + "/customers"}><Users size={18}/> Customers</Link>
      <Link className={active === "rental-terms" ? "active" : ""} href={`/workspace/${slug}/rental-terms`}><FileText size={18}/> Rental terms</Link>
      <Link className={active === "team" ? "active" : ""} href={`/workspace/${slug}/team`}><UserCog size={18}/> Team & access</Link>
      <Link className={active === "settings" ? "active" : ""} href={`/workspace/${slug}/settings`}><UserCog size={18}/> Business settings</Link>
      <Link className={active === "reports" ? "active" : ""} href={`/workspace/${slug}/reports`}><UserCog size={18}/> Reports</Link>
      <Link className={active === "help" ? "active" : ""} href={`/workspace/${slug}/help`}><BookOpen size={18}/> How-to guides</Link>
      <Link href="/admin" className="roam-admin-link"><ShieldCheck size={18}/> Platform admin</Link>
    </nav>
    <div className="roam-sidebar-bottom"><span className="roam-role">{role}</span><button onClick={signOut}><LogOut size={16}/> Sign out</button></div>
  </aside>;
}
