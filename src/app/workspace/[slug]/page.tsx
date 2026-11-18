"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, CarFront, CircleDollarSign, Gauge, Users, MapPin, Clock3 } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Overview = {
  workspace: { name: string; slug: string; role: string; currency: string };
  metrics: { totalVehicles:number; availableVehicles:number; rentedVehicles:number; reservedVehicles:number; maintenanceVehicles:number; activeBookings:number; pendingBookings:number; completedBookings:number; customers:number; branches:number; utilization:number; revenue30d:number; bookings7d:number };
  bookingTrend: { date:string; label:string; bookings:number }[];
  upcoming: { id:string; reference:string; status:string; startAt:string; endAt:string; totalAmount:number; customer:string; vehicles:string[] }[];
};

const money=(value:number,currency="PHP")=>new Intl.NumberFormat("en-PH",{style:"currency",currency,maximumFractionDigits:0}).format(value);
const date=(value:string)=>new Date(value).toLocaleDateString("en-PH",{month:"short",day:"numeric"});

export default function WorkspaceOverviewPage() {
  const params=useParams<{slug:string}>();
  const router=useRouter();
  const slug=params.slug;
  const [data,setData]=useState<Overview|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{let live=true;fetch(`/api/workspaces/${encodeURIComponent(slug)}/overview`,{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Unable to load workspace.");return j;}).then(j=>{if(live)setData(j);}).catch(e=>{if(live)setError(e instanceof Error?e.message:"Unable to load dashboard.");}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[slug]);
  async function signOut(){await fetch("/api/auth/logout",{method:"POST"});router.replace("/login");router.refresh();}
  if(loading)return <main className="roam-loading">Loading your business overview…</main>;
  if(error||!data)return <main className="roam-loading"><h1>Workspace unavailable</h1><p>{error}</p><button className="roam-primary-btn" onClick={()=>router.replace("/workspace")}>Back to workspaces</button><button className="roam-quiet-btn" onClick={signOut}>Sign out</button></main>;
  const {workspace,metrics}=data;
  const max=Math.max(1,...data.bookingTrend.map(x=>x.bookings));
  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name={workspace.name} role={workspace.role} active="overview"/>
    <main className="roam-main">
      <header className="roam-topbar"><div><span className="roam-eyebrow">BUSINESS OVERVIEW</span><h1>Good day. Here's your operation.</h1><p>Your fleet and rental activity at a glance.</p></div><div className="roam-topbar-actions"><span className="roam-date-pill"><CalendarDays size={15}/>{new Date().toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric"})}</span><button className="roam-primary-btn" onClick={()=>router.push(`/workspace/${slug}/fleet`)}>Manage fleet <ArrowUpRight size={16}/></button></div></header>
      <section className="roam-metric-grid">
        <article className="roam-metric-card"><div className="roam-metric-icon"><CarFront/></div><span>Total fleet</span><strong>{metrics.totalVehicles}</strong><small>{metrics.availableVehicles} available now</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><CalendarDays/></div><span>Active bookings</span><strong>{metrics.activeBookings}</strong><small>{metrics.pendingBookings} pending confirmation</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><CircleDollarSign/></div><span>Revenue · last 30 days</span><strong>{money(metrics.revenue30d,workspace.currency)}</strong><small>Completed rentals</small></article>
        <article className="roam-metric-card"><div className="roam-metric-icon"><Gauge/></div><span>Fleet utilization</span><strong>{metrics.utilization}%</strong><small>Rented or reserved vehicles</small></article>
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
