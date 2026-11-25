"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CarFront, Check, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, RefreshCw, Search, ShieldCheck, Wrench } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Vehicle = {
  id:string; type:string; make:string; model:string; year:number|null; plateNumber:string; color:string|null;
  dailyRate:number; securityDeposit:number; selfDriveEnabled:boolean; withDriverEnabled:boolean; withDriverDailyRate:number|null;
  hourlyRate:number|null; weeklyRate:number|null; monthlyRate:number|null; withDriverHourlyRate:number|null;
  withDriverWeeklyRate:number|null; withDriverMonthlyRate:number|null; deliveryAvailable:boolean; deliveryFee:number;
  includedKmPerDay:number|null; excessMileageRate:number; overtimeGraceMinutes:number; overtimeHourlyRate:number|null;
  withDriverOvertimeHourlyRate:number|null; status:string; branchId:string|null; branchName:string;
};
type Branch = {id:string;name:string;code:string|null};
type VehicleForm = {
  type:string;make:string;model:string;year:string;plateNumber:string;color:string;dailyRate:string;securityDeposit:string;
  selfDriveEnabled:boolean;withDriverEnabled:boolean;withDriverDailyRate:string;hourlyRate:string;weeklyRate:string;monthlyRate:string;
  withDriverHourlyRate:string;withDriverWeeklyRate:string;withDriverMonthlyRate:string;deliveryAvailable:boolean;deliveryFee:string;
  includedKmPerDay:string;excessMileageRate:string;overtimeGraceMinutes:string;overtimeHourlyRate:string;
  withDriverOvertimeHourlyRate:string;branchId:string;
};
const types = ["MOTORCYCLE","SCOOTER","SEDAN","HATCHBACK","SUV","MPV","VAN","PICKUP","BUS","TRUCK","OTHER"];
const statuses = ["AVAILABLE","RESERVED","RENTED","MAINTENANCE","INACTIVE"] as const;
const ratePeriods = [
  {key:"hourlyRate",label:"Hourly"},
  {key:"weeklyRate",label:"Weekly"},
  {key:"monthlyRate",label:"Monthly"},
] as const;
const money = (value:number) => new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP",maximumFractionDigits:0}).format(value);
const formatType = (value:string) => value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase());
const emptyForm = ():VehicleForm => ({
  type:"MOTORCYCLE",make:"",model:"",year:"",plateNumber:"",color:"",dailyRate:"",securityDeposit:"",
  selfDriveEnabled:true,withDriverEnabled:false,withDriverDailyRate:"",hourlyRate:"",weeklyRate:"",monthlyRate:"",
  withDriverHourlyRate:"",withDriverWeeklyRate:"",withDriverMonthlyRate:"",deliveryAvailable:false,deliveryFee:"0",
  includedKmPerDay:"",excessMileageRate:"0",overtimeGraceMinutes:"0",overtimeHourlyRate:"",
  withDriverOvertimeHourlyRate:"",branchId:"",
});
const statusLabels:Record<string,string> = {
  AVAILABLE:"Available",RESERVED:"Reserved",RENTED:"On rent",MAINTENANCE:"In maintenance",INACTIVE:"Inactive",
};

