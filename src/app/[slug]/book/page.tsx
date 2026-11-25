"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { availableRentalRateUnits, calculateRentalPrice, rentalRateForMode, rentalRateUnitLabel, type RentalMode, type RentalRateUnit } from "@/lib/rental-pricing";
import "./booking-experience.css";

type Vehicle = {
  id: string; type: string; make: string; model: string; year: number | null;
  color?: string | null; seats?: number | null; transmission?: string | null;
  dailyRate: number; selfDriveEnabled: boolean; withDriverEnabled: boolean; withDriverDailyRate: number | null;
  hourlyRate: number | null; weeklyRate: number | null; monthlyRate: number | null;
  withDriverHourlyRate: number | null; withDriverWeeklyRate: number | null; withDriverMonthlyRate: number | null;
  deliveryAvailable: boolean; deliveryFee: number; includedKmPerDay: number | null; excessMileageRate: number;
  overtimeGraceMinutes: number; overtimeHourlyRate: number | null; withDriverOvertimeHourlyRate: number | null; securityDeposit: number;
  branch: { id?: string; name: string; address: string | null } | null;
};
type Branch = { id: string; name: string; address: string | null };
type Business = { name: string; phone: string | null; timezone: string; currency?: string; rentalTerms: string; rentalTermsVersion: string };
type BookingResult = { reference: string; accessToken: string; emailNotification?: string };

