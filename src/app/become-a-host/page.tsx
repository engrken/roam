import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CarFront, ClipboardCheck, Store } from "lucide-react";
import MarketplacePublicShell from "@/components/marketplace-public-shell";
import MarketplaceInterestForm from "@/components/marketplace-interest-form";
export const metadata:Metadata={title:"Become a ROAM Marketplace host",description:"Register your interest as an individual vehicle owner or rental business on the upcoming ROAM Marketplace."};
export default function BecomeAHostPage(){return <MarketplacePublicShell><section className="marketplace-form-page"><div className="container marketplace-form-layout">
 <div className="marketplace-form-intro"><span className="marketplace-status-pill"><i/> FOUNDING HOST INTEREST · OPEN</span><p className="marketplace-kicker">FOR VEHICLE OWNERS & RENTAL BUSINESSES</p>
  <h1>Put your vehicle in the <span>right spotlight.</span></h1><p>ROAM Marketplace is being built to connect renters with vehicles from independent owners and rental operators. Register your interest and help us understand where to launch first.</p>
  <div className="marketplace-host-points">
   <div><span><Store size={18}/></span><p><b>Individuals and businesses</b><small>Both independent vehicle owners and established rental companies can express interest.</small></p></div>
   <div><span><CarFront size={18}/></span><p><b>Multiple vehicle categories</b><small>Motorcycles, cars, SUVs, vans, pickups, and more are in the planned scope.</small></p></div>
   <div><span><ClipboardCheck size={18}/></span><p><b>Staged onboarding</b><small>Early interest is not a listing approval. Vehicle and provider checks will happen before activation.</small></p></div>
   <div><span><BadgeCheck size={18}/></span><p><b>Clear launch requirements</b><small>Commercial terms, host responsibilities, and protection arrangements will be explained before onboarding is finalized.</small></p></div>
  </div><Link className="marketplace-back-link" href="/marketplace">Learn about ROAM Marketplace <ArrowRight size={15}/></Link>
 </div><aside className="marketplace-form-card"><div className="marketplace-form-card-heading"><span className="marketplace-kicker">EARLY HOST INTEREST</span><h2>Tell us about your vehicle plans.</h2><p>Only a few details to help us understand your interest.</p></div><MarketplaceInterestForm type="HOST"/></aside>
</div></section></MarketplacePublicShell>;}
