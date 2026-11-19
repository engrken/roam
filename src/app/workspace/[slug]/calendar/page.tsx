"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";

type Vehicle = { id: string; make: string; model: string; plateNumber: string; status: string; branch: string };
type Booking = { id: string; reference: string; status: string; startAt: string; endAt: string; customer: string; vehicleIds: string[] };
type CalendarData = { timeZone: string; vehicles: Vehicle[]; bookings: Booking[] };

function dateKey(date: Date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function mondayOf(date: Date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}
function addDays(date: Date, count: number) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  value.setDate(value.getDate() + count);
  return value;
}
function localKey(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}
function moneyDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export default function FleetCalendarPage() {
  const { slug } = useParams<{ slug: string }>();
  const [anchor, setAnchor] = useState(() => new Date());
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const weekStart = useMemo(() => mondayOf(anchor), [anchor]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const from = dateKey(days[0]);
  const to = dateKey(days[6]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/calendar?from=${from}&to=${to}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load fleet calendar.");
      setData(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load fleet calendar.");
    } finally { setLoading(false); }
  }, [slug, from, to]);

  useEffect(() => { void load(); }, [load]);
  const timeZone = data?.timeZone || "Asia/Manila";
  const title = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone }).format(new Date(dateKey(days[3]) + "T12:00:00Z"));

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Fleet availability" role="Workspace team" active="calendar" />
    <main className="roam-main">
      <header className="roam-topbar">
        <div><Link href={`/workspace/${slug}`} className="roam-back-link"><ArrowLeft size={14}/> Overview</Link><span className="roam-eyebrow">FLEET PLANNING</span><h1>Fleet calendar</h1><p>See which vehicles are booked, active, or in maintenance across the week.</p></div>
        <div className="roam-topbar-actions"><button className="roam-secondary-btn" onClick={() => setAnchor(new Date())}>Today</button><button className="roam-secondary-btn" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div>
      </header>
      <section className="roam-panel roam-fleet-calendar">
        <div className="roam-calendar-toolbar"><div><span className="roam-eyebrow">WEEKLY AVAILABILITY</span><h2>{title}</h2><small>{new Intl.DateTimeFormat("en-PH", { timeZone, dateStyle: "medium" }).format(new Date(dateKey(days[0])+"T12:00:00Z"))} – {new Intl.DateTimeFormat("en-PH", { timeZone, dateStyle: "medium" }).format(new Date(dateKey(days[6])+"T12:00:00Z"))} · {timeZone}</small></div><div className="roam-calendar-nav"><button aria-label="Previous week" onClick={() => setAnchor(value => addDays(value, -7))}><ChevronLeft size={18}/></button><button aria-label="Next week" onClick={() => setAnchor(value => addDays(value, 7))}><ChevronRight size={18}/></button></div></div>
        <div className="roam-calendar-legend"><span><i className="pending"/> Pending request</span><span><i className="confirmed"/> Confirmed</span><span><i className="active"/> Active rental</span><span><i className="maintenance"/> Maintenance</span></div>
        {error && <p className="roam-error" role="alert">{error}</p>}
        {loading ? <div className="roam-empty"><CalendarDays size={26}/><span>Loading availability…</span></div> : !data?.vehicles.length ? <div className="roam-empty"><CalendarDays size={28}/><b>No vehicles yet</b><span>Add vehicles to see their booking schedules.</span><Link className="roam-primary-btn" href={`/workspace/${slug}/fleet`}>Manage fleet</Link></div> :
          <div className="roam-calendar-scroll"><div className="roam-calendar-grid">
            <div className="roam-calendar-head roam-calendar-vehicle-head">Vehicle</div>
            {days.map(day => <div className={"roam-calendar-head"+(dateKey(day)===dateKey(new Date())?" is-today":"")} key={dateKey(day)}><b>{new Intl.DateTimeFormat("en-PH",{timeZone,weekday:"short"}).format(new Date(dateKey(day)+"T12:00:00Z"))}</b><span>{new Intl.DateTimeFormat("en-PH",{timeZone,month:"short",day:"numeric"}).format(new Date(dateKey(day)+"T12:00:00Z"))}</span></div>)}
            {data.vehicles.map(vehicle => <div className="roam-calendar-row" key={vehicle.id}>
              <div className="roam-calendar-vehicle"><b>{vehicle.make} {vehicle.model}</b><span>{vehicle.plateNumber}</span><small>{vehicle.branch}</small>{vehicle.status==="MAINTENANCE"&&<em>Maintenance</em>}{vehicle.status==="INACTIVE"&&<em>Inactive</em>}</div>
              {days.map(day => {
                const key = dateKey(day);
                const matches = data.bookings.filter(booking => booking.vehicleIds.includes(vehicle.id) && localKey(booking.startAt,timeZone)<=key && localKey(booking.endAt,timeZone)>=key);
                return <div className={"roam-calendar-cell"+(key===dateKey(new Date())?" is-today":"")} key={vehicle.id+key}>
                  {vehicle.status==="MAINTENANCE" && <span className="roam-calendar-maintenance">Unavailable</span>}
                  {matches.map(booking => <Link key={booking.id} href={`/workspace/${slug}/bookings`} className={"roam-calendar-booking "+booking.status.toLowerCase()} title={booking.customer+" · "+booking.reference}>
                    <b>{booking.customer}</b><span>#{booking.reference}</span><small>{moneyDate(booking.startAt,timeZone)} – {moneyDate(booking.endAt,timeZone)}</small>
                  </Link>)}
                  {!matches.length && vehicle.status!=="MAINTENANCE" && <span className="roam-calendar-free">Available</span>}
                </div>;
              })}
            </div>)}
          </div></div>}
        <p className="roam-calendar-note">Pending requests are shown as provisional holds. Availability is rechecked when a customer submits a booking and when the team confirms it. Maintenance status is shown from the vehicle record; scheduled maintenance blocks are not yet separate calendar events.</p>
      </section>
      <footer className="roam-footer">ROAM Fleet Calendar <span>Only bookings in this workspace are shown.</span></footer>
    </main>
    <style jsx>{`
      .roam-fleet-calendar{margin-top:18px}
      .roam-calendar-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
      .roam-calendar-toolbar h2{font-size:20px;margin:5px 0}.roam-calendar-toolbar small{font-size:11px;color:var(--roam-muted,#64748b)}
      .roam-calendar-nav{display:flex;gap:7px}.roam-calendar-nav button{width:36px;height:36px;border:1px solid var(--roam-border,#dbe2ea);border-radius:9px;background:var(--roam-card,#fff);color:inherit;display:grid;place-items:center;cursor:pointer}
      .roam-calendar-legend{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 14px}.roam-calendar-legend span{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--roam-muted,#64748b)}.roam-calendar-legend i{width:8px;height:8px;border-radius:50%;background:#94a3b8}.roam-calendar-legend i.pending{background:#d97706}.roam-calendar-legend i.confirmed{background:#2563eb}.roam-calendar-legend i.active{background:#059669}.roam-calendar-legend i.maintenance{background:#64748b}
      .roam-calendar-scroll{overflow:auto;border:1px solid var(--roam-border,#e2e8f0);border-radius:10px}
      .roam-calendar-grid{display:grid;grid-template-columns:180px repeat(7,minmax(135px,1fr));min-width:1125px}
      .roam-calendar-head{display:flex;flex-direction:column;gap:3px;padding:11px 9px;background:var(--roam-surface,#f8fafc);border-left:1px solid var(--roam-border,#e2e8f0);border-bottom:1px solid var(--roam-border,#e2e8f0);font-size:11px}.roam-calendar-head b{font-size:12px}.roam-calendar-head span{color:var(--roam-muted,#64748b)}.roam-calendar-head.is-today{background:color-mix(in srgb,#0d9488 10%,var(--roam-surface,#f8fafc))}
      .roam-calendar-vehicle-head{border-left:0;font-weight:700}
      .roam-calendar-row{display:contents}
      .roam-calendar-vehicle{display:flex;flex-direction:column;gap:4px;padding:11px 10px;border-bottom:1px solid var(--roam-border,#e2e8f0);background:var(--roam-card,#fff);font-size:11px;min-width:0}.roam-calendar-vehicle b{font-size:12px}.roam-calendar-vehicle span,.roam-calendar-vehicle small{color:var(--roam-muted,#64748b)}.roam-calendar-vehicle em{font-style:normal;color:#b45309;font-weight:700;font-size:10px}
      .roam-calendar-cell{display:flex;flex-direction:column;gap:5px;min-height:94px;padding:6px;border-left:1px solid var(--roam-border,#e2e8f0);border-bottom:1px solid var(--roam-border,#e2e8f0);background:var(--roam-card,#fff);min-width:0}.roam-calendar-cell.is-today{background:color-mix(in srgb,#0d9488 5%,var(--roam-card,#fff))}
      .roam-calendar-booking{display:grid;gap:2px;padding:7px;border-radius:7px;border-left:3px solid #2563eb;background:#eff6ff;color:#1e3a8a;text-decoration:none;min-width:0}.roam-calendar-booking.pending{border-color:#d97706;background:#fffbeb;color:#92400e}.roam-calendar-booking.active{border-color:#059669;background:#ecfdf5;color:#065f46}.roam-calendar-booking b{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.roam-calendar-booking span,.roam-calendar-booking small{font-size:9px;opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.roam-calendar-free,.roam-calendar-maintenance{font-size:9px;color:var(--roam-muted,#94a3b8);padding:5px 2px}.roam-calendar-maintenance{color:#64748b;font-weight:700}
      .roam-calendar-note{font-size:10px;line-height:1.5;color:var(--roam-muted,#64748b);margin:12px 0 0}
      @media(max-width:650px){.roam-calendar-toolbar{align-items:flex-start}.roam-calendar-toolbar h2{font-size:18px}.roam-calendar-legend{gap:9px}}
    `}</style>
  </div>;
}