export default function FleetPage() {
  const {slug} = useParams<{slug:string}>();
  const formRef = useRef<HTMLFormElement>(null);
  const [vehicles,setVehicles] = useState<Vehicle[]>([]);
  const [branches,setBranches] = useState<Branch[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [search,setSearch] = useState("");
  const [filter,setFilter] = useState("ALL");
  const [showForm,setShowForm] = useState(false);
  const [formStep,setFormStep] = useState(0);
  const [busy,setBusy] = useState(false);
  const [editingId,setEditingId] = useState<string|null>(null);
  const [form,setForm] = useState<VehicleForm>(emptyForm);

  const load = useCallback(async () => {
    try {
      const [vehicleResponse,branchResponse] = await Promise.all([
        fetch("/api/workspaces/"+encodeURIComponent(slug)+"/vehicles",{cache:"no-store"}),
        fetch("/api/workspaces/"+encodeURIComponent(slug)+"/branches",{cache:"no-store"}),
      ]);
      const vehicleData = await vehicleResponse.json();
      const branchData = await branchResponse.json();
      if (!vehicleResponse.ok) throw new Error(vehicleData.error || "Unable to load your fleet.");
      setVehicles(vehicleData.vehicles || []);
      setBranches(branchData.branches || []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load your fleet.");
    } finally {
      setLoading(false);
    }
  },[slug]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {if(active) void load();});
    return () => {active=false;};
  },[load]);

  function openAddForm() {
    setEditingId(null);setForm(emptyForm());setFormStep(0);setError("");setShowForm(true);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function editVehicle(vehicle:Vehicle) {
    setEditingId(vehicle.id);
    setForm({
      type:vehicle.type,make:vehicle.make,model:vehicle.model,year:vehicle.year?String(vehicle.year):"",
      plateNumber:vehicle.plateNumber,color:vehicle.color||"",dailyRate:String(vehicle.dailyRate),securityDeposit:String(vehicle.securityDeposit),
      selfDriveEnabled:vehicle.selfDriveEnabled,withDriverEnabled:vehicle.withDriverEnabled,
      withDriverDailyRate:vehicle.withDriverDailyRate===null?"":String(vehicle.withDriverDailyRate),
      hourlyRate:vehicle.hourlyRate===null?"":String(vehicle.hourlyRate),weeklyRate:vehicle.weeklyRate===null?"":String(vehicle.weeklyRate),
      monthlyRate:vehicle.monthlyRate===null?"":String(vehicle.monthlyRate),
      withDriverHourlyRate:vehicle.withDriverHourlyRate===null?"":String(vehicle.withDriverHourlyRate),
      withDriverWeeklyRate:vehicle.withDriverWeeklyRate===null?"":String(vehicle.withDriverWeeklyRate),
      withDriverMonthlyRate:vehicle.withDriverMonthlyRate===null?"":String(vehicle.withDriverMonthlyRate),
      deliveryAvailable:vehicle.deliveryAvailable,deliveryFee:String(vehicle.deliveryFee),
      includedKmPerDay:vehicle.includedKmPerDay===null?"":String(vehicle.includedKmPerDay),
      excessMileageRate:String(vehicle.excessMileageRate),overtimeGraceMinutes:String(vehicle.overtimeGraceMinutes),
      overtimeHourlyRate:vehicle.overtimeHourlyRate===null?"":String(vehicle.overtimeHourlyRate),
      withDriverOvertimeHourlyRate:vehicle.withDriverOvertimeHourlyRate===null?"":String(vehicle.withDriverOvertimeHourlyRate),
      branchId:vehicle.branchId||"",
    });
    setFormStep(0);setError("");setShowForm(true);window.scrollTo({top:0,behavior:"smooth"});
  }
  function cancelForm() {
    setShowForm(false);setEditingId(null);setForm(emptyForm());setFormStep(0);
  }
  function nextStep() {
    setError("");
    if (!formRef.current?.reportValidity()) return;
    if (formStep===1 && !form.selfDriveEnabled && !form.withDriverEnabled) {
      setError("Choose at least one rental option before continuing.");return;
    }
    setFormStep(step=>Math.min(2,step+1));
  }
  async function saveVehicle(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    if (!form.selfDriveEnabled && !form.withDriverEnabled) {
      setError("Choose at least one rental option.");setFormStep(1);return;
    }
    setBusy(true);setError("");
    try {
      const response = await fetch("/api/workspaces/"+encodeURIComponent(slug)+"/vehicles",{
        method:editingId?"PATCH":"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(editingId?{...form,id:editingId}:form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save vehicle.");
      cancelForm();await load();
    } catch (caught) {
      setError(caught instanceof Error?caught.message:"Unable to save vehicle.");
    } finally {setBusy(false);}
  }
  async function changeStatus(id:string,status:string) {
    setError("");
    try {
      const response = await fetch("/api/workspaces/"+encodeURIComponent(slug)+"/vehicles",{
        method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update vehicle status.");
      setVehicles(current=>current.map(vehicle=>vehicle.id===id?{...vehicle,status}:vehicle));
    } catch (caught) {
      setError(caught instanceof Error?caught.message:"Unable to update vehicle status.");
    }
  }

  const counts = Object.fromEntries(statuses.map(status=>[status,vehicles.filter(vehicle=>vehicle.status===status).length]));
  const query = search.trim().toLowerCase();
  const visible = vehicles.filter(vehicle=>{
    const matchesStatus = filter==="ALL" || vehicle.status===filter;
    const searchable = [vehicle.make,vehicle.model,vehicle.plateNumber,vehicle.branchName,vehicle.type].join(" ").toLowerCase();
    return matchesStatus && searchable.includes(query);
  });
  const configuredPeriods = (vehicle:Vehicle,mode:"selfDrive"|"withDriver") => {
    const fields = mode==="selfDrive"
      ? {hourlyRate:vehicle.hourlyRate,weeklyRate:vehicle.weeklyRate,monthlyRate:vehicle.monthlyRate}
      : {hourlyRate:vehicle.withDriverHourlyRate,weeklyRate:vehicle.withDriverWeeklyRate,monthlyRate:vehicle.withDriverMonthlyRate};
    return ratePeriods.filter(period=>fields[period.key]!==null && fields[period.key]!==undefined);
  };

  if (loading) return <main className="roam-loading">Loading your fleet…</main>;

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Fleet management" role="Workspace team" active="fleet"/>
    <main className="roam-main fm-main">
      <header className="roam-topbar">
        <div>
          <Link href={"/workspace/"+slug} className="roam-back-link">Overview</Link>
          <span className="roam-eyebrow">FLEET OPERATIONS</span>
          <h1>Fleet management</h1>
          <p>Register vehicles, organize rental prices and keep availability accurate.</p>
        </div>
        <div className="roam-topbar-actions">
          <button type="button" className="roam-secondary-btn" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button>
          <button type="button" className="roam-primary-btn" onClick={openAddForm}><Plus size={16}/> Add vehicle</button>
        </div>
      </header>

      <section className="fm-stats" aria-label="Fleet summary">
        <article className="fm-stat fm-stat-total"><span>Total vehicles</span><b>{vehicles.length}</b><small>Registered in this workspace</small></article>
        <article className="fm-stat fm-stat-available"><span>Available</span><b>{counts.AVAILABLE||0}</b><small>Ready for new requests</small></article>
        <article className="fm-stat fm-stat-rented"><span>On rent</span><b>{counts.RENTED||0}</b><small>Currently with customers</small></article>
        <article className="fm-stat fm-stat-maintenance"><span>Unavailable</span><b>{(counts.MAINTENANCE||0)+(counts.INACTIVE||0)}</b><small>Maintenance or inactive</small></article>
      </section>

      <section className="fm-onboarding roam-panel" aria-labelledby="fm-onboarding-title">
        <div className="fm-onboarding-heading">
          <div><span className="roam-eyebrow">A SIMPLE SETUP CHECKLIST</span><h2 id="fm-onboarding-title">Get your fleet ready to rent</h2><p>Complete these basics before sharing your booking page with customers.</p></div>
          <Link className="fm-guide-link" href={"/workspace/"+slug+"/help#fleet"}>Open fleet guide <ArrowUpRight size={15}/></Link>
        </div>
        <div className="fm-checklist">
          <div><span className="fm-check-number">1</span><span><b>Register each vehicle</b><small>Add its make, model, plate and pickup branch.</small></span></div>
          <div><span className="fm-check-number">2</span><span><b>Set your rental prices</b><small>Choose self-drive, with-driver, or both.</small></span></div>
          <div><span className="fm-check-number">3</span><span><b>Explain extra charges</b><small>Set deposits, delivery, mileage and overtime rules.</small></span></div>
          <div><span className="fm-check-number">4</span><span><b>Check availability</b><small>Only mark a vehicle Available when it is ready.</small></span></div>
        </div>
      </section>

      {error && <p className="roam-error fm-alert" role="alert">{error}</p>}

      {showForm && <form ref={formRef} className="roam-panel fm-editor" onSubmit={saveVehicle}>
        <div className="fm-editor-heading">
          <div><span className="roam-eyebrow">{editingId?"UPDATE VEHICLE":"NEW VEHICLE"}</span><h2>{editingId?"Edit vehicle details":"Add a vehicle"}</h2><p>Follow the three steps. Optional rate periods can be added later.</p></div>
          <button type="button" className="roam-quiet-btn" onClick={cancelForm}>Cancel</button>
        </div>
        <div className="fm-stepper" aria-label="Vehicle setup progress">
          {["Vehicle details","Rental prices","Extras & rules"].map((label,index)=><button type="button" key={label} className={"fm-step"+(formStep===index?" is-active":"")+(formStep>index?" is-complete":"")} disabled={index>formStep} aria-current={formStep===index?"step":undefined} onClick={()=>setFormStep(index)}><span>{formStep>index?<Check size={14}/>:index+1}</span>{label}</button>)}
        </div>

        {formStep===0 && <section className="fm-form-step" aria-labelledby="fm-vehicle-details-title">
          <div className="fm-step-intro"><span className="fm-step-icon"><CarFront size={19}/></span><div><h3 id="fm-vehicle-details-title">First, identify the vehicle</h3><p>Use the details your staff will recognize on the vehicle and registration.</p></div></div>
          <div className="fm-fields-grid">
            <label>Vehicle type<select required value={form.type} onChange={event=>setForm({...form,type:event.target.value})}>{types.map(type=><option key={type} value={type}>{formatType(type)}</option>)}</select></label>
            <label>Make<input required minLength={2} value={form.make} onChange={event=>setForm({...form,make:event.target.value})} placeholder="e.g. Honda"/></label>
            <label>Model<input required value={form.model} onChange={event=>setForm({...form,model:event.target.value})} placeholder="e.g. Click 160"/></label>
            <label>Plate number<input required value={form.plateNumber} onChange={event=>setForm({...form,plateNumber:event.target.value.toUpperCase()})} placeholder="e.g. ABC 1234"/></label>
            <label>Year <span className="fm-optional">Optional</span><input type="number" min="1950" max={new Date().getFullYear()+1} value={form.year} onChange={event=>setForm({...form,year:event.target.value})} placeholder="2025"/></label>
            <label>Color <span className="fm-optional">Optional</span><input value={form.color} onChange={event=>setForm({...form,color:event.target.value})} placeholder="e.g. Matte black"/></label>
            <label>Pickup branch <span className="fm-optional">Optional</span><select value={form.branchId} onChange={event=>setForm({...form,branchId:event.target.value})}><option value="">Unassigned</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          </div>
          <div className="fm-tip"><MapPin size={16}/><span>Assign a branch when you have multiple pickup locations. You can leave this unassigned for now.</span></div>
        </section>}

        {formStep===1 && <section className="fm-form-step" aria-labelledby="fm-rental-prices-title">
          <div className="fm-step-intro"><span className="fm-step-icon"><Clock3 size={19}/></span><div><h3 id="fm-rental-prices-title">Choose how this vehicle can be rented</h3><p>Enable one or both rental options. A daily rate is required for each option you enable.</p></div></div>
          <div className="fm-mode-grid">
            <label className={"fm-mode-card"+(form.selfDriveEnabled?" is-selected":"")}><input type="checkbox" checked={form.selfDriveEnabled} onChange={event=>setForm({...form,selfDriveEnabled:event.target.checked})}/><span className="fm-mode-copy"><b>Self-drive</b><small>The customer drives the vehicle.</small></span><span className="fm-mode-check"><Check size={14}/></span></label>
            <label className={"fm-mode-card"+(form.withDriverEnabled?" is-selected":"")}><input type="checkbox" checked={form.withDriverEnabled} onChange={event=>setForm({...form,withDriverEnabled:event.target.checked})}/><span className="fm-mode-copy"><b>With driver</b><small>Your driver is included in the rental.</small></span><span className="fm-mode-check"><Check size={14}/></span></label>
          </div>
          {!form.selfDriveEnabled && !form.withDriverEnabled && <p className="fm-inline-warning">Enable at least one rental option to continue.</p>}
          <div className="fm-rate-panels">
            {form.selfDriveEnabled && <section className="fm-rate-panel">
              <div><b>Self-drive rates</b><small>Prices charged when the customer drives.</small></div>
              <label>Daily rate <strong className="fm-required">Required</strong><span className="fm-input-with-prefix"><i>₱</i><input required type="number" min="0" step="0.01" value={form.dailyRate} onChange={event=>setForm({...form,dailyRate:event.target.value})} placeholder="1,200"/></span></label>
              <div className="fm-extra-rates">
                {ratePeriods.map(period=><label key={period.key}>{period.label} rate <span className="fm-optional">Optional</span><span className="fm-input-with-prefix"><i>₱</i><input type="number" min="0" step="0.01" value={form[period.key]} onChange={event=>setForm({...form,[period.key]:event.target.value})} placeholder="Not offered"/></span></label>)}
              </div>
            </section>}
            {form.withDriverEnabled && <section className="fm-rate-panel">
              <div><b>With-driver rates</b><small>Enter the full rental price, including the driver.</small></div>
              <label>Daily rate <strong className="fm-required">Required</strong><span className="fm-input-with-prefix"><i>₱</i><input required type="number" min="0" step="0.01" value={form.withDriverDailyRate} onChange={event=>setForm({...form,withDriverDailyRate:event.target.value})} placeholder="3,500"/></span></label>
              <div className="fm-extra-rates">
                <label>Hourly rate <span className="fm-optional">Optional</span><span className="fm-input-with-prefix"><i>₱</i><input type="number" min="0" step="0.01" value={form.withDriverHourlyRate} onChange={event=>setForm({...form,withDriverHourlyRate:event.target.value})} placeholder="Not offered"/></span></label>
                <label>Weekly rate <span className="fm-optional">Optional</span><span className="fm-input-with-prefix"><i>₱</i><input type="number" min="0" step="0.01" value={form.withDriverWeeklyRate} onChange={event=>setForm({...form,withDriverWeeklyRate:event.target.value})} placeholder="Not offered"/></span></label>
                <label>Monthly rate <span className="fm-optional">Optional</span><span className="fm-input-with-prefix"><i>₱</i><input type="number" min="0" step="0.01" value={form.withDriverMonthlyRate} onChange={event=>setForm({...form,withDriverMonthlyRate:event.target.value})} placeholder="Not offered"/></span></label>
              </div>
            </section>}
          </div>
          <p className="fm-footnote">Hourly, weekly and monthly prices are optional. A monthly period is 30 days. Renters only see periods with a saved rate.</p>
        </section>}

        {formStep===2 && <section className="fm-form-step" aria-labelledby="fm-extras-title">
          <div className="fm-step-intro"><span className="fm-step-icon"><ShieldCheck size={19}/></span><div><h3 id="fm-extras-title">Set deposits and usage rules</h3><p>These details help customers understand the full cost before requesting a booking.</p></div></div>
          <div className="fm-fields-grid">
            <label>Refundable security deposit (₱)<span className="fm-optional">Optional</span><input type="number" min="0" step="0.01" value={form.securityDeposit} onChange={event=>setForm({...form,securityDeposit:event.target.value})} placeholder="0"/><small>Collected separately from the rental price.</small></label>
            <label>Overtime grace period (minutes)<span className="fm-optional">Optional</span><input type="number" min="0" max="1440" step="1" value={form.overtimeGraceMinutes} onChange={event=>setForm({...form,overtimeGraceMinutes:event.target.value})}/><small>Extra time allowed before overtime begins.</small></label>
            <label>Included mileage (km/day)<span className="fm-optional">Optional</span><input type="number" min="0" max="100000" step="1" value={form.includedKmPerDay} onChange={event=>setForm({...form,includedKmPerDay:event.target.value})} placeholder="No daily limit"/><small>Leave blank when you do not set a daily limit.</small></label>
            <label>Excess mileage (₱/km)<span className="fm-optional">Optional</span><input type="number" min="0" step="0.01" value={form.excessMileageRate} onChange={event=>setForm({...form,excessMileageRate:event.target.value})} placeholder="0"/><small>Charge only above the included allowance.</small></label>
          </div>
          <div className="fm-delivery-card">
            <div><b>Offer vehicle delivery</b><small>Let customers request delivery instead of collecting the vehicle.</small></div>
            <label className="fm-switch"><input type="checkbox" checked={form.deliveryAvailable} onChange={event=>setForm({...form,deliveryAvailable:event.target.checked})}/><span>{form.deliveryAvailable?"Enabled":"Disabled"}</span></label>
            {form.deliveryAvailable && <label className="fm-delivery-fee">Delivery fee per booking (₱)<span className="fm-input-with-prefix"><i>₱</i><input type="number" min="0" step="0.01" value={form.deliveryFee} onChange={event=>setForm({...form,deliveryFee:event.target.value})} placeholder="0"/></span></label>}
          </div>
          <div className="fm-fields-grid fm-overtime-grid">
            {form.selfDriveEnabled && <label>Self-drive overtime (₱/hour)<span className="fm-optional">Optional</span><input type="number" min="0" step="0.01" value={form.overtimeHourlyRate} onChange={event=>setForm({...form,overtimeHourlyRate:event.target.value})} placeholder="Not charged"/></label>}
            {form.withDriverEnabled && <label>With-driver overtime (₱/hour)<span className="fm-optional">Optional</span><input type="number" min="0" step="0.01" value={form.withDriverOvertimeHourlyRate} onChange={event=>setForm({...form,withDriverOvertimeHourlyRate:event.target.value})} placeholder="Not charged"/></label>}
          </div>
          <div className="fm-tip"><ShieldCheck size={16}/><span>Explain deposits, delivery, mileage and late-return rules in <Link href={"/workspace/"+slug+"/rental-terms"}>Rental terms</Link> so customers can review them before booking.</span></div>
        </section>}

        <div className="fm-form-footer">
          <span>Step {formStep+1} of 3</span>
          <div>
            {formStep>0 && <button type="button" className="roam-secondary-btn" onClick={()=>{setError("");setFormStep(step=>Math.max(0,step-1));}}><ChevronLeft size={15}/> Back</button>}
            {formStep<2
              ? <button type="button" className="roam-primary-btn" onClick={nextStep}>Continue <ChevronRight size={15}/></button>
              : <button type="submit" className="roam-primary-btn" disabled={busy}>{busy?"Saving…":editingId?"Save vehicle":"Add vehicle"} <Check size={15}/></button>}
          </div>
        </div>
      </form>}

      <section className="roam-panel fm-vehicle-section" aria-labelledby="fm-vehicles-title">
        <div className="fm-list-heading">
          <div><span className="roam-eyebrow">FLEET REGISTER</span><h2 id="fm-vehicles-title">Your vehicles <span>{vehicles.length}</span></h2><p>Search, filter and update your vehicles from one place.</p></div>
          <button type="button" className="roam-secondary-btn fm-add-secondary" onClick={openAddForm}><Plus size={15}/> Add vehicle</button>
        </div>
        <div className="fm-toolbar">
          <label className="fm-search"><Search size={17}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search vehicle, plate or branch" aria-label="Search vehicles"/>{search && <button type="button" onClick={()=>setSearch("")} aria-label="Clear search">×</button>}</label>
          <div className="fm-results-count">{visible.length} of {vehicles.length} vehicles</div>
        </div>
        <div className="fm-filter-row" aria-label="Filter vehicles by availability">
          <button type="button" className={filter==="ALL"?"is-active":""} aria-pressed={filter==="ALL"} onClick={()=>setFilter("ALL")}>All <b>{vehicles.length}</b></button>
          {statuses.map(status=><button type="button" key={status} className={filter===status?"is-active":""} aria-pressed={filter===status} onClick={()=>setFilter(status)}>{statusLabels[status]} <b>{counts[status]||0}</b></button>)}
        </div>

        {visible.length>0 ? <div className="fm-vehicle-grid">
          {visible.map(vehicle=>{
            const selfPeriods=configuredPeriods(vehicle,"selfDrive");
            const driverPeriods=configuredPeriods(vehicle,"withDriver");
            return <article className="fm-vehicle-card" key={vehicle.id}>
              <div className="fm-vehicle-card-top"><span className="fm-vehicle-icon"><CarFront size={22}/></span><span className={"fm-status fm-status-"+vehicle.status.toLowerCase()}>{statusLabels[vehicle.status]||formatType(vehicle.status)}</span></div>
              <div className="fm-vehicle-name"><h3>{vehicle.make} {vehicle.model}</h3><p>{vehicle.year||"Year not set"} · {formatType(vehicle.type)}</p></div>
              <div className="fm-vehicle-meta"><span>Plate number</span><b>{vehicle.plateNumber}</b></div>
              <div className="fm-vehicle-meta"><span>Pickup branch</span><b>{vehicle.branchName||"Unassigned"}</b></div>
              <div className="fm-rental-summary">
                {vehicle.selfDriveEnabled && <div><span>Self-drive</span><b>{money(vehicle.dailyRate)}<small>/day</small></b></div>}
                {vehicle.withDriverEnabled && <div><span>With driver</span><b>{money(vehicle.withDriverDailyRate||0)}<small>/day</small></b></div>}
              </div>
              <div className="fm-card-tags">
                {vehicle.deliveryAvailable && <span>Delivery</span>}
                {vehicle.includedKmPerDay!==null && <span>{vehicle.includedKmPerDay} km/day</span>}
                {selfPeriods.map(period=><span key={period.key}>{period.label}</span>)}
                {driverPeriods.map(period=><span key={"driver-"+period.key}>Driver {period.label.toLowerCase()}</span>)}
                {vehicle.securityDeposit>0 && <span>Deposit set</span>}
              </div>
              <div className="fm-card-actions">
                <label><span className="fm-visually-hidden">Availability for {vehicle.make} {vehicle.model}</span><select className={"fm-status-select fm-status-select-"+vehicle.status.toLowerCase()} value={vehicle.status} onChange={event=>void changeStatus(vehicle.id,event.target.value)}>{statuses.map(status=><option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
                <button type="button" className="fm-edit-btn" onClick={()=>editVehicle(vehicle)}>Edit details <ArrowRight size={14}/></button>
              </div>
            </article>;
          })}
        </div> : <div className="fm-empty-state">
          <span><CarFront size={26}/></span>
          <h3>{vehicles.length?"No matching vehicles":"Your fleet starts here"}</h3>
          <p>{vehicles.length?"Try a different search or choose another availability filter.":"Add your first vehicle to start setting rates and receiving rental requests."}</p>
          {vehicles.length ? <button type="button" className="roam-secondary-btn" onClick={()=>{setSearch("");setFilter("ALL");}}>Clear filters</button> : <button type="button" className="roam-primary-btn" onClick={openAddForm}><Plus size={15}/> Add your first vehicle</button>}
        </div>}
      </section>

      <section className="fm-next-actions" aria-label="Related fleet tasks">
        <Link href={"/workspace/"+slug+"/maintenance"}><span><Wrench size={18}/></span><b>Maintenance & expenses</b><small>Plan vehicle downtime and track service costs.</small><ArrowUpRight size={16}/></Link>
        <Link href={"/workspace/"+slug+"/calendar"}><span><Clock3 size={18}/></span><b>Fleet calendar</b><small>See rentals, returns and availability by date.</small><ArrowUpRight size={16}/></Link>
        <Link href={"/workspace/"+slug+"/help#fleet"}><span><ShieldCheck size={18}/></span><b>Fleet setup guide</b><small>Read the step-by-step vehicle and pricing guide.</small><ArrowUpRight size={16}/></Link>
      </section>
      <footer className="roam-footer">ROAM Fleet Management <span>Vehicle records are isolated to this workspace.</span></footer>
    </main>
  </div>;
}
