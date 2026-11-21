"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Bike, BusFront, CalendarDays, Check, ChevronDown,
  BarChart3, Menu, Moon, ShieldCheck, Sun, Truck, X, CarFront,
  Users, MapPin, Wrench
} from "lucide-react";

function Brand({ light = false }: { light?: boolean }) {
  return <Link className={`brand ${light ? "brand-light" : ""}`} href="/" aria-label="ROAM home">
    <span className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M8 32V8h12.3c7.1 0 11.2 3.5 11.2 9.2 0 4.2-2.4 7.1-6.6 8.3L33 32h-9l-6.9-6.1h-1.5V32H8Zm7.6-12.4h4.5c2.4 0 3.7-.9 3.7-2.6s-1.3-2.6-3.7-2.6h-4.5v5.2Z" fill="currentColor"/><path d="m24 31 8-8" stroke="var(--brand-accent)" strokeWidth="3.2" strokeLinecap="round"/></svg></span>
    <span className="brand-word">ROAM</span>
  </Link>;
}

const features = [
  { icon: CarFront, title: "More ways to find a ride", text: "A planned discovery experience for motorcycles, cars, SUVs, vans, pickups, and other vehicle types from local providers." },
  { icon: Users, title: "Independent hosts and rental teams", text: "Bring individual vehicle owners and established rental businesses into one marketplace experience." },
  { icon: ShieldCheck, title: "A staged trust process", text: "Host profiles and vehicle submissions go through preliminary review before any public marketplace launch." },
  { icon: CalendarDays, title: "Clearer rental conversations", text: "Build toward a more organized journey from discovering a vehicle to discussing rental details with its provider." },
  { icon: BarChart3, title: "Tools behind the listing", text: "Rental businesses can use a ROAM workspace to manage fleet records, bookings, customers, and daily operations." },
  { icon: Wrench, title: "Operations that keep moving", text: "Keep vehicle status, maintenance, expenses, and business activity organized in one connected workspace." }
];

type PublicPlan = {
  id: string;
  tier: string;
  name: string;
  monthlyPrice: number;
  maxVehicles: number | null;
  maxBranches: number | null;
  maxStaff: number | null;
};

function formatPlanPrice(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(value);
}

function formatPlanLimit(value: number | null, singular: string) {
  const plural = singular === "branch" ? "branches" : singular === "workspace member" ? "staff accounts" : singular + "s";
  if (value === null) return "Unlimited " + plural;
  return value + " " + (value === 1 ? singular : plural);
}

function describePlanCapacity(plan: PublicPlan) {
  if (plan.tier === "FREE") return "A no-cost way to manage a small rental operation.";
  if (plan.tier === "ENTERPRISE") return "Custom fleet, branch, and team allowances based on your operation.";
  return `Includes ${formatPlanLimit(plan.maxVehicles, "vehicle")}, ${formatPlanLimit(plan.maxBranches, "branch")}, and ${formatPlanLimit(plan.maxStaff, "workspace member")}.`;
}

function planBenefits(tier: string) {
  const core = [
    "Fleet records and online booking workflow",
    "Customer records, private booking links, and messaging",
    "Vehicle handover and return inspections",
    "Maintenance and operating expense tracking",
  ];
  if (["PRO", "BUSINESS", "ENTERPRISE"].includes(tier)) {
    core.push("Multi-branch management", "Operational reports and CSV export");
  }
  if (["BUSINESS", "ENTERPRISE"].includes(tier)) {
    core.push("Team invitations and role-based access");
  }
  if (tier === "ENTERPRISE") core.push("Custom capacity and plan arrangements by request");
  return core;
}

const steps = [
  ["01", "Tell us what you need", "Renters can join early access; vehicle owners and rental businesses can register host interest."],
  ["02", "Prepare a Host profile", "Interested providers can prepare their business details and vehicle drafts for preliminary review."],
  ["03", "Launch in clear stages", "Public discovery, booking, and any applicable commercial terms will be introduced only after the marketplace is ready."]
];

