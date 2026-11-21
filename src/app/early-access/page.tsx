import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Search } from "lucide-react";
import MarketplacePublicShell from "@/components/marketplace-public-shell";
import MarketplaceInterestForm from "@/components/marketplace-interest-form";
export const metadata:Metadata={title:"ROAM Marketplace renter early access",description:"Join the early-access list for the upcoming ROAM vehicle rental marketplace."};
export default function RenterEarlyAccessPage(){return <MarketplacePublicShell><section className="marketplace-form-page"><div className="container marketplace-form-layout">
 <div className="marketplace-form-intro"><span className="marketplace-status-pill"><i/> RENTER EARLY ACCESS · OPEN</span><p className="marketplace-kicker">FOR TRAVELERS & LOCAL RENTERS</p>
  <h1>Your next journey deserves the <span>right ride.</span></h1><p>We’re preparing a simpler way to discover vehicles from local hosts and rental businesses. Join the early-access list and tell us where and what you might want to rent.</p>
  <div className="marketplace-host-points">
   <div><span><Search size={18}/></span><p><b>Discover more choices</b><small>Explore vehicle options from different local providers in one place.</small></p></div>
   <div><span><MapPin size={18}/></span><p><b>Help choose launch locations</b><small>Your city and vehicle preferences help us understand where demand is building.</small></p></div>
   <div><span><CalendarDays size={18}/></span><p><b>Get launch updates</b><small>We’ll contact you about early access and future marketplace availability.</small></p></div>
  </div><Link className="marketplace-back-link" href="/marketplace">Learn about ROAM Marketplace <ArrowRight size={15}/></Link>
 </div><aside className="marketplace-form-card"><div className="marketplace-form-card-heading"><span className="marketplace-kicker">RENTER EARLY ACCESS</span><h2>What would you like to rent?</h2><p>Join the list so we can shape the first launch around real demand.</p></div><MarketplaceInterestForm type="RENTER"/></aside>
</div></section></MarketplacePublicShell>;}
