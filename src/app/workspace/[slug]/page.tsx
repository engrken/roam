"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, CarFront, CircleDollarSign, Gauge, Users, MapPin, Clock3, Share2, Copy, Check } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Overview = {
  workspace: { name: string; slug: string; role: string; currency: string; trial: null | { endsAt: string | null; graceEndsAt: string | null; readOnly: boolean } };
  metrics: { totalVehicles:number; availableVehicles:number; rentedVehicles:number; reservedVehicles:number; maintenanceVehicles:number; activeBookings:number; pendingBookings:number; completedBookings:number; customers:number; branches:number; utilization:number; completedValue30d:number; collected30d:number; outstandingBalance:number; bookings7d:number };
  actionCenter: {
    pendingCount:number;
    pendingItems:{id:string;reference:string;customer:string;startAt:string;endAt:string;totalAmount?:number}[];
    pickupsToday:{id:string;reference:string;customer:string;startAt:string;endAt:string}[];
    returnsToday:{id:string;reference:string;customer:string;startAt:string;endAt:string}[];
    overdueReturns:{id:string;reference:string;customer:string;startAt:string;endAt:string}[];
    outstandingCount:number;
  };
  bookingTrend: { date:string; label:string; bookings:number }[];
  upcoming: { id:string; reference:string; status:string; startAt:string; endAt:string; totalAmount:number; customer:string; vehicles:string[] }[];
};

const money=(value:number,currency="PHP")=>new Intl.NumberFormat("en-PH",{style:"currency",currency,maximumFractionDigits:0}).format(value);

