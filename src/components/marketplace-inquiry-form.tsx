"use client";

import { useMemo, useState, type FormEvent } from "react";
import { availableRentalRateUnits, rentalAmountCents, rentalRateForMode, rentalRateUnitLabel, type RentalMode, type RentalRateUnit } from "@/lib/rental-pricing";

type RentalVehicle = {
  dailyRate: number; selfDriveEnabled: boolean; withDriverEnabled: boolean; withDriverDailyRate: number | null;
  hourlyRate: number | null; weeklyRate: number | null; monthlyRate: number | null;
  withDriverHourlyRate: number | null; withDriverWeeklyRate: number | null; withDriverMonthlyRate: number | null;
  deliveryAvailable: boolean; deliveryFee: number; includedKmPerDay: number | null; excessMileageRate: number;
  overtimeGraceMinutes: number; overtimeHourlyRate: number | null; withDriverOvertimeHourlyRate: number | null;
};

const money = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);

export function MarketplaceInquiryForm({ listingId, vehicle }: { listingId: string; vehicle: RentalVehicle }) {
  const initialMode: RentalMode = vehicle.selfDriveEnabled ? "SELF_DRIVE" : "WITH_DRIVER";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    requesterName: "", requesterEmail: "", requesterPhone: "", startDate: "", startTime: "09:00",
    endDate: "", endTime: "09:00", rentalMode: initialMode, rateUnit: "DAILY" as RentalRateUnit,
    deliveryRequested: false, deliveryAddress: "", message: "", contactConsent: false,
  });

  const availableUnits = useMemo(() => availableRentalRateUnits(vehicle, form.rentalMode), [vehicle, form.rentalMode]);
  const selectedRate = rentalRateForMode(vehicle, form.rentalMode, form.rateUnit);
  const estimate = useMemo(() => {
    if (!form.startDate || !form.endDate || !selectedRate) return null;
    const start = new Date(form.startDate + "T" + form.startTime + ":00+08:00");
    const end = new Date(form.endDate + "T" + form.endTime + ":00+08:00");
    const hours = (end.getTime() - start.getTime()) / 3_600_000;
    if (!Number.isFinite(hours) || hours <= 0) return null;
    const periods = form.rateUnit === "HOURLY" ? Math.max(1, Math.ceil(hours))
      : form.rateUnit === "DAILY" ? Math.max(1, Math.ceil(hours / 24))
      : form.rateUnit === "WEEKLY" ? Math.max(1, Math.ceil(hours / 168))
      : Math.max(1, Math.ceil(hours / 720));
    const cents = rentalAmountCents(selectedRate, periods);
    if (cents === null) return null;
    return { periods, rental: cents / 100, delivery: form.deliveryRequested ? vehicle.deliveryFee : 0 };
  }, [form.startDate, form.startTime, form.endDate, form.endTime, form.rateUnit, form.deliveryRequested, selectedRate, vehicle.deliveryFee]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      if (!estimate) throw new Error("Choose valid pickup and return dates and times.");
      if (form.deliveryRequested && form.deliveryAddress.trim().length < 5) throw new Error("Enter the delivery address.");
      const response = await fetch(`/api/marketplace/${encodeURIComponent(listingId)}/inquiries`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send inquiry.");
      setSuccess(data.message || "Inquiry sent to the Host.");
      setForm({ requesterName: "", requesterEmail: "", requesterPhone: "", startDate: "", startTime: "09:00", endDate: "", endTime: "09:00", rentalMode: initialMode, rateUnit: "DAILY", deliveryRequested: false, deliveryAddress: "", message: "", contactConsent: false });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send inquiry.");
    } finally { setBusy(false); }
  }

  const minReturnDate = form.startDate || new Date().toLocaleDateString("en-CA");

  return <form onSubmit={submit} className="mt-6 space-y-3 border-t border-slate-100 pt-5">
    <h3 className="font-semibold text-slate-900">Ask the Host about these dates</h3>
    <p className="text-xs leading-5 text-slate-500">This sends a rental inquiry only. It does not reserve the vehicle or create a booking. The Host confirms availability and the final quote.</p>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
    {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{success}</p>}
    <label className="block text-xs font-medium text-slate-700">Your name<input required minLength={2} maxLength={120} autoComplete="name" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.requesterName} onChange={e=>setForm({...form,requesterName:e.target.value})}/></label>
    <label className="block text-xs font-medium text-slate-700">Email<input required type="email" maxLength={254} autoComplete="email" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.requesterEmail} onChange={e=>setForm({...form,requesterEmail:e.target.value})}/></label>
    <label className="block text-xs font-medium text-slate-700">Phone (optional)<input type="tel" maxLength={40} autoComplete="tel" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.requesterPhone} onChange={e=>setForm({...form,requesterPhone:e.target.value})}/></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs font-medium text-slate-700">Rental option<select required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.rentalMode} onChange={e=>{const mode=e.target.value as RentalMode;const units=availableRentalRateUnits(vehicle,mode);setForm({...form,rentalMode:mode,rateUnit:units.includes(form.rateUnit)?form.rateUnit:(units[0]||"DAILY")});}}>{vehicle.selfDriveEnabled && <option value="SELF_DRIVE">Self-drive</option>}{vehicle.withDriverEnabled && <option value="WITH_DRIVER">With driver</option>}</select></label>
      <label className="block text-xs font-medium text-slate-700">Rate period<select required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.rateUnit} onChange={e=>setForm({...form,rateUnit:e.target.value as RentalRateUnit})}>{availableUnits.map(unit=><option key={unit} value={unit}>{unit} · {money(rentalRateForMode(vehicle,form.rentalMode,unit)||0)}/{rentalRateUnitLabel(unit)}</option>)}</select></label>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <label className="block text-xs font-medium text-slate-700">Pickup date<input required type="date" min={new Date().toLocaleDateString("en-CA")} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 px-2 py-2.5 text-sm" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value,endDate:form.endDate && form.endDate<e.target.value?e.target.value:form.endDate})}/></label>
      <label className="block text-xs font-medium text-slate-700">Pickup time<input required type="time" className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 px-2 py-2.5 text-sm" value={form.startTime} onChange={e=>setForm({...form,startTime:e.target.value})}/></label>
      <label className="block text-xs font-medium text-slate-700">Return date<input required type="date" min={minReturnDate} className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 px-2 py-2.5 text-sm" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})}/></label>
      <label className="block text-xs font-medium text-slate-700">Return time<input required type="time" className="mt-1 w-full min-w-0 rounded-lg border border-slate-200 px-2 py-2.5 text-sm" value={form.endTime} onChange={e=>setForm({...form,endTime:e.target.value})}/></label>
    </div>
    {vehicle.deliveryAvailable && <div className="rounded-lg border border-slate-200 p-3"><label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={form.deliveryRequested} onChange={e=>setForm({...form,deliveryRequested:e.target.checked})}/> Request delivery ({vehicle.deliveryFee ? money(vehicle.deliveryFee) : "Free"})</label>{form.deliveryRequested && <label className="mt-2 block text-xs font-medium text-slate-700">Delivery address<textarea required minLength={5} maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.deliveryAddress} onChange={e=>setForm({...form,deliveryAddress:e.target.value})}/></label>}</div>}
    {estimate && <div className="rounded-lg bg-slate-50 p-3 text-sm"><div className="flex justify-between gap-3"><span>Estimated rental ({estimate.periods} {rentalRateUnitLabel(form.rateUnit)} unit(s))</span><b>{money(estimate.rental)}</b></div>{form.deliveryRequested && <div className="mt-1 flex justify-between gap-3"><span>Delivery</span><b>{estimate.delivery ? money(estimate.delivery) : "Free"}</b></div>}<p className="mt-2 text-xs leading-5 text-slate-500">Preliminary estimate only. Refundable deposit, final fees and charges will be confirmed in the Host's quotation.</p></div>}
    <div className="rounded-lg border border-slate-100 p-3 text-xs leading-5 text-slate-600">
      {vehicle.includedKmPerDay !== null ? <p>Included mileage: {vehicle.includedKmPerDay} km/day · Excess mileage: {money(vehicle.excessMileageRate)}/km</p> : <p>Mileage allowance is confirmed by the Host.</p>}
      <p>Overtime grace: {vehicle.overtimeGraceMinutes} minutes. The applicable hourly overtime rate will be confirmed by the Host.</p>
    </div>
    <label className="block text-xs font-medium text-slate-700">Message (optional)<textarea maxLength={1500} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Any questions for the Host?"/></label>
    <label className="flex items-start gap-2 text-xs leading-5 text-slate-600"><input required type="checkbox" checked={form.contactConsent} onChange={e=>setForm({...form,contactConsent:e.target.checked})} className="mt-0.5"/><span>I agree that ROAM may share these contact details and dates with this vehicle's Host so they can respond to my inquiry.</span></label>
    <button disabled={busy || !estimate} className="w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Sending…" : "Send rental inquiry"}</button>
  </form>;
}
