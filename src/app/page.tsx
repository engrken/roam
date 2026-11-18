import { ArrowRight, CalendarDays, CarFront, ShieldCheck, Sparkles } from "lucide-react";

const capabilities = [
  { icon: CarFront, title: "Fleet operations", description: "Organize motorcycles, cars, SUVs, vans, pickups, and more in one fleet workspace." },
  { icon: CalendarDays, title: "Rental scheduling", description: "Plan reservations, check availability, and keep vehicle handovers organized." },
  { icon: ShieldCheck, title: "Business-ready controls", description: "Build around tenant isolation, staff roles, and subscription-aware operations." }
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="#"><span className="brand-mark">R</span><span>ROAM</span></a>
        <span className="nav-note">RENTAL OPERATIONS PLATFORM</span>
        <a className="nav-link" href="mailto:hello@roam.app">Contact <ArrowRight size={15} /></a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> THE SMARTER WAY TO RUN RENTALS</div>
          <h1>Every rental.<br /><span>One clear view.</span></h1>
          <p className="lead">Manage your fleet, reservations, customers, and daily operations with one connected workspace built for rental businesses.</p>
          <div className="hero-actions">
            <a className="primary-button" href="mailto:hello@roam.app?subject=ROAM%20Early%20Access">Get early access <ArrowRight size={17} /></a>
            <span className="availability-note">A new way to move your rental business forward.</span>
          </div>
          <div className="trust-line"><span className="dot" /> BUILT FOR INDEPENDENT OPERATORS AND GROWING FLEETS</div>
        </div>
        <div className="visual" aria-label="ROAM fleet overview preview">
          <div className="visual-top"><span>YOUR OPERATIONS</span><span className="live"><i /> OVERVIEW</span></div>
          <div className="metric-row">
            <div className="metric"><small>FLEET WORKSPACE</small><strong>All in one</strong><span>Vehicles & branches</span></div>
            <div className="metric"><small>RENTAL FLOW</small><strong>Connected</strong><span>Bookings to returns</span></div>
          </div>
          <div className="fleet-card">
            <div className="fleet-card-head"><span>Fleet categories</span><span>01 / 03</span></div>
            <div className="fleet-bars"><div><span>Motorcycles & scooters</span><b>●</b></div><div className="bar"><i style={{width:"78%"}} /></div><div><span>Cars, SUVs & vans</span><b>●</b></div><div className="bar"><i style={{width:"62%"}} /></div><div><span>Utility & commercial</span><b>●</b></div><div className="bar"><i style={{width:"44%"}} /></div></div>
          </div>
          <div className="visual-foot"><span>MOVE MORE.</span><span>MANAGE SMARTER.</span></div>
          <div className="orb orb-one" /><div className="orb orb-two" />
        </div>
      </section>

      <section className="capabilities">
        <div className="section-heading"><span>ONE PLATFORM. MORE CONTROL.</span><h2>Built around the way rentals work.</h2></div>
        <div className="capability-grid">{capabilities.map(({icon: Icon, title, description}) => <article className="capability" key={title}><div className="cap-icon"><Icon size={20} /></div><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>
      <footer><a className="brand footer-brand" href="#"><span className="brand-mark">R</span><span>ROAM</span></a><span>Rental Operations and Asset Management</span><span>© {new Date().getFullYear()} ROAM</span></footer>
    </main>
  );
}
