"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, CarFront, LogOut, ShieldCheck, CalendarDays, MapPin, Users,
  BookOpen, FileText, UserCog, MessageCircle, Wallet, Menu, X, LockKeyhole, Wrench,
  ArrowUpRight, ChevronLeft, ChevronRight,
} from "lucide-react";

type FeatureKey = "branches" | "reports" | "team";
type FeatureInfo = { title: string; plan: string; description: string; benefits: string[] };

const tierRank: Record<string, number> = {
  FREE: 0, STARTER: 1, PRO: 2, BUSINESS: 3, ENTERPRISE: 4,
};

const lockedFeatures: Record<FeatureKey, FeatureInfo> = {
  branches: {
    title: "Multi-branch management",
    plan: "Pro",
    description: "Manage separate rental locations from one ROAM workspace. Keep branch addresses and pickup operations organized while tracking the vehicles and bookings assigned to each location.",
    benefits: ["Set up and manage multiple pickup branches", "Organize vehicles and bookings by location", "Grow into additional service areas without creating separate workspaces"],
  },
  reports: {
    title: "Operational reports",
    plan: "Pro",
    description: "Turn your rental activity into useful business insights. Review booking trends, completed booking value and operational performance over a selected period.",
    benefits: ["Review booking and revenue summaries", "Filter reports by date and branch", "Export report data as CSV for further analysis"],
  },
  team: {
    title: "Team & access",
    plan: "Business",
    description: "Bring your staff into ROAM and give each person the right level of workspace access, while keeping ownership and sensitive business controls protected.",
    benefits: ["Invite staff to your rental workspace", "Assign roles and access permissions", "Manage your growing operation with a shared team"],
  },
};