export default function WorkspaceOverviewPage() {
  const params=useParams<{slug:string}>();
  const router=useRouter();
  const slug=params.slug;
  const [data,setData]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [showGettingStarted,setShowGettingStarted]=useState(true);
  const [showShareOptions,setShowShareOptions]=useState(false);
  const [shareCopied,setShareCopied]=useState(false);
  const bookingUrl=typeof window !== "undefined" ? `${window.location.origin}/${encodeURIComponent(slug)}/book` : `https://roamph.vercel.app/${encodeURIComponent(slug)}/book`;
  const shareMessage=`Book your next rental with ${data?.workspace.name || "us"}! View available vehicles and send a booking request: ${bookingUrl}`;
  async function copyBookingLink(){
    try{await navigator.clipboard.writeText(bookingUrl);setShareCopied(true);window.setTimeout(()=>setShareCopied(false),2200);}
    catch{setError("Unable to copy the booking link. Please copy it from your browser address bar.");}
  }
  useEffect(()=>{let live=true;fetch(`/api/workspaces/${encodeURIComponent(slug)}/overview`,{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Unable to load workspace.");return j;}).then(j=>{if(live)setData(j);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Unable to load dashboard.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[slug]);
  async function signOut(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/login");router.refresh();}
  if(loading)return <main className="roam-loading">Loading your business overview…</main>;
  if(error||!data)return <main className="roam-loading"><h1>Workspace unavailable</h1><p>{error}</p><button className="roam-primary-btn" onClick={()=>router.replace("/workspace")}>Back to workspaces</button><button className="roam-quiet-btn" onClick={signOut}>Sign out</button></main>;
  const {workspace,metrics}=data;
  const max=Math.max(1,...data.bookingTrend.map(x=>x.bookings));
  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name={workspace.name} role={workspace.role} active="overview"/>
    <main className="roam-main">
      {workspace.trial && <section className="roam-panel" role="status" style={{borderColor:workspace.trial.readOnly?"#b45309":"#0e7490",background:workspace.trial.readOnly?"#fff7ed":"#ecfeff",color:"#172033"}}><div className="roam-panel-heading"><div><span className="roam-eyebrow">{workspace.trial.readOnly?"TRIAL GRACE PERIOD ENDED":"STARTER TRIAL"}</span><h2>{workspace.trial.readOnly?"Your workspace is now read-only":"Your 14-day trial is active"}</h2><p className="roam-guide-description">{workspace.trial.readOnly?"You can still view your existing records. Ask the workspace owner to request a paid plan; normal editing will resume after admin approval.":workspace.trial.endsAt?"Trial ends "+new Date(workspace.trial.endsAt).toLocaleDateString("en-PH",{dateStyle:"long"})+". After expiry, you have a 7-day grace period before this workspace becomes read-only.": "Your trial is active."}</p></div><button className="roam-primary-btn" onClick={()=>router.push(`/workspace/${slug}/account`)}>Account & subscription <ArrowUpRight size={15}/></button></div></section>}
      <header className="roam-topbar"><div><span className="roam-eyebrow">BUSINESS OVERVIEW</span><h1>Good day. Here&apos;s your operation.</h1><p>Your fleet and rental activity at a glance.</p></div><div className="roam-topbar-actions"><span className="roam-date-pill"><CalendarDays size={15}/>{new Date().toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric"})}</span><button className="roam-secondary-btn" onClick={()=>setShowShareOptions(v=>!v)} aria-expanded={showShareOptions}><Share2 size={16}/> Share booking page</button><button className="roam-primary-btn" onClick={()=>router.push(`/workspace/${slug}/fleet`)}>Manage fleet <ArrowUpRight size={16}/></button></div></header>
      {showShareOptions && <section className="roam-panel" aria-label="Share your public booking page"><div className="roam-panel-heading"><div><span className="roam-eyebrow">GET MORE BOOKINGS</span><h2>Share your booking page</h2></div><button className="roam-quiet-btn" onClick={()=>setShowShareOptions(false)}>Close</button></div><p className="roam-guide-description">Post this public link on your social media pages so customers can view your vehicles and send booking requests.</p><div className="roam-share-link-row"><span>{bookingUrl}</span><button className="roam-primary-btn" onClick={copyBookingLink}>{shareCopied?<Check size={15}/>:<Copy size={15}/>} {shareCopied?"Copied":"Copy link"}</button></div><div className="roam-share-socials"><a className="roam-secondary-btn" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(bookingUrl)}`} target="_blank" rel="noopener noreferrer">Share on Facebook <ArrowUpRight size={14}/></a><a className="roam-secondary-btn" href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp <ArrowUpRight size={14}/></a><button className="roam-secondary-btn" onClick={async()=>{if(navigator.share){try{await navigator.share({title:`Book with ${workspace.name}`,text:shareMessage,url:bookingUrl});}catch(e){if(e instanceof Error&&e.name!=="AbortError")setError("Unable to open the share sheet.");}}else{await copyBookingLink();}}}><Share2 size={15}/> More sharing options</button></div></section>}
      {showGettingStarted && <section className="roam-panel roam-getting-started">
        <div className="roam-panel-heading">
          <div><span className="roam-eyebrow">NEW TO ROAM?</span><h2>Getting started with your rental workspace</h2></div>
          <button className="roam-quiet-btn" onClick={()=>setShowGettingStarted(false)} aria-label="Dismiss getting started guide">Dismiss</button>
        </div>
        <p className="roam-guide-description">Follow these steps to prepare your business before sharing your booking page with customers.</p>
        <div className="roam-guide-steps">
          <button className="roam-guide-step" onClick={()=>router.push(`/workspace/${slug}/branches`)}>
            <span className="roam-guide-number">01</span><span><b>Set up your pickup branch</b><small>Confirm your branch name, address and customer pickup details.</small></span><ArrowUpRight size={17}/>
          </button>
          <button className="roam-guide-step" onClick={()=>router.push(`/workspace/${slug}/fleet`)}>
            <span className="roam-guide-number">02</span><span><b>Add your vehicles</b><small>Enter each vehicle, its daily rate, deposit and availability.</small></span><ArrowUpRight size={17}/>
          </button>
          <button className="roam-guide-step" onClick={()=>router.push(`/workspace/${slug}/rental-terms`)}>
            <span className="roam-guide-number">03</span><span><b>Review your rental terms</b><small>Set the conditions customers must accept when requesting a booking.</small></span><ArrowUpRight size={17}/>
          </button>
          <button className="roam-guide-step" onClick={()=>router.push(`/workspace/${slug}/help#getting-started`)}>
            <span className="roam-guide-number">04</span><span><b>Read the complete setup guide</b><small>See step-by-step instructions for bookings, inspections and team access.</small></span><ArrowUpRight size={17}/>
          </button>
        </div>
        <div className="roam-guide-footer"><span>{metrics.totalVehicles > 0 ? "Your fleet has been started." : "Tip: add at least one available vehicle before sharing your booking page."}</span><button className="roam-link-btn" onClick={()=>router.push(`/workspace/${slug}/bookings`)}>Go to bookings <ArrowUpRight size={14}/></button></div>
      </section>}
      <section className="roam-metric-grid">
        <article className="roam-metric-card"><div className="roam-metric-icon"><CarFront/></div><span>Total fleet</span><strong>{metrics.totalVehicles}</strong><small>{metrics.availableVehicles} available now</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><CalendarDays/></div><span>Active bookings</span><strong>{metrics.activeBookings}</strong><small>{metrics.pendingBookings} pending confirmation</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><CircleDollarSign/></div><span>Completed booking value · 30 days</span><strong>{money(metrics.completedValue30d,workspace.currency)}</strong><small>Completed rental value, not cash collected</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><Gauge/></div><span>Fleet utilization</span><strong>{metrics.utilization}%</strong><small>Rented or reserved vehicles</small></article>
      </section>
      <section className="roam-panel roam-action-center">
        <div className="roam-panel-heading">
          <div><span className="roam-eyebrow">DAILY OPERATIONS</span><h2>Action center</h2><p className="roam-guide-description">The bookings and follow-ups that need attention today.</p></div>
          <button className="roam-link-btn" onClick={()=>router.push(`/workspace/${slug}/bookings`)}>Open bookings <ArrowUpRight size={14}/></button>
        </div>
        <div className="roam-action-grid">
          <article className="roam-action-card">
            <div><b>Pending requests</b><strong>{data.actionCenter.pendingCount}</strong></div>
            {data.actionCenter.pendingItems.length ? data.actionCenter.pendingItems.slice(0,3).map(item=><button key={item.id} onClick={()=>router.push(`/workspace/${slug}/bookings`)}><span><b>{item.customer}</b><small>#{item.reference}</small></span><small>{new Date(item.startAt).toLocaleDateString("en-PH",{month:"short",day:"numeric"})}</small></button>) : <p>You&apos;re all caught up.</p>}
          </article>
          <article className="roam-action-card">
            <div><b>Pickups today</b><strong>{data.actionCenter.pickupsToday.length}</strong></div>
            {data.actionCenter.pickupsToday.length ? data.actionCenter.pickupsToday.slice(0,3).map(item=><button key={item.id} onClick={()=>router.push(`/workspace/${slug}/bookings`)}><span><b>{item.customer}</b><small>#{item.reference}</small></span><small>{new Date(item.startAt).toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"})}</small></button>) : <p>No scheduled pickups today.</p>}
          </article>
          <article className="roam-action-card">
            <div><b>Returns today</b><strong>{data.actionCenter.returnsToday.length}</strong></div>
            {data.actionCenter.returnsToday.length ? data.actionCenter.returnsToday.slice(0,3).map(item=><button key={item.id} onClick={()=>router.push(`/workspace/${slug}/bookings`)}><span><b>{item.customer}</b><small>#{item.reference}</small></span><small>{new Date(item.endAt).toLocaleTimeString("en-PH",{hour:"numeric",minute:"2-digit"})}</small></button>) : <p>No scheduled returns today.</p>}
          </article>
          <article className={"roam-action-card"+(data.actionCenter.overdueReturns.length?" roam-action-warning":"")}>
            <div><b>Overdue returns</b><strong>{data.actionCenter.overdueReturns.length}</strong></div>
            {data.actionCenter.overdueReturns.length ? data.actionCenter.overdueReturns.slice(0,3).map(item=><button key={item.id} onClick={()=>router.push(`/workspace/${slug}/bookings`)}><span><b>{item.customer}</b><small>#{item.reference}</small></span><small>Past due</small></button>) : <p>No overdue returns.</p>}
          </article>
        </div>
        <div className="roam-action-finance">
          <div><span>Recorded collections · last 30 days</span><b>{money(metrics.collected30d,workspace.currency)}</b><small>Payments less recorded refunds</small></div>
          <div><span>Outstanding balances</span><b>{money(metrics.outstandingBalance,workspace.currency)}</b><small>{data.actionCenter.outstandingCount} bookings with a balance</small></div>
          <button className="roam-secondary-btn" onClick={()=>router.push(`/workspace/${slug}/finance`)}>Review financials <ArrowUpRight size={15}/></button>
        </div>
      </section>
      <section className="roam-dashboard-grid">
        <article className="roam-panel roam-chart-panel">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">BOOKING ACTIVITY</span><h2>Bookings this week</h2></div><span className="roam-panel-total">{metrics.bookings7d} total</span></div>
          <div className="roam-chart" role="img" aria-label="Bookings by day for the last seven days">{data.bookingTrend.map(day=><div className="roam-chart-column" key={day.date}><span>{day.bookings}</span><div className="roam-chart-track"><i style={{height:`${Math.max(5,day.bookings/max*100)}%`}}/></div><small>{day.label}</small></div>)}</div>
        </article>
        <article className="roam-panel">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">FLEET HEALTH</span><h2>Vehicle status</h2></div><button className="roam-link-btn" onClick={()=>router.push(`/workspace/${slug}/fleet`)}>View fleet <ArrowUpRight size={14}/></button></div>
          <div className="roam-status-list">
            {[["Available",metrics.availableVehicles,"available"],["Rented",metrics.rentedVehicles,"rented"],["Reserved",metrics.reservedVehicles,"reserved"],["Maintenance",metrics.maintenanceVehicles,"maintenance"]].map(([label,count,key])=><div className="roam-status-row" key={key}><span><i className={`roam-status-dot ${key}`}/>{label}</span><b>{count}</b></div>)}
          </div>
          <div className="roam-utilization"><div><span>Utilization</span><b>{metrics.utilization}%</b></div><div className="roam-progress"><i style={{width:`${metrics.utilization}%`}}/></div></div>
        </article>
      </section>
      <section className="roam-dashboard-grid roam-lower-grid">
        <article className="roam-panel">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">NEXT ON THE CALENDAR</span><h2>Upcoming rentals</h2></div><span className="roam-panel-total">{data.upcoming.length} shown</span></div>
          {data.upcoming.length ? <div className="roam-booking-list">{data.upcoming.map(b=><div className="roam-booking-row" key={b.id}><div className="roam-booking-date"><b>{new Date(b.startAt).toLocaleDateString("en-PH",{day:"2-digit"})}</b><small>{new Date(b.startAt).toLocaleDateString("en-PH",{month:"short"})}</small></div><div className="roam-booking-info"><b>{b.customer}</b><span>{b.reference} · {b.vehicles.join(", ")||"Vehicle pending"}</span></div><span className={`roam-booking-badge ${b.status.toLowerCase()}`}>{b.status}</span></div>)}</div>:<div className="roam-empty"><CalendarDays size={25}/><b>No upcoming rentals</b><span>Confirmed bookings will appear here.</span></div>}
        </article>
        <article className="roam-panel roam-quick-panel">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">YOUR BUSINESS</span><h2>Workspace snapshot</h2></div></div>
          <div className="roam-snapshot-row"><span><Users size={17}/> Customers</span><b>{metrics.customers}</b></div>
          <div className="roam-snapshot-row"><span><MapPin size={17}/> Active branches</span><b>{metrics.branches}</b></div>
          <div className="roam-snapshot-row"><span><Clock3 size={17}/> Completed rentals</span><b>{metrics.completedBookings}</b></div>
          <button className="roam-secondary-btn" onClick={()=>router.push(`/workspace/${slug}/fleet`)}>Open fleet management <ArrowUpRight size={15}/></button>
        </article>
      </section>
      <footer className="roam-footer">ROAM · Rental Operations and Asset Management <span>All figures reflect this workspace only.</span></footer>
    </main>
  </div>;
}
