import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CarFront, MapPin, ShieldCheck, Store, Users } from "lucide-react";
import MarketplacePublicShell from "@/components/marketplace-public-shell";
export const metadata:Metadata={title:"ROAM Marketplace — Vehicle rentals are coming soon",description:"Discover vehicles from independent owners and rental businesses. Join the ROAM Marketplace early-access list."};
const benefits=[
 {icon:CarFront,title:"More ways to find a ride",text:"Explore motorcycles, cars, SUVs, vans, and more in one place."},
 {icon:MapPin,title:"Discover by destination",text:"Find vehicle options around the city or destination you plan to visit."},
 {icon:Store,title:"Local owners and rental teams",text:"Compare options from independent vehicle hosts and established rental businesses."},
 {icon:ShieldCheck,title:"Designed around trust",text:"Verification, clear rental terms, and protection workflows are part of the product plan before public bookings open."}
];
export default function MarketplacePage(){return <MarketplacePublicShell>
 <section className="marketplace-public-hero"><div className="container marketplace-public-grid"><div className="marketplace-public-copy">
  <span className="marketplace-status-pill"><i/> MARKETPLACE · COMING SOON</span><p className="marketplace-kicker">A NEW WAY TO GET MOVING</p>
  <h1>Find a ride that fits <span>your journey.</span></h1>
  <p className="marketplace-public-lead">ROAM is building a vehicle rental marketplace where you can discover and compare vehicles offered by independent owners and rental businesses.</p>
  <div className="marketplace-hero-actions"><Link className="marketplace-primary-button" href="/early-access">Get renter early access <ArrowRight size={17}/></Link><Link className="marketplace-secondary-button" href="/become-a-host">List your vehicle <ArrowRight size={17}/></Link></div>
  <div className="marketplace-mini-proof"><Users size={16}/> Built for travelers, local renters, vehicle owners, and rental businesses.</div>
 </div><div className="marketplace-preview-card" aria-label="Illustrative marketplace preview">
  <div className="marketplace-preview-top"><span>ROAM MARKETPLACE</span><span className="marketplace-preview-coming">PREVIEW</span></div>
  <div className="marketplace-preview-visual"><CarFront size={54}/><span>Find your next ride</span><small>Cars · Motorcycles · SUVs · Vans</small></div>
  <div className="marketplace-preview-search"><span><MapPin size={15}/> Where are you going?</span><span>Explore vehicles <ArrowRight size={14}/></span></div>
  <div className="marketplace-preview-tags"><span>Flexible vehicle choices</span><span>Local providers</span><span>One discovery place</span></div><p>Illustrative preview. Vehicle listings and booking are not live yet.</p>
 </div></div></section>
 <section className="marketplace-public-section"><div className="container"><div className="marketplace-section-heading"><p className="marketplace-kicker">THE MARKETPLACE IDEA</p><h2>One place to discover local vehicle rentals.</h2><p>We’re starting with early-access signups and provider interest while we build the marketplace in stages.</p></div>
  <div className="marketplace-benefit-grid">{benefits.map(({icon:Icon,title,text})=><article className="marketplace-benefit-card" key={title}><span><Icon size={21}/></span><h3>{title}</h3><p>{text}</p></article>)}</div>
 </div></section>
 <section className="marketplace-role-section"><div className="container marketplace-role-grid">
  <article><span className="marketplace-role-icon"><CarFront size={22}/></span><p className="marketplace-kicker">FOR RENTERS</p><h2>Your next trip starts with the right ride.</h2><p>Tell us where you’re based and which type of vehicle you may need. We’ll use that interest to guide the first launch locations and categories.</p><Link className="marketplace-inline-link" href="/early-access">Join renter early access <ArrowRight size={16}/></Link></article>
  <article><span className="marketplace-role-icon"><Store size={22}/></span><p className="marketplace-kicker">FOR VEHICLE HOSTS</p><h2>Make your available vehicle discoverable.</h2><p>Individuals and rental businesses can register interest in joining the first group of ROAM Marketplace providers.</p><Link className="marketplace-inline-link" href="/become-a-host">Become an early host <ArrowRight size={16}/></Link></article>
 </div></section>
 <section className="marketplace-final-cta"><div className="container"><p className="marketplace-kicker">HELP SHAPE THE FIRST RELEASE</p><h2>Be part of the first ROAM Marketplace community.</h2><p>Marketplace interest is open. Public vehicle discovery and booking will follow in later releases.</p><div className="marketplace-hero-actions"><Link className="marketplace-primary-button" href="/early-access">I’m looking to rent <ArrowRight size={16}/></Link><Link className="marketplace-light-button" href="/become-a-host">I have a vehicle to list <ArrowRight size={16}/></Link></div></div></section>
</MarketplacePublicShell>;}