function localDateTime(timeZone: string, offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day + "T" + values.hour + ":" + values.minute;
}
function wallClockEpoch(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return NaN;
  const [, y, mo, d, h, mi] = match;
  const desired = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    let instant = desired;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const values = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
      const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
      instant = desired - (represented - instant);
    }
    const values = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    return Number(values.year) === Number(y) && Number(values.month) === Number(mo) && Number(values.day) === Number(d) && Number(values.hour) === Number(h) && Number(values.minute) === Number(mi) ? instant : NaN;
  } catch { return NaN; }
}
function money(value: number, currency = "PHP") {
  try { return new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
  catch { return "₱" + Math.round(value).toLocaleString("en-PH"); }
}
function displayDate(value: string, timeZone: string) {
  const epoch = wallClockEpoch(value, timeZone);
  return Number.isFinite(epoch) ? new Intl.DateTimeFormat("en-PH", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(epoch)) : value;
}

const steps = [
  { title: "Schedule", description: "When and where" },
  { title: "Vehicle", description: "Choose your ride" },
  { title: "Details", description: "Your contact info" },
  { title: "Review", description: "Confirm your request" },
];

export default function PublicBookPage() {
  const { slug } = useParams<{ slug: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [rentalMode, setRentalMode] = useState<RentalMode>("SELF_DRIVE");
  const [rateUnit, setRateUnit] = useState<RentalRateUnit>("DAILY");
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [acceptedRentalTerms, setAcceptedRentalTerms] = useState(false);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [returningLookupBusy, setReturningLookupBusy] = useState(false);
  const [returningLookupNotice, setReturningLookupNotice] = useState("");

  async function findReturningCustomer() {
    if (!email.trim() || !phone.trim()) { setReturningLookupNotice("Enter your email address and mobile number first."); return; }
    setReturningLookupBusy(true); setReturningLookupNotice("");
    try {
      const response = await fetch("/api/public/" + encodeURIComponent(slug) + "/customers/returning", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, phone }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to check customer details.");
      if (body.found && typeof body.customer?.name === "string") {
        setName(body.customer.name);
        setReturningLookupNotice("Welcome back. Your name has been filled in. Please review your details before continuing.");
      } else setReturningLookupNotice("We couldn't match those details. You can continue by entering your name below.");
    } catch (reason) { setReturningLookupNotice(reason instanceof Error ? reason.message : "Unable to check customer details."); }
    finally { setReturningLookupBusy(false); }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/public/" + encodeURIComponent(slug) + "/bookings", { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load this rental business.");
        if (active) { setBusiness(body.business); setBranches(body.branches || []); }
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load this rental business."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      try {
        const saved = window.localStorage.getItem("roam:booking-draft:" + slug);
        if (saved) {
          const draft = JSON.parse(saved) as { startAt?: unknown; endAt?: unknown; branchId?: unknown };
          if (typeof draft.startAt === "string" && typeof draft.endAt === "string" && active) {
            setStartAt(draft.startAt);
            setEndAt(draft.endAt);
            setBranchId(typeof draft.branchId === "string" ? draft.branchId : "");
            setDraftRestored(true);
          }
        }
      } catch {
        try { window.localStorage.removeItem("roam:booking-draft:" + slug); } catch { /* Storage may be disabled. */ }
      } finally {
        if (active) setDraftLoaded(true);
      }
    });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      const key = "roam:booking-draft:" + slug;
      if (!startAt && !endAt && !branchId) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, JSON.stringify({ startAt, endAt, branchId, savedAt: new Date().toISOString() }));
    } catch {
      // Booking can continue normally when browser storage is unavailable.
    }
  }, [draftLoaded, slug, startAt, endAt, branchId]);

  const chosen = vehicles.find(vehicle => vehicle.id === vehicleId);
  const selectedRate = chosen ? rentalRateForMode(chosen, rentalMode, rateUnit) : null;
  const selectedRateUnits = chosen ? availableRentalRateUnits(chosen, rentalMode) : [];
  const estimate = useMemo(() => {
    if (!chosen || selectedRate === null || !startAt || !endAt) return null;
    const zone = business?.timezone || "Asia/Manila";
    const start = wallClockEpoch(startAt, zone), end = wallClockEpoch(endAt, zone);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const price = calculateRentalPrice({ startAt: new Date(start), endAt: new Date(end), rate: selectedRate, rateUnit });
    if (!price) return null;
    const delivery = deliveryRequested ? chosen.deliveryFee : 0;
    return {
      periods: price.periods, rental: Number(price.amount), delivery, deposit: chosen.securityDeposit || 0,
      includedKmPerDay: chosen.includedKmPerDay, excessMileageRate: chosen.excessMileageRate,
      overtimeGraceMinutes: chosen.overtimeGraceMinutes,
      overtimeHourlyRate: rentalMode === "WITH_DRIVER" ? chosen.withDriverOvertimeHourlyRate : chosen.overtimeHourlyRate,
    };
  }, [startAt, endAt, chosen, selectedRate, rateUnit, deliveryRequested, rentalMode, business?.timezone]);

  async function continueToVehicles(event: FormEvent) {
    event.preventDefault();
    const zone = business?.timezone || "Asia/Manila";
    const start = wallClockEpoch(startAt, zone), end = wallClockEpoch(endAt, zone);
    if (!Number.isFinite(start) || start <= Date.now() || !Number.isFinite(end) || end <= start) {
      setError("Choose a future pickup time and a return time after pickup.");
      return;
    }
    setBusy(true); setAvailabilityLoading(true); setError(""); setVehicleId("");
    try {
      const params = new URLSearchParams({ startAt, endAt });
      if (branchId) params.set("branchId", branchId);
      const response = await fetch("/api/public/" + encodeURIComponent(slug) + "/bookings?" + params.toString(), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to check vehicle availability.");
      setVehicles(body.vehicles || []);
      setStep(2);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to check vehicle availability.");
    } finally { setBusy(false); setAvailabilityLoading(false); }
  }

  function continueToDetails() {
    if (!chosen) { setError("Please choose a vehicle to continue."); return; }
    setError(""); setStep(3);
  }

  function continueToReview(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email.trim()) || phone.trim().length < 7) {
      setError("Please enter your name, a valid email address, and a contact number.");
      return;
    }
    setError(""); setStep(4);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!chosen || !estimate || !business?.rentalTerms || !acceptedRentalTerms) {
      setError("Please review and accept the rental terms before submitting.");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/public/" + encodeURIComponent(slug) + "/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, vehicleId, rentalMode, rateUnit, deliveryRequested, deliveryAddress, startAt, endAt, acceptedRentalTerms, rentalTermsVersion: business.rentalTermsVersion }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to submit your request.");
      window.localStorage.removeItem("roam:booking-draft:" + slug);
      setDraftRestored(false);
      setBooking(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit your request.");
    } finally { setBusy(false); }
  }

  const zone = business?.timezone || "Asia/Manila";
  const currency = business?.currency || "PHP";

  return <main className="client-page roam-booking-experience">
    <header className="client-topbar"><Link href="/" className="client-brand"><span>R</span> ROAM</Link><div className="client-topbar-links"><span>SECURE BOOKING REQUEST</span><Link href="/help">Booking help</Link></div></header>
    <div className="client-container">
      <div className="client-heading"><div className="client-eyebrow">RENT DIRECTLY WITH THE OWNER</div><h1>{business ? business.name : "Book your next ride"}</h1><p>A simple guided booking. Choose your schedule, find an available vehicle, and send your request.</p></div>
      {error && <div className="client-alert" role="alert">{error}</div>}
      {booking ? <section className="client-success roam-booking-success">
        <div className="client-success-icon">✓</div><div className="client-eyebrow">REQUEST RECEIVED</div><h2>Your booking request is on its way.</h2>
        <p>Keep your booking reference safe. Your private booking page shows every next step, lets you message the rental team, upload documents, and pay once your request is confirmed.</p>
        <div className="client-reference"><span>BOOKING REFERENCE</span><strong>{booking.reference}</strong></div>
        <Link className="client-primary" href={"/booking/" + encodeURIComponent(booking.reference) + "?token=" + encodeURIComponent(booking.accessToken)}>Open my booking <span>→</span></Link>
        {booking.emailNotification === "failed" && <small className="client-help">We could not send the email confirmation. Please open your private booking page now and save its link.</small>}
        <div className="roam-booking-next-steps"><b>What happens next?</b><ol><li><strong>Request received</strong><span>Your request has been sent to the rental team.</span></li><li><strong>Wait for confirmation</strong><span>The business will review availability and update your booking status.</span></li><li><strong>Pay after approval</strong><span>Open your private booking page. A Pay balance button will appear after confirmation.</span></li><li><strong>Payment verification</strong><span>Submit your transfer details and proof. The business will verify it before marking it paid.</span></li></ol></div>
      </section> : <div className="roam-booking-layout">
        <section className="client-form-card roam-booking-card">
          <div className="roam-booking-stepper" aria-label="Booking progress">
            {steps.map((item, index) => <div key={item.title} className={"roam-booking-step " + (step === index + 1 ? "is-current" : step > index + 1 ? "is-complete" : "")}>
              <span>{step > index + 1 ? "✓" : index + 1}</span><div><b>{item.title}</b><small>{item.description}</small></div>
            </div>)}
          </div>
          {step === 1 && <form className="roam-booking-step-content" onSubmit={continueToVehicles}>
            <div className="roam-booking-step-heading"><span>STEP 1 OF 4</span><h2>Plan your rental</h2><p>Choose your pickup location and rental dates. We’ll check which vehicles are available for that exact period.</p></div>
            {draftRestored && <div className="roam-booking-hint"><span>✓</span><p>Your pickup schedule was restored from this device. Contact details are never saved in this draft.</p><button type="button" onClick={() => { setStartAt(""); setEndAt(""); setBranchId(""); setDraftRestored(false); window.localStorage.removeItem("roam:booking-draft:" + slug); }}>Clear saved schedule</button></div>}
            {branches.length > 0 && <label>Pickup branch <select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">Any available branch</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}{branch.address ? " — " + branch.address : ""}</option>)}</select></label>}
            <div className="client-fields-two">
              <label>Pickup date & time<input required type="datetime-local" min={localDateTime(zone)} value={startAt} onChange={event => { setStartAt(event.target.value); if (endAt && event.target.value >= endAt) setEndAt(""); }}/></label>
              <label>Return date & time<input required type="datetime-local" min={startAt || localDateTime(zone, 60)} value={endAt} onChange={event => setEndAt(event.target.value)}/></label>
            </div>
            <div className="roam-booking-hint"><span>ⓘ</span><p>Times are shown in {zone} business time. You can review the vehicle and estimated cost before submitting.</p></div>
            <button className="client-primary client-submit" type="submit" disabled={loading || busy || !startAt || !endAt}>{availabilityLoading ? "Checking availability…" : "Find available vehicles"} <span>→</span></button>
          </form>}
          {step === 2 && <div className="roam-booking-step-content">
            <div className="roam-booking-step-heading"><span>STEP 2 OF 4</span><h2>Choose your vehicle</h2><p>Vehicles shown below are available for your selected rental period, based on current bookings.</p></div>
            <div className="roam-booking-trip-chip"><span>📅 {displayDate(startAt, zone)} – {displayDate(endAt, zone)}</span><button type="button" onClick={() => { setStep(1); setError(""); }}>Change dates</button></div>
            {vehicles.length === 0 ? <div className="client-empty roam-booking-no-vehicles"><strong>No vehicles match those dates.</strong><p>Try another pickup period or select a different branch.</p><button type="button" className="client-primary" onClick={() => { setStep(1); setError(""); }}>Change schedule</button></div> :
              <div className="roam-booking-vehicle-list">{vehicles.map(vehicle => <button type="button" key={vehicle.id} className={"roam-booking-vehicle " + (vehicleId === vehicle.id ? "is-selected" : "")} onClick={() => { setVehicleId(vehicle.id); setRentalMode(vehicle.selfDriveEnabled ? "SELF_DRIVE" : "WITH_DRIVER"); setRateUnit("DAILY"); setDeliveryRequested(false); setDeliveryAddress(""); setError(""); }}>
                <span className="roam-booking-vehicle-icon">🚘</span><span className="roam-booking-vehicle-info"><b>{vehicle.year ? vehicle.year + " " : ""}{vehicle.make} {vehicle.model}</b><small>{[vehicle.type.replaceAll("_", " "), vehicle.transmission, vehicle.seats ? vehicle.seats + " seats" : null, vehicle.color].filter(Boolean).join(" · ")}</small><small>{vehicle.branch?.name || "Pickup location to be confirmed"}{vehicle.branch?.address ? " · " + vehicle.branch.address : ""}</small></span><span className="roam-booking-vehicle-rate">{vehicle.selfDriveEnabled && <><b>{money(vehicle.dailyRate, currency)}</b><small>self-drive / day</small></>}{vehicle.withDriverEnabled && <><b>{money(vehicle.withDriverDailyRate || 0, currency)}</b><small>with driver / day</small></>}</span><span className="roam-booking-radio">{vehicleId === vehicle.id ? "✓" : ""}</span>
              </button>)}</div>}
            {chosen && <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-semibold">Rental option<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3" value={rentalMode} onChange={event => { const next = event.target.value as RentalMode; setRentalMode(next); const units = availableRentalRateUnits(chosen, next); if (!units.includes(rateUnit)) setRateUnit(units[0] || "DAILY"); }}><option value="SELF_DRIVE" disabled={!chosen.selfDriveEnabled}>Self-drive</option><option value="WITH_DRIVER" disabled={!chosen.withDriverEnabled}>With driver</option></select></label>
              <label className="block text-sm font-semibold">Pricing period<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3" value={rateUnit} onChange={event => setRateUnit(event.target.value as RentalRateUnit)}>{selectedRateUnits.map(unit => <option key={unit} value={unit}>{unit} — {money(rentalRateForMode(chosen, rentalMode, unit) || 0, currency)}/{rentalRateUnitLabel(unit)}</option>)}</select></label>
              {chosen.deliveryAvailable && <div className="border-t border-slate-200 pt-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={deliveryRequested} onChange={event => setDeliveryRequested(event.target.checked)}/> Request vehicle delivery ({chosen.deliveryFee ? money(chosen.deliveryFee, currency) : "Free"})</label>{deliveryRequested && <label className="mt-2 block text-sm">Delivery address<textarea required minLength={5} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} placeholder="Enter the delivery address"/></label>}</div>}
              <div className="text-xs leading-5 text-slate-600">{chosen.includedKmPerDay !== null ? <p>Included mileage: {chosen.includedKmPerDay} km/day · Excess: {money(chosen.excessMileageRate, currency)}/km</p> : <p>Mileage allowance: confirm with the rental team.</p>}<p>Overtime grace: {chosen.overtimeGraceMinutes} minutes</p>{(rentalMode === "WITH_DRIVER" ? chosen.withDriverOvertimeHourlyRate : chosen.overtimeHourlyRate) !== null && <p>Overtime rate: {money((rentalMode === "WITH_DRIVER" ? chosen.withDriverOvertimeHourlyRate : chosen.overtimeHourlyRate) || 0, currency)}/hour</p>}</div>
            </div>}
            <div className="roam-booking-actions"><button type="button" className="client-refresh" onClick={() => setStep(1)}>← Back</button><button type="button" className="client-primary" disabled={!vehicleId || !chosen} onClick={continueToDetails}>Continue <span>→</span></button></div>
          </div>}
          {step === 3 && <form className="roam-booking-step-content" onSubmit={continueToReview}>
            <div className="roam-booking-step-heading"><span>STEP 3 OF 4</span><h2>How can the team reach you?</h2><p>Enter your contact details so the rental business can confirm your request and coordinate pickup.</p></div>
            <label>Full name<input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your full name"/></label>
            <label>Email address<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label>
            <label>Mobile number<input required type="tel" minLength={7} maxLength={30} autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+63 9XX XXX XXXX"/></label>
            <div className="roam-booking-hint" style={{display:"grid",gap:8}}>
              <p><strong>Returning customer?</strong> Use the same email address and mobile number from your previous booking to fill your saved name.</p>
              <button type="button" className="client-refresh" onClick={findReturningCustomer} disabled={returningLookupBusy || !email.trim() || !phone.trim()}>{returningLookupBusy ? "Checking details…" : "Quick fill my details"}</button>
              {returningLookupNotice && <p role="status" aria-live="polite">{returningLookupNotice}</p>}
            </div>
            <div className="roam-booking-hint"><span>🔒</span><p>Your contact details are shared with this rental business only to process this booking request.</p></div>
            <div className="roam-booking-actions"><button type="button" className="client-refresh" onClick={() => setStep(2)}>← Back</button><button type="submit" className="client-primary">Review booking <span>→</span></button></div>
          </form>}
          {step === 4 && <form className="roam-booking-step-content" onSubmit={submit}>
            <div className="roam-booking-step-heading"><span>STEP 4 OF 4</span><h2>Review your request</h2><p>Check your details and rental estimate before sending the request to the rental team.</p></div>
            <div className="roam-booking-review">
              <div><small>VEHICLE</small><b>{chosen ? (chosen.year ? chosen.year + " " : "") + chosen.make + " " + chosen.model : "—"}</b><button type="button" onClick={() => setStep(2)}>Change</button></div>
              <div><small>PICKUP</small><b>{displayDate(startAt, zone)}</b><button type="button" onClick={() => setStep(1)}>Change</button></div>
              <div><small>RETURN</small><b>{displayDate(endAt, zone)}</b></div>
              <div><small>CUSTOMER</small><b>{name}</b><span>{email} · {phone}</span><button type="button" onClick={() => setStep(3)}>Edit details</button></div>
            </div>
            {estimate && <div className="roam-booking-cost">
              <div><span>{money(selectedRate || 0, currency)} × {estimate.periods} {rentalRateUnitLabel(rateUnit)}{estimate.periods === 1 ? "" : "s"}</span><b>{money(estimate.rental, currency)}</b></div>
              {estimate.delivery > 0 && <div><span>Vehicle delivery</span><b>{money(estimate.delivery, currency)}</b></div>}{estimate.delivery === 0 && deliveryRequested && <div><span>Vehicle delivery</span><b>Free</b></div>}{estimate.deposit > 0 && <div><span>Refundable security deposit</span><b>{money(estimate.deposit, currency)}</b></div>}
              {estimate.includedKmPerDay !== null && <small>Included mileage: {estimate.includedKmPerDay} km/day. Excess mileage is charged at {money(estimate.excessMileageRate, currency)}/km when returned.</small>}{estimate.overtimeHourlyRate !== null && <small>Overtime starts after a {estimate.overtimeGraceMinutes}-minute grace period and is {money(estimate.overtimeHourlyRate, currency)}/hour.</small>}
              <div className="roam-booking-cost-total"><span>Estimated amount</span><b>{money(estimate.rental + estimate.delivery + estimate.deposit, currency)}</b></div>
              <small>This is an estimate, not a payment receipt or confirmed charge. The rental team will confirm the final amount and payment arrangements.</small>
            </div>}
            <section className="client-rental-terms roam-booking-terms"><div><strong>Rental terms and conditions</strong><p>Please read the business’s terms before submitting your request.</p></div><div className="client-rental-terms-copy">{business?.rentalTerms || "This rental business has not published its rental terms yet."}</div>
              {business?.rentalTerms ? <label className="client-terms-check"><input type="checkbox" required checked={acceptedRentalTerms} onChange={event => setAcceptedRentalTerms(event.target.checked)}/><span>I have read and agree to the rental terms and conditions provided by this rental business.</span></label> : <p className="client-terms-unavailable">Booking requests are unavailable until this business publishes its rental conditions.</p>}
            </section>
            <div className="roam-booking-actions"><button type="button" className="client-refresh" onClick={() => setStep(3)}>← Back</button><button className="client-primary" type="submit" disabled={busy || !estimate || !acceptedRentalTerms || !business?.rentalTerms}>{busy ? "Sending request…" : "Submit booking request"} <span>→</span></button></div>
          </form>}
        </section>
        <aside className="client-summary-card roam-booking-summary">
          <div className="client-summary-top"><span>YOUR RENTAL SUMMARY</span><span className="client-secure">● PRIVATE & SECURE</span></div>
          {chosen && estimate ? <>
            <div className="roam-booking-summary-vehicle"><b>{chosen.year ? chosen.year + " " : ""}{chosen.make} {chosen.model}</b><small>{chosen.branch?.name || "Pickup location to be confirmed"}</small></div>
            <div className="client-summary-line"><span>Rental option</span><strong>{rentalMode === "WITH_DRIVER" ? "With driver" : "Self-drive"}</strong></div>
            <div className="client-summary-line"><span>Rental duration</span><strong>{estimate.periods} {rentalRateUnitLabel(rateUnit)}{estimate.periods === 1 ? "" : "s"}</strong></div>
            <div className="client-summary-line"><span>Rental estimate</span><strong>{money(estimate.rental, currency)}</strong></div>
            {estimate.delivery > 0 && <div className="client-summary-line"><span>Delivery</span><strong>{money(estimate.delivery, currency)}</strong></div>}
            {estimate.delivery === 0 && deliveryRequested && <div className="client-summary-line"><span>Delivery</span><strong>Free</strong></div>}
            {estimate.deposit > 0 && <div className="client-summary-line"><span>Refundable deposit</span><strong>{money(estimate.deposit, currency)}</strong></div>}
            <div className="client-summary-total"><span>Estimated total</span><strong>{money(estimate.rental + estimate.delivery + estimate.deposit, currency)}</strong></div>
          </> : <div className="client-summary-empty"><div>₱</div><strong>Your summary will appear here.</strong><p>Choose your dates and vehicle to see the estimated rental cost.</p></div>}
          <div className="client-trust"><div>✓ <span><b>No payment collected here</b><small>Send a request first. The rental team will confirm payment arrangements.</small></span></div><div>✓ <span><b>Private booking link</b><small>Track your request and communicate securely.</small></span></div></div>
        </aside>
      </div>}
      <footer className="client-footer">Powered by <b>ROAM</b> · Rental booking made clearer.</footer>
    </div>
  </main>;
}