export function WorkspaceNav({ slug, name, role, active }: { slug: string; name: string; role: string; active: "overview" | "fleet" | "maintenance" | "calendar" | "bookings" | "messages" | "finance" | "branches" | "customers" | "help" | "rental-terms" | "team" | "settings" | "reports" | "account" }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [tier, setTier] = useState("FREE");
  const [workspaceRole, setWorkspaceRole] = useState<string | null>(null);
  const effectiveRole = workspaceRole || role;
  const [trial, setTrial] = useState<null | { endsAt: string | null; graceEndsAt: string | null; readOnly: boolean }>(null);
  const [selectedFeature, setSelectedFeature] = useState<FeatureKey | null>(null);

  useEffect(() => {
    let current = true;
    fetch(`/api/workspaces/${encodeURIComponent(slug)}/navigation`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Unable to load plan access");
        return response.json();
      })
      .then(data => { if (current && typeof data.tier === "string") setTier(data.tier); if (current && typeof data.role === "string") setWorkspaceRole(data.role); if (current) setTrial(data.trial || null); })
      .catch(() => { if (current) setTier("FREE"); });
    return () => { current = false; };
  }, [slug]);

  const canUse = (feature: FeatureKey) => (tierRank[tier] ?? 0) >= tierRank[lockedFeatures[feature].plan.toUpperCase()];
  async function signOut() {
    setMenuOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const lockedItem = (feature: FeatureKey, label: string, icon: ReactNode) => {
    const info = lockedFeatures[feature];
    return canUse(feature)
      ? <Link className={active === feature ? "active" : ""} href={`/workspace/${slug}/${feature}`}>{icon}{label}</Link>
      : <button type="button" title={`${label} · ${info.plan}`} aria-label={`${label} · ${info.plan} plan`} className="roam-nav-locked" aria-haspopup="dialog" onClick={() => setSelectedFeature(feature)}>{icon}<span className="roam-nav-label">{label}</span><span className="roam-nav-lock-label">{info.plan}</span><LockKeyhole className="roam-nav-lock-icon" size={14}/></button>;
  };

  return <aside className={"roam-sidebar" + (menuOpen ? " roam-sidebar-open" : "") + (desktopCollapsed ? " roam-sidebar-collapsed" : "")}>
    <Link href="/" className="roam-brand" onClick={() => setMenuOpen(false)}><span className="roam-brand-mark">R</span><span>ROAM</span></Link>
    <button className="roam-mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close workspace menu" : "Open workspace menu"} aria-expanded={menuOpen} aria-controls="roam-workspace-menu" onClick={() => setMenuOpen(open => !open)}><span>{menuOpen ? "Close menu" : "Menu"}</span>{menuOpen ? <X size={19}/> : <Menu size={19}/>}</button>
    <button className="roam-desktop-sidebar-toggle" type="button" aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!desktopCollapsed} onClick={() => setDesktopCollapsed(value => !value)} title={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}>{desktopCollapsed ? <ChevronRight size={18}/> : <ChevronLeft size={18}/>}<span>{desktopCollapsed ? "Expand" : "Collapse"}</span></button>
    <div className="roam-side-label">WORKSPACE</div>
    <div className="roam-workspace-name">{name}</div>
    {trial && <div role="status" style={{margin:"10px 12px",padding:"10px 12px",borderRadius:10,border:trial.readOnly?"1px solid #f59e0b":"1px solid #0891b2",background:trial.readOnly?"#fff7ed":"#ecfeff",color:"#164e63",fontSize:12,lineHeight:1.5}}>
      <strong style={{display:"block",color:trial.readOnly?"#9a3412":"#155e75"}}>{trial.readOnly?"Read-only · trial grace ended":"Starter trial"}</strong>
      <span>{trial.readOnly?"Existing records are available.":"Trial ends "+(trial.endsAt?new Date(trial.endsAt).toLocaleDateString("en-PH",{month:"short",day:"numeric"}):"soon")+". A 7-day grace period follows."}</span>
      {effectiveRole==="OWNER" ? <Link href={`/workspace/${slug}/account`} style={{display:"block",marginTop:5,fontWeight:700,color:"#0e7490"}}>Review subscription <ArrowUpRight size={12}/></Link> : <span style={{display:"block",marginTop:5}}>Ask your workspace owner about upgrading.</span>}
    </div>}
    <nav className="roam-side-nav" id="roam-workspace-menu" aria-label="Workspace navigation" onClick={() => setMenuOpen(false)}>
      <Link title="Overview" className={active === "overview" ? "active" : ""} href={`/workspace/${slug}`}><LayoutDashboard size={18}/><span className="roam-nav-label">Overview</span></Link>
      <Link title="Fleet management" className={active === "fleet" ? "active" : ""} href={`/workspace/${slug}/fleet`}><CarFront size={18}/><span className="roam-nav-label">Fleet management</span></Link>
      <Link title="Maintenance & expenses" className={active === "maintenance" ? "active" : ""} href={`/workspace/${slug}/maintenance`}><Wrench size={18}/><span className="roam-nav-label">Maintenance & expenses</span></Link>
      <Link title="Fleet calendar" className={active === "calendar" ? "active" : ""} href={`/workspace/${slug}/calendar`}><CalendarDays size={18}/><span className="roam-nav-label">Fleet calendar</span></Link>
      <Link title="Bookings" className={active === "bookings" ? "active" : ""} href={`/workspace/${slug}/bookings`}><CalendarDays size={18}/><span className="roam-nav-label">Bookings</span></Link>
      <Link title="Customer messages" className={active === "messages" ? "active" : ""} href={`/workspace/${slug}/messages`}><MessageCircle size={18}/><span className="roam-nav-label">Customer messages</span></Link>
      <Link title="Financials" className={active === "finance" ? "active" : ""} href={`/workspace/${slug}/finance`}><Wallet size={18}/><span className="roam-nav-label">Financials</span></Link>
      {lockedItem("branches", "Branches", <MapPin size={18}/>)}
      <Link title="Customers" className={active === "customers" ? "active" : ""} href={`/workspace/${slug}/customers`}><Users size={18}/><span className="roam-nav-label">Customers</span></Link>
      <Link title="Rental terms" className={active === "rental-terms" ? "active" : ""} href={`/workspace/${slug}/rental-terms`}><FileText size={18}/><span className="roam-nav-label">Rental terms</span></Link>
      {lockedItem("team", "Team & access", <UserCog size={18}/>)}
      <Link title="Business settings" className={active === "settings" ? "active" : ""} href={`/workspace/${slug}/settings`}><UserCog size={18}/><span className="roam-nav-label">Business settings</span></Link>
      {effectiveRole === "OWNER" && <Link title="Account & subscription" className={active === "account" ? "active" : ""} href={`/workspace/${slug}/account`}><ShieldCheck size={18}/><span className="roam-nav-label">Account & subscription</span></Link>}
      {lockedItem("reports", "Reports", <UserCog size={18}/>)}
      <Link title="How-to guides" className={active === "help" ? "active" : ""} href={`/workspace/${slug}/help`}><BookOpen size={18}/><span className="roam-nav-label">How-to guides</span></Link>
      <Link href="/admin" title="Platform admin" className="roam-admin-link"><ShieldCheck size={18}/><span className="roam-nav-label">Platform admin</span></Link>
    </nav>
    <div className="roam-sidebar-bottom"><span className="roam-role">{effectiveRole}</span><button type="button" aria-label="Sign out" onClick={signOut}><LogOut size={16}/><span>Sign out</span></button></div>

    {selectedFeature && <div className="roam-feature-lock-backdrop" onClick={() => setSelectedFeature(null)}>
      <section className="roam-feature-lock-dialog" role="dialog" aria-modal="true" aria-labelledby="roam-feature-lock-title" onClick={event => event.stopPropagation()}>
        <button className="roam-feature-lock-close" type="button" aria-label="Close feature information" onClick={() => setSelectedFeature(null)}><X size={18}/></button>
        <span className="roam-feature-lock-kicker"><LockKeyhole size={14}/> AVAILABLE ON {lockedFeatures[selectedFeature].plan.toUpperCase()}</span>
        <h2 id="roam-feature-lock-title">{lockedFeatures[selectedFeature].title}</h2>
        <p>{lockedFeatures[selectedFeature].description}</p>
        <ul>{lockedFeatures[selectedFeature].benefits.map(item => <li key={item}>{item}</li>)}</ul>
        <div className="roam-feature-lock-footer">
          <span>Included from the {lockedFeatures[selectedFeature].plan} plan upward</span>
          {role === "OWNER"
            ? <Link href={`/workspace/${slug}/account`} onClick={() => setSelectedFeature(null)}>View upgrade options <ArrowUpRight size={15}/></Link>
            : <span className="roam-feature-lock-owner-note">Ask your workspace owner about upgrading</span>}
        </div>
      </section>
    </div>}
  </aside>;
}