export default function Home() {
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("roam-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = saved === "dark" || (saved !== "light" && prefersDark);
    const frame = window.requestAnimationFrame(() => setDark(initial));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    let active = true;
    async function loadPlans() {
      try {
        const response = await fetch("/api/public/plans", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load plans.");
        const body = await response.json();
        if (active) setPlans(Array.isArray(body.plans) ? body.plans : []);
      } catch {
        if (active) setPlans([]);
      } finally {
        if (active) setPlansLoading(false);
      }
    }
    void loadPlans();
    return () => { active = false; };
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("roam-theme", next ? "dark" : "light");
  }
  const configuredPlanSummary = plans.map(plan => `${plan.name}: ${plan.tier === "ENTERPRISE" ? "custom pricing" : formatPlanPrice(plan.monthlyPrice) + "/month"} (${describePlanCapacity(plan)})`).join("; ");
  const configuredCapacitySummary = plans.map(plan => `${plan.name} — ${describePlanCapacity(plan)}`).join(" ");
  const faqs = [
    ["What is ROAM Marketplace?", "ROAM is building a vehicle rental marketplace where renters can discover vehicles from independent owners and rental businesses. Public discovery and booking are not live yet."],
    ["Can individual owners and rental businesses join?", "Yes. Both independent vehicle owners and established rental operators can register Host interest. Preliminary onboarding is separate from legal or vehicle verification."],
    ["Can I use ROAM Workspace today?", "Yes. Rental businesses can create a workspace to organize fleet records, bookings, customers, maintenance, and other rental operations."],
    ["What happens after the Workspace free trial?", plans.length ? "Choose the Workspace plan that fits your rental operation: " + configuredPlanSummary + ". These plans cover SaaS operating features and capacity; they are separate from any future marketplace fees or commissions." : "Our Workspace plan options are temporarily unavailable. Please check back shortly."],
    ["When will renters be able to book vehicles?", "We are starting with early-access interest and Host onboarding. Public listings, bookings, payment handling, and marketplace commercial terms will be announced as those parts are ready."],
    ["Does preliminary Host approval mean a vehicle is verified?", "No. A preliminary review is an early screening step only. It is not a certification of identity, ownership, registration, safety, insurance, or legal authority."]
  ];

  return <main className={`site ${dark ? "theme-dark" : ""}`}>
    <header className="site-header">
      <div className="container nav-wrap">
        <Brand />
        <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
          <Link href="/marketplace" onClick={() => setMenuOpen(false)}>Marketplace</Link>
          <Link href="/become-a-host" onClick={() => setMenuOpen(false)}>Become a host</Link>
          <a href="#platform" onClick={() => setMenuOpen(false)}>For operators</a>
          <a href="#plans" onClick={() => setMenuOpen(false)}>Workspace plans</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQs</a>
          <Link className="nav-mobile-cta" href="/register" onClick={() => setMenuOpen(false)}>Start a workspace <ArrowRight size={15}/></Link>
        </nav>
        <div className="nav-actions">
          <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <Link className="text-link" href="/login">Sign in</Link>
          <Link className="btn button button-small button-dark" href="/register">Workspace trial <ArrowRight size={15}/></Link>
          <button className="icon-button menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"}>{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </div>
    </header>

    <section className="hero">
      <div className="hero-grid container">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot"/> THE VEHICLE RENTAL MARKETPLACE</div>
          <h1>Find your ride.<br/><span>Move your world.</span></h1>
          <p className="hero-lead">ROAM is bringing renters, independent vehicle owners, and rental businesses together. Discover the idea, join early access, or prepare to become a Host.</p>
          <div className="hero-actions">
            <Link className="btn button button-primary" href="/marketplace">Explore ROAM Marketplace <ArrowRight size={17}/></Link>
            <Link className="text-link" href="/become-a-host">Become a host <span><ArrowRight size={16}/></span></Link>
          </div>
          <div className="hero-proof"><span className="proof-icon"><ShieldCheck size={16}/></span><span>Built for renters, local vehicle owners, and established rental operators.</span></div>
        </div>
        <div className="hero-art" aria-label="Illustrative preview of the upcoming ROAM vehicle rental marketplace">
          <div className="art-glow"/>
          <div className="dashboard-card">
            <div className="dash-top"><div><span className="dash-kicker">ROAM MARKETPLACE</span><strong>Find a ride that fits</strong></div><span className="dash-avatar">R</span></div>
            <div className="dash-stats">
              <div><span>For renters</span><strong>Explore options</strong><small><i/> By vehicle and location</small></div>
              <div><span>For Hosts</span><strong>Share your fleet</strong><small><i/> Individual or business</small></div>
            </div>
            <div className="fleet-panel">
              <div className="fleet-panel-head"><strong>Vehicle categories</strong><span>MARKETPLACE PREVIEW</span></div>
              <div className="vehicle-line"><span className="vehicle-icon"><Bike size={17}/></span><span>Motorcycles & scooters</span><b>2 wheels</b></div>
              <div className="vehicle-line"><span className="vehicle-icon"><CarFront size={17}/></span><span>Cars, sedans & SUVs</span><b>Everyday</b></div>
              <div className="vehicle-line"><span className="vehicle-icon"><BusFront size={17}/></span><span>MPVs & vans</span><b>Group trips</b></div>
              <div className="vehicle-line"><span className="vehicle-icon"><Truck size={17}/></span><span>Pickups, buses & trucks</span><b>Utility</b></div>
            </div>
            <div className="dash-bottom"><span><i/> ILLUSTRATIVE PREVIEW</span><span>COMING SOON ↗</span></div>
          </div>
          <div className="floating-chip chip-one"><span className="chip-check"><Check size={13}/></span><span><b>For every journey</b><small>More ways to move</small></span></div>
          <div className="floating-chip chip-two"><span className="chip-pin"><MapPin size={15}/></span><span><b>For local Hosts</b><small>Owners and rental teams</small></span></div>
        </div>
      </div>
      <div className="hero-bottom container"><span>RENTERS · VEHICLE HOSTS · RENTAL OPERATORS</span><span className="hero-bottom-line"/><span>PUBLIC DISCOVERY COMING SOON</span></div>
    </section>

    <section className="home-pathways" aria-labelledby="home-pathways-title">
      <div className="container">
        <div className="home-pathways-heading"><div><div className="eyebrow">ONE PLATFORM · THREE WAYS TO TAKE PART</div><h2 id="home-pathways-title">Wherever you sit in the rental journey, there’s a place for you.</h2></div><p>ROAM is developing the marketplace and the tools that help rental providers manage the work behind every trip.</p></div>
        <div className="home-pathways-grid">
          <article className="home-pathway-card"><span className="home-pathway-icon"><CarFront size={21}/></span><p>FOR RENTERS</p><h3>Find your next ride.</h3><span>Tell us where you’re based and what kind of vehicle you’re looking for. Join the early-access list.</span><Link href="/early-access">Get renter early access <ArrowRight size={15}/></Link></article>
          <article className="home-pathway-card home-pathway-featured"><span className="home-pathway-icon"><MapPin size={21}/></span><p>FOR VEHICLE HOSTS</p><h3>Bring your vehicle to ROAM.</h3><span>Independent owners and rental businesses can register their interest and prepare for staged onboarding.</span><Link href="/become-a-host">Become an early Host <ArrowRight size={15}/></Link></article>
          <article className="home-pathway-card"><span className="home-pathway-icon"><BarChart3 size={21}/></span><p>FOR RENTAL OPERATORS</p><h3>Run your operation with clarity.</h3><span>Use a ROAM workspace to organize fleet, bookings, customers, maintenance, and business activity.</span><Link href="/register">Explore ROAM Workspace <ArrowRight size={15}/></Link></article>
        </div>
      </div>
    </section>
    <section className="vehicle-strip"><div className="container vehicle-strip-inner"><span>FROM TWO WHEELS</span><Bike/><span>TO EVERYDAY DRIVES</span><CarFront/><span>TO WORKHORSE FLEETS</span><Truck/><span>ONE ROAM WORKSPACE</span></div></section>

    <section className="section section-platform" id="platform">
      <div className="container">
        <div className="section-intro"><div><div className="eyebrow">THE TOOLS BEHIND EVERY RENTAL</div><h2>More than a listing page. A connected place for the people who make rentals happen.</h2></div><p>ROAM is being shaped around both sides of the rental journey: discovery for renters and practical operating tools for Hosts and rental businesses.</p></div>
        <div className="feature-grid">{features.map(({icon: Icon,title,text},i)=><article className="feature-card" key={title}><div className="feature-top"><span className="feature-icon"><Icon size={20}/></span><span className="feature-number">0{i+1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </div>
    </section>

    <section className="section how-section" id="how-it-works"><div className="container how-grid">
      <div className="how-heading"><div className="eyebrow">BUILT IN STAGES</div><h2>A more connected rental journey starts with the right foundations.</h2><p>We’re opening interest first, preparing Hosts next, and building toward public vehicle discovery and bookings.</p><Link href="/marketplace" className="text-link">See the marketplace roadmap <ArrowRight size={16}/></Link></div>
      <div className="steps">{steps.map(([n,t,d])=><div className="step" key={n}><span className="step-num">{n}</span><div><h3>{t}</h3><p>{d}</p></div><ArrowRight className="step-arrow" size={18}/></div>)}</div>
    </div></section>

    <section className="section plans-section" id="plans"><div className="container plans-inner">
      <div className="plans-copy"><div className="eyebrow">FOR RENTAL OPERATORS</div><h2>ROAM Workspace keeps your rental business in order.</h2><p>These subscription plans cover the operating tools for rental businesses: fleet records, bookings, customers, team access, maintenance, and reporting. Marketplace booking and Host commercial terms will be explained separately before public bookings open.</p><Link className="btn button button-primary" href="/register">Start a 14-day workspace trial <ArrowRight size={16}/></Link><span className="pricing-note">Workspace plans are separate from future marketplace commercial terms.</span></div>
      <div className="plan-preview plan-grid">
        {plansLoading ? <p className="plan-loading" role="status">Loading current plans…</p> : plans.length ? plans.map(plan => {
          const featured = plan.tier === "PRO";
          const isEnterprise = plan.tier === "ENTERPRISE";
          const isFree = plan.tier === "FREE";
          return <article className={`plan-card ${featured ? "plan-featured" : ""}`} key={plan.id}>
            <span className="plan-label">{plan.tier} · {plan.name.toUpperCase()}</span>
            <h3>{isEnterprise ? "Custom pricing" : isFree ? "Complimentary" : <>{formatPlanPrice(plan.monthlyPrice)} <small>/ month</small></>}</h3>
            <p>{describePlanCapacity(plan)} {isEnterprise ? "Talk with ROAM about the right setup for your operation." : "Choose the capacity that matches your rental operation."}</p>
            <ul>
              {plan.tier !== "ENTERPRISE" ? <>
                <li><Check/> {formatPlanLimit(plan.maxVehicles, "vehicle")}</li>
                <li><Check/> {formatPlanLimit(plan.maxBranches, "branch")}</li>
                <li><Check/> {formatPlanLimit(plan.maxStaff, "workspace member")}</li>
              </> : <>
                <li><Check/> Custom vehicle allowance</li>
                <li><Check/> Custom branch allowance</li>
                <li><Check/> Custom staff allowance</li>
              </>}
              {planBenefits(plan.tier).map(benefit => <li key={benefit}><Check/> {benefit}</li>)}
            </ul>
            <div className="plan-benefit">{plan.tier === "FREE" ? "Try ROAM with a small fleet before upgrading." : plan.tier === "STARTER" ? "A low-cost starting point for independent rental operators." : plan.tier === "PRO" ? "For growing operators who need more vehicles, additional branches, and performance reporting." : plan.tier === "BUSINESS" ? "For established rental teams that need shared access, roles, and room to scale." : "Enterprise arrangements are scoped and quoted individually."}</div>
            {isEnterprise ? <Link className="btn plan-choose" href="/register">Create account to request <ArrowRight size={14}/></Link> : <Link className="btn plan-choose" href="/register">{isFree ? "Start complimentary" : "Start free trial"} <ArrowRight size={14}/></Link>}
          </article>;
        }) : <p className="plan-loading" role="status">Plan details are temporarily unavailable. Please check back shortly.</p>}
      </div>
      <div className="plan-inclusions"><div className="plan-inclusions-heading"><div className="eyebrow">FEATURES BY PLAN</div><h3>Start with the essentials. Unlock more as you grow.</h3><p>Each tier is designed for a different stage of rental operations, with clear capacity limits and feature access.</p></div><div className="plan-inclusions-grid">
        <article><span className="plan-inclusion-icon"><CarFront size={19}/></span><h4>Fleet and booking essentials</h4><p>Vehicle profiles, rates, availability, online booking requests, and booking management.</p><small>Included in all plans</small></article>
        <article><span className="plan-inclusion-icon"><Users size={19}/></span><h4>Customer portal and messaging</h4><p>Customer records, private booking links, document uploads, status updates, and customer conversations.</p><small>Included in all plans</small></article>
        <article><span className="plan-inclusion-icon"><ShieldCheck size={19}/></span><h4>Rental terms and inspections</h4><p>Rental terms acceptance plus handover and return inspections with condition notes and photos.</p><small>Included in all plans</small></article>
        <article><span className="plan-inclusion-icon"><Wrench size={19}/></span><h4>Maintenance and expense tracking</h4><p>Schedule vehicle maintenance, record service costs, and track day-to-day operating expenses.</p><small>Included in all plans</small></article>
        <article><span className="plan-inclusion-icon"><BarChart3 size={19}/></span><h4>Multi-branch management and reports</h4><p>Manage additional pickup locations, review operational and financial reports, and export report data as CSV.</p><small>Included from Pro</small></article>
        <article><span className="plan-inclusion-icon"><Users size={19}/></span><h4>Team invitations and role-based access</h4><p>Invite staff, assign workspace roles, and manage access as your rental operation grows.</p><small>Included from Business</small></article>
      </div><p className="plan-limit-note">Plan allowances apply to active vehicles, branches, and workspace members. Enterprise capacity is agreed individually. ROAM records subscription billing but does not currently process payments or automatically renew subscriptions.</p></div>
    </div></section>

    <section className="section faq-section" id="faq"><div className="container faq-grid"><div><div className="eyebrow">GOOD TO KNOW</div><h2>Questions before you get moving?</h2><p>Here are a few things to know about the ROAM platform as it takes shape.</p></div><div className="faq-list">{faqs.map(([q,a],i)=><div className={`faq-item ${faqOpen===i?"faq-active":""}`} key={q}><button onClick={()=>setFaqOpen(faqOpen===i?-1:i)} aria-expanded={faqOpen===i}><span>{q}</span><ChevronDown size={18}/></button>{faqOpen===i&&<p>{a}</p>}</div>)}</div></div></section>

    <section className="contact-section" id="contact"><div className="container contact-card"><div className="contact-orbit"/><div className="eyebrow">GET CLOSER TO THE FIRST RELEASE</div><h2>Be part of the next way to rent and share vehicles.</h2><p>Join as a renter or register as a Host. Rental businesses can also start using ROAM Workspace today.</p><div className="home-final-actions"><Link className="btn button button-light" href="/early-access">Join renter early access <ArrowRight size={17}/></Link><Link className="home-final-host-link" href="/become-a-host">I’m interested in hosting <ArrowRight size={15}/></Link></div><span className="contact-note">Marketplace discovery and booking are not live yet.</span></div></section>

    <footer className="site-footer"><div className="container"><div className="footer-main"><div><Brand/><p>Vehicle Rental Marketplace & Operations Platform</p><span className="footer-tagline">Find your ride. Move your world.</span></div><div className="footer-links"><div><b>EXPLORE</b><Link href="/marketplace">Marketplace</Link><Link href="/early-access">Renter early access</Link><Link href="/become-a-host">Become a Host</Link><a href="#platform">For operators</a><a href="#plans">Workspace plans</a><a href="#faq">FAQs</a></div><div><b>INFORMATION</b><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="#contact">Contact</a></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} ROAM. All rights reserved.</span><span>Built for the people who keep things moving.</span></div></div></footer>
  </main>;
}
