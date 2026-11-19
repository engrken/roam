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
  { icon: CarFront, title: "One fleet, every vehicle", text: "Manage motorcycles, scooters, cars, SUVs, MPVs, vans, pickups, buses, and commercial vehicles in one organized workspace." },
  { icon: CalendarDays, title: "Bookings without the back-and-forth", text: "Keep reservations, rental periods, availability, and handovers visible so your team can stay in sync." },
  { icon: Users, title: "Customers and teams, connected", text: "Keep customer records and staff access organized with role-aware tools for your rental operation." },
  { icon: BarChart3, title: "Know how your business is moving", text: "Bring fleet activity, bookings, and business performance into a clearer operational picture." },
  { icon: Wrench, title: "Keep every asset road-ready", text: "Track vehicle status and maintenance needs as part of your day-to-day fleet workflow." },
  { icon: ShieldCheck, title: "Built with business boundaries", text: "A multi-tenant foundation designed to keep each rental business's workspace and records separate." }
];

const steps = [
  ["01", "Set up your rental business", "Create your workspace, add branches, and invite your team."],
  ["02", "Bring your fleet together", "Add your vehicles, rates, and availability in one place."],
  ["03", "Manage the rental journey", "Organize bookings, customers, vehicle handovers, and returns."]
];

export default function Home() {
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("roam-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(saved === "dark" || (saved !== "light" && prefersDark));
  }, []);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("roam-theme", next ? "dark" : "light");
  }
  const faqs = [
    ["What types of vehicles can ROAM manage?", "ROAM is being designed for private vehicle rental operators managing motorcycles, scooters, cars, SUVs, MPVs, vans, pickups, buses, trucks, and other rentable vehicle types."],
    ["Can more than one rental business use ROAM?", "Yes. Each rental business gets its own workspace, team membership, and operational records."],
    ["How do I get started?", "Create an account using your email, verify your one-time code, then create your rental business workspace with a 14-day free trial."],
    ["What happens after the free trial?", "Choose the plan that fits your rental operation: Starter at ₱99/month, Pro at ₱499/month, Business at ₱999/month, or contact us for custom Enterprise pricing."]
  ];

  return <main className={`site ${dark ? "theme-dark" : ""}`}>
    <header className="site-header">
      <div className="container nav-wrap">
        <Brand />
        <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
          <a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#plans" onClick={() => setMenuOpen(false)}>Plans</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>FAQs</a>
          <Link className="nav-mobile-cta" href="/register" onClick={() => setMenuOpen(false)}>Create free account <ArrowRight size={15}/></Link>
        </nav>
        <div className="nav-actions">
          <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <Link className="text-link" href="/login">Sign in</Link>
          <Link className="btn button button-small button-dark" href="/register">Start free <ArrowRight size={15}/></Link>
          <button className="icon-button menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"}>{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </div>
    </header>

    <section className="hero">
      <div className="hero-grid container">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot"/> RENTAL OPERATIONS, REIMAGINED</div>
          <h1>Move more.<br/><span>Manage smarter.</span></h1>
          <p className="hero-lead">A clearer way to run your vehicle rental business. Bring your fleet, bookings, customers, and daily operations together in one connected platform.</p>
          <div className="hero-actions">
            <Link className="btn button button-primary" href="/register">Create your free workspace <ArrowRight size={17}/></Link>
            <Link className="text-link" href="/login">Sign in <span><ArrowRight size={16}/></span></Link>
          </div>
          <div className="hero-proof"><span className="proof-icon"><ShieldCheck size={16}/></span><span>Designed for independent operators and growing rental teams.</span></div>
        </div>
        <div className="hero-art" aria-label="Illustration of a vehicle rental operations dashboard">
          <div className="art-glow"/>
          <div className="dashboard-card">
            <div className="dash-top"><div><span className="dash-kicker">ROAM WORKSPACE</span><strong>Fleet overview</strong></div><span className="dash-avatar">R</span></div>
            <div className="dash-stats">
              <div><span>Fleet visibility</span><strong>All in one place</strong><small><i/> Organized by status</small></div>
              <div><span>Rental workflow</span><strong>Connected</strong><small><i/> From booking to return</small></div>
            </div>
            <div className="fleet-panel">
              <div className="fleet-panel-head"><strong>Vehicle categories</strong><span>FLEET MIX</span></div>
              <div className="vehicle-line"><span className="vehicle-icon"><Bike size={17}/></span><span>Motorcycles & scooters</span><b>2-wheel</b></div>
              <div className="vehicle-line"><span className="vehicle-icon"><CarFront size={17}/></span><span>Cars & SUVs</span><b>Personal</b></div>
              <div className="vehicle-line"><span className="vehicle-icon"><BusFront size={17}/></span><span>Vans & utility vehicles</span><b>Commercial</b></div>
              <div className="vehicle-line"><span className="vehicle-icon"><Truck size={17}/></span><span>Pickups, buses & trucks</span><b>More</b></div>
            </div>
            <div className="dash-bottom"><span><i/> WORKSPACE PREVIEW</span><span>MOVE MORE. ↗</span></div>
          </div>
          <div className="floating-chip chip-one"><span className="chip-check"><Check size={13}/></span><span><b>One connected view</b><small>Fleet and bookings</small></span></div>
          <div className="floating-chip chip-two"><span className="chip-pin"><MapPin size={15}/></span><span><b>Multiple branches</b><small>Built to grow with you</small></span></div>
        </div>
      </div>
      <div className="hero-bottom container"><span>ONE WORKSPACE FOR YOUR RENTAL BUSINESS</span><span className="hero-bottom-line"/><span>PHILIPPINES-READY · ASIA/MANILA TIME</span></div>
    </section>

    <section className="vehicle-strip"><div className="container vehicle-strip-inner"><span>FROM TWO WHEELS</span><Bike/><span>TO EVERYDAY DRIVES</span><CarFront/><span>TO WORKHORSE FLEETS</span><Truck/><span>ONE ROAM WORKSPACE</span></div></section>

    <section className="section section-platform" id="platform">
      <div className="container">
        <div className="section-intro"><div><div className="eyebrow">YOUR BUSINESS, IN BETTER ORDER</div><h2>Everything your rental operation needs to move forward.</h2></div><p>Spend less time switching between lists and messages. ROAM brings the essential parts of rental operations into a shared, structured workspace.</p></div>
        <div className="feature-grid">{features.map(({icon: Icon,title,text},i)=><article className="feature-card" key={title}><div className="feature-top"><span className="feature-icon"><Icon size={20}/></span><span className="feature-number">0{i+1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </div>
    </section>

    <section className="section how-section" id="how-it-works"><div className="container how-grid">
      <div className="how-heading"><div className="eyebrow">A SIMPLE PLACE TO START</div><h2>From scattered operations to a smoother rental flow.</h2><p>Create an account, set up your first rental business, and invite your team when you are ready.</p><Link href="/register" className="text-link">Create a free account <ArrowRight size={16}/></Link></div>
      <div className="steps">{steps.map(([n,t,d])=><div className="step" key={n}><span className="step-num">{n}</span><div><h3>{t}</h3><p>{d}</p></div><ArrowRight className="step-arrow" size={18}/></div>)}</div>
    </div></section>

    <section className="section plans-section" id="plans"><div className="container plans-inner">
      <div className="plans-copy"><div className="eyebrow">SIMPLE, TRANSPARENT PRICING</div><h2>14 days to find your flow. Plans that grow with you.</h2><p>Try ROAM free for 14 days, then choose the subscription that matches your rental operation. Prices are billed monthly in Philippine pesos.</p><Link className="btn button button-primary" href="/register">Start your 14-day free trial <ArrowRight size={16}/></Link><span className="pricing-note">No charge during your trial.</span></div>
      <div className="plan-preview plan-grid">
        <div className="plan-card"><span className="plan-label">STARTER</span><h3>₱99 <small>/ month</small></h3><p>For independent operators getting organized.</p><ul><li><Check/> Core rental workspace</li><li><Check/> Fleet and booking management</li><li><Check/> Customer records</li></ul><Link className="btn plan-choose" href="/register">Start free trial <ArrowRight size={14}/></Link></div>
        <div className="plan-card plan-featured"><span className="plan-label">PRO</span><h3>₱499 <small>/ month</small></h3><p>For growing rental businesses.</p><ul><li><Check/> Everything in Starter</li><li><Check/> More room for daily operations</li><li><Check/> Tools for growing teams</li></ul><Link className="btn plan-choose" href="/register">Start free trial <ArrowRight size={14}/></Link></div>
        <div className="plan-card"><span className="plan-label">BUSINESS</span><h3>₱999 <small>/ month</small></h3><p>For established, expanding operators.</p><ul><li><Check/> Everything in Pro</li><li><Check/> Built for larger operations</li><li><Check/> Support for business growth</li></ul><Link className="btn plan-choose" href="/register">Start free trial <ArrowRight size={14}/></Link></div>
        <div className="plan-card"><span className="plan-label">ENTERPRISE</span><h3>Custom</h3><p>For complex or high-volume rental operations.</p><ul><li><Check/> Tailored plan and pricing</li><li><Check/> Discuss your operational needs</li><li><Check/> Contact ROAM for a quote</li></ul><a className="btn plan-choose" href="#contact">Contact us <ArrowRight size={14}/></a></div>
      </div>
    </div></section>

    <section className="section faq-section" id="faq"><div className="container faq-grid"><div><div className="eyebrow">GOOD TO KNOW</div><h2>Questions before you get moving?</h2><p>Here are a few things to know about the ROAM platform as it takes shape.</p></div><div className="faq-list">{faqs.map(([q,a],i)=><div className={`faq-item ${faqOpen===i?"faq-active":""}`} key={q}><button onClick={()=>setFaqOpen(faqOpen===i?-1:i)} aria-expanded={faqOpen===i}><span>{q}</span><ChevronDown size={18}/></button>{faqOpen===i&&<p>{a}</p>}</div>)}</div></div></section>

    <section className="contact-section" id="contact"><div className="container contact-card"><div className="contact-orbit"/><div className="eyebrow">YOUR NEXT MOVE STARTS HERE</div><h2>Ready to run rentals with more clarity?</h2><p>Create your free account today and set up your first rental business workspace in minutes.</p><Link className="btn button button-light" href="/register">Create your free account <ArrowRight size={17}/></Link><span className="contact-note">Free to get started. No credit card required.</span></div></section>

    <footer className="site-footer"><div className="container"><div className="footer-main"><div><Brand/><p>Rental Operations and Asset Management</p><span className="footer-tagline">Move More. Manage Smarter.</span></div><div className="footer-links"><div><b>EXPLORE</b><a href="#platform">Platform</a><a href="#how-it-works">How it works</a><a href="#plans">Plans</a><a href="#faq">FAQs</a></div><div><b>INFORMATION</b><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="#contact">Contact</a></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} ROAM. All rights reserved.</span><span>Built for the people who keep things moving.</span></div></div></footer>
  </main>;
}
