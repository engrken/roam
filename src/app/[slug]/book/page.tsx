"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Vehicle = {
  id: string; type: string; make: string; model: string; year: number | null;
  color?: string | null; seats?: number | null; transmission?: string | null;
  dailyRate: number; securityDeposit: number;
  branch: { name: string; address: string | null } | null;
};
type Business = { name: string; phone: string | null; timezone: string; currency?: string; rentalTerms: string; rentalTermsVersion: string };

function localDateTime(timeZone: string, offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day + "T" + values.hour + ":" + values.minute;
}
function wallClockEpoch(value: string, timeZone: string) {
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})$/.exec(value);
  if (!match) return NaN;
  const [, y, mo, d, h, mi] = match;
  const desired = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    let instant = desired;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const values = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
      const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
      instant = desired - (represented - instant);
    }
    const values = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    return Number(values.year) === Number(y) && Number(values.month) === Number(mo) &&
      Number(values.day) === Number(d) && Number(values.hour) === Number(h) &&
      Number(values.minute) === Number(mi) ? instant : NaN;
  } catch { return NaN; }
}
function money(value: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

export default function PublicBookPage() {
  const { slug } = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [acceptedRentalTerms, setAcceptedRentalTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<{ reference: string; accessToken: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/public/" + encodeURIComponent(slug) + "/bookings", { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load this rental business.");
        if (active) { setBusiness(body.business); setVehicles(body.vehicles || []); }
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load vehicles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  const chosen = vehicles.find(vehicle => vehicle.id === vehicleId);
  const estimate = useMemo(() => {
    if (!startAt || !endAt) return null;
    const timeZone = business?.timezone || "Asia/Manila";
    const start = wallClockEpoch(startAt, timeZone), end = wallClockEpoch(endAt, timeZone);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const days = Math.max(1, Math.ceil((end - start) / 86_400_000));
    return { days, rental: chosen ? chosen.dailyRate * days : 0, deposit: chosen?.securityDeposit || 0 };
  }, [startAt, endAt, chosen, business?.timezone]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!chosen || !estimate) { setError("Choose a vehicle and a valid pickup and return time."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/public/" + encodeURIComponent(slug) + "/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, vehicleId, startAt, endAt, acceptedRentalTerms, rentalTermsVersion: business?.rentalTermsVersion }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to submit your request.");
      setBooking(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit your request.");
    } finally { setBusy(false); }
  }

  return <main className="client-page">
    <header className="client-topbar"><Link href="/" className="client-brand"><span>R</span> ROAM</Link><div className="client-topbar-links"><span>SECURE BOOKING REQUEST</span><Link href="/help">Booking help</Link></div></header>
    <div className="client-container">
      <div className="client-heading"><div className="client-eyebrow">RENT DIRECTLY WITH THE OWNER</div><h1>{business ? business.name : "Book your next ride"}</h1><p>Choose your vehicle, set your rental dates, and send a request. The rental team will confirm availability and next steps.</p></div>
      {error && <div className="client-alert" role="alert">{error}</div>}
      {booking ? <section className="client-success">
        <div className="client-success-icon">✓</div><div className="client-eyebrow">REQUEST RECEIVED</div><h2>Your booking request is on its way.</h2>
        <p>Keep your booking reference safe. Use the private link below to check updates, send messages, and upload the required documents.</p>
        <div className="client-reference"><span>BOOKING REFERENCE</span><strong>{booking.reference}</strong></div>
        <Link className="client-primary" href={"/booking/" + encodeURIComponent(booking.reference) + "?token=" + encodeURIComponent(booking.accessToken)}>Open my booking <span>→</span></Link>
        <small className="client-help">This is a request, not a confirmed reservation. The rental team will review it.</small>
      </section> : <div className="client-booking-grid">
        <section className="client-form-card">
          <div className="client-section-head"><span>01</span><div><h2>Your rental details</h2><p>All times use {business?.timezone || "the rental business"} time.</p></div></div>
          {loading ? <div className="client-loading">Loading available vehicles…</div> : !vehicles.length ? <div className="client-empty"><strong>No vehicles are available right now.</strong><p>Please contact {business?.name || "the rental team"} to ask about upcoming availability.</p>{business?.phone && <a href={"tel:" + business.phone}>Call {business.phone}</a>}</div> :
          <form onSubmit={submit} className="client-form">
            <label>Choose a vehicle<select required value={vehicleId} onChange={event => setVehicleId(event.target.value)}><option value="">Select an available vehicle</option>{vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.year || ""} {vehicle.make} {vehicle.model} · {money(vehicle.dailyRate)}/day</option>)}</select></label>
            {chosen && <div className="client-vehicle-summary"><div className="client-vehicle-icon">🚘</div><div><strong>{chosen.year ? chosen.year + " " : ""}{chosen.make} {chosen.model}</strong><span>{[chosen.type.replaceAll("_", " "), chosen.color, chosen.transmission, chosen.seats ? chosen.seats + " seats" : null].filter(Boolean).join(" · ")}</span><span>Pickup location: {chosen.branch?.name || "To be confirmed"}{chosen.branch?.address ? " · " + chosen.branch.address : ""}</span></div><b>{money(chosen.dailyRate)}<small>/day</small></b></div>}
            <div className="client-fields-two"><label>Pickup date & time<input required type="datetime-local" min={localDateTime(business?.timezone || "Asia/Manila")} value={startAt} onChange={event => { setStartAt(event.target.value); if (endAt && event.target.value >= endAt) setEndAt(""); }}/></label><label>Return date & time<input required type="datetime-local" min={startAt || localDateTime(business?.timezone || "Asia/Manila", 60)} value={endAt} onChange={event => setEndAt(event.target.value)}/></label></div>
            <div className="client-section-head client-subhead"><span>02</span><div><h2>Your contact details</h2><p>We’ll use these details to coordinate your booking.</p></div></div>
            <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your full name"/></label>
            <div className="client-fields-two"><label>Email address<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label><label>Mobile number<input required type="tel" minLength={7} maxLength={30} autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+63 9XX XXX XXXX"/></label></div>
            <section className="client-rental-terms"><div><strong>Rental terms and conditions</strong><p>These are set by {business?.name || "the rental business"}. Please read them before sending your request.</p></div><div className="client-rental-terms-copy">{business?.rentalTerms ? business.rentalTerms : "This rental business has not published its rental terms yet. Please contact them directly before requesting a booking."}</div>{business?.rentalTerms ? <label className="client-terms-check"><input type="checkbox" required checked={acceptedRentalTerms} onChange={event => setAcceptedRentalTerms(event.target.checked)}/><span>I have read and agree to the rental terms and conditions provided by this rental business.</span></label> : <p className="client-terms-unavailable">Booking requests are temporarily unavailable until this business publishes its rental conditions.</p> }</section>
            <button className="client-primary client-submit" disabled={busy || !estimate || !acceptedRentalTerms || !business?.rentalTerms}>{busy ? "Sending request…" : "Send booking request"} <span>→</span></button>
            <p className="client-privacy">Your details are shared with this rental business only to process your booking request. ROAM platform <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link> also apply to use of this service.</p>
          </form>}
        </section>
        <aside className="client-summary-card"><div className="client-summary-top"><span>YOUR ESTIMATE</span><span className="client-secure">● PRIVATE & SECURE</span></div>
          {estimate && chosen ? <><div className="client-total">{money(estimate.rental)}</div><p>Estimated rental for {estimate.days} {estimate.days === 1 ? "day" : "days"}</p><div className="client-summary-line"><span>{money(chosen.dailyRate)} × {estimate.days} days</span><strong>{money(estimate.rental)}</strong></div><div className="client-summary-line"><span>Refundable security deposit</span><strong>{money(estimate.deposit)}</strong></div><div className="client-summary-total"><span>Estimated amount due</span><strong>{money(estimate.rental + estimate.deposit)}</strong></div><small>Final charges and deposit terms are confirmed by the rental team. This estimate does not guarantee availability.</small></> :
          <div className="client-summary-empty"><div>₱</div><strong>Your estimate will appear here.</strong><p>Select a vehicle and rental dates to calculate your estimated rental cost.</p></div>}
          <div className="client-trust"><div>✓ <span><b>No payment collected here</b><small>Submit a request first. The rental team will confirm payment arrangements.</small></span></div><div>✓ <span><b>Private booking link</b><small>Track your request and communicate securely.</small></span></div></div>
        </aside>
      </div>}
      <footer className="client-footer">Powered by <b>ROAM</b> · Rental booking made clearer.</footer>
    </div>
  </main>;
}
