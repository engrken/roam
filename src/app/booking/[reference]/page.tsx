"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import "../../[slug]/book/booking-experience.css";

type Message = { id: string; sender: string; body: string; createdAt: string };
type Document = { id: string; kind: string; fileName: string; reviewStatus: string; createdAt?: string };
type Payment = { amount: number; kind: string; method: string; reference: string | null; receivedAt: string };
type Vehicle = { make: string; model: string; year: number | null; type: string; transmission: string | null; seats: number | null; rate: number; branch: { name: string; address: string | null } | null };
type Data = {
  reference: string; status: string; startAt: string; endAt: string; totalAmount: number; paidAmount: number; balanceDue: number; rentalTermsSnapshot?: string | null; rentalTermsAcceptedAt?: string | null;
  business: { name: string; phone: string | null; currency?: string; timezone?: string }; customer?: { name: string };
  vehicles: Vehicle[]; payments: Payment[]; messages: Message[]; documents: Document[];
};
const statusText: Record<string,string> = { PENDING:"Request received", CONFIRMED:"Booking confirmed", ACTIVE:"Rental in progress", COMPLETED:"Rental completed", CANCELLED:"Booking cancelled", REJECTED:"Request not approved" };
const docText: Record<string,string> = { PENDING:"Awaiting review", APPROVED:"Approved", REJECTED:"Needs a new upload" };
function money(value:number,currency="PHP") { try{return new Intl.NumberFormat("en-PH",{style:"currency",currency,maximumFractionDigits:0}).format(value);}catch{return "₱"+Math.round(value).toLocaleString("en-PH");} }
function dateTime(value:string,timeZone="Asia/Manila") { return new Date(value).toLocaleString("en-PH",{timeZone,dateStyle:"medium",timeStyle:"short"}); }

export default function CustomerBookingPage() {
  const { reference } = useParams<{ reference: string }>();
  const query = useSearchParams();
  const token = query.get("token") || "";
  const [data,setData] = useState<Data|null>(null);
  const [message,setMessage] = useState("");
  const [kind,setKind] = useState("DRIVERS_LICENSE_FRONT");
  const [file,setFile] = useState<File|null>(null);
  const [attachmentFile,setAttachmentFile] = useState<File|null>(null);
  const [attachmentKind,setAttachmentKind] = useState("MESSAGE_ATTACHMENT");
  const [linkCopied,setLinkCopied] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const [refreshing,setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/public/bookings/"+encodeURIComponent(reference),{cache:"no-store",headers:{Authorization:"Bearer "+token}});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load booking.");
    setData(body.booking);
  },[reference,token]);

  useEffect(() => {
    let active = true;
    if (!token) return () => { active = false; };
    fetch("/api/public/bookings/" + encodeURIComponent(reference), {
      cache: "no-store",
      headers: { Authorization: "Bearer " + token },
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load booking.");
        if (active) setData(body.booking);
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load booking.");
      });
    return () => { active = false; };
  }, [reference, token]);

  async function reload() {
    setRefreshing(true); setError("");
    try { await refresh(); } catch(reason) { setError(reason instanceof Error ? reason.message : "Unable to refresh booking."); }
    finally { setRefreshing(false); }
  }
  async function send(event:FormEvent) {
    event.preventDefault(); if(!message.trim()&&!attachmentFile)return; setBusy(true); setError(""); setNotice("");
    try {
      if(attachmentFile){
        if(attachmentFile.size>8*1024*1024)throw new Error("Please choose an attachment smaller than 8 MB.");
        await upload(attachmentFile.name,attachmentFile,{access:"private",handleUploadUrl:"/api/public/bookings/upload",clientPayload:JSON.stringify({reference,token,kind:attachmentKind})});
      }
      const messageBody=message.trim()||(attachmentFile?"Please see my attached file: "+attachmentFile.name:"");
      const response=await fetch("/api/public/bookings/"+encodeURIComponent(reference),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,message:messageBody})});
      const body=await response.json(); if(!response.ok) throw new Error(body.error || "Unable to send message.");
      setMessage("");setAttachmentFile(null);setNotice(attachmentFile?"Your message and attachment have been sent.":"Your message has been sent."); await refresh();
    } catch(reason) { setError(reason instanceof Error?reason.message:"Unable to send message."); }
    finally { setBusy(false); }
  }
  async function copyBookingLink(){
    try{await navigator.clipboard.writeText(window.location.href);setLinkCopied(true);window.setTimeout(()=>setLinkCopied(false),2200);}
    catch{setError("Unable to copy the booking link. Please copy it from your browser address bar.");}
  }
  async function copyReference(){
    try{await navigator.clipboard.writeText(data?.reference || reference);setNotice("Booking reference copied.");}
    catch{setError("Unable to copy the booking reference.");}
  }
  async function sendFile(event:FormEvent) {
    event.preventDefault(); if(!file) return;
    if(file.size>8*1024*1024){setError("Please choose a file smaller than 8 MB.");return;}
    setBusy(true); setError(""); setNotice("");
    try {
      await upload(file.name,file,{access:"private",handleUploadUrl:"/api/public/bookings/upload",clientPayload:JSON.stringify({reference,token,kind})});
      setFile(null); setNotice("Document uploaded. The rental team can now review it."); await refresh();
    } catch(reason) { setError(reason instanceof Error?reason.message:"Unable to upload document."); }
    finally { setBusy(false); }
  }

  if(!data) return <main className="client-page"><header className="client-topbar"><Link className="client-brand" href="/"><span>R</span> ROAM</Link><div className="client-topbar-links"><span>PRIVATE BOOKING PORTAL</span><Link href="/help">Booking help</Link></div></header><div className="client-container"><section className="client-success client-loading-card"><div className="client-eyebrow">BOOKING PORTAL</div><h1>{error ? "We couldn’t open this booking" : "Loading your booking…"}</h1><p>{error || (!token ? "This private booking link is incomplete. Please open the original link from your booking confirmation." : "Please wait while we securely retrieve your booking details.")}</p>{error && <Link className="client-primary" href="/">Back to ROAM</Link>}</section></div></main>;

  const statusLabel=statusText[data.status]||data.status.replaceAll("_"," ");
  const timeline=["PENDING","CONFIRMED","ACTIVE","COMPLETED"];
  const currentIndex=timeline.indexOf(data.status);
  const cancelled=["CANCELLED","REJECTED"].includes(data.status);
  return <main className="client-page">
    <header className="client-topbar"><Link href="/" className="client-brand"><span>R</span> ROAM</Link><span>PRIVATE BOOKING PORTAL</span></header>
    <div className="client-container">
      <div className="client-portal-heading"><div><div className="client-eyebrow">{data.business.name}</div><h1>Your booking</h1><p>Reference <b>{data.reference}</b></p></div><div className="client-top-actions" style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="client-refresh" onClick={copyReference}>Copy reference</button><button className="client-refresh" onClick={copyBookingLink}>{linkCopied?"Copied link":"Copy booking link"}</button><button className="client-refresh" onClick={reload} disabled={refreshing}>{refreshing?"Refreshing…":"↻ Refresh status"}</button></div></div>
      {error && <div className="client-alert" role="alert">{error}</div>}{notice && <div className="client-notice" role="status">{notice}</div>}
      <section className="client-status-card"><div className="client-status-top"><div><span className="client-eyebrow">CURRENT STATUS</span><h2>{statusLabel}</h2></div><span className={"client-status-pill "+(cancelled?"is-muted":data.status==="COMPLETED"?"is-done":"")}>{data.status.replaceAll("_"," ")}</span></div>
        {cancelled ? <p className="client-status-note">Please contact the rental team if you need clarification or would like to discuss another date.</p> :
        <div className="client-progress">{timeline.map((step,index)=><div key={step} className={"client-progress-step "+(currentIndex>=index?"is-reached":"")}><span>{currentIndex>index?"✓":index+1}</span><small>{step==="ACTIVE"?"Active · pending return":statusText[step]}</small></div>)}</div>}
      </section>
      <div className="client-portal-grid">
        <div className="client-portal-main">
          <section className="client-panel"><div className="client-panel-heading"><div><span className="client-eyebrow">YOUR RENTAL</span><h2>Booking details</h2></div><span className="client-reference-mini">{data.reference}</span></div>
            <div className="client-detail-grid"><div><small>PICKUP</small><strong>{dateTime(data.startAt,data.business.timezone)}</strong></div><div><small>RETURN</small><strong>{dateTime(data.endAt,data.business.timezone)}</strong></div><div><small>RENTAL TOTAL</small><strong>{money(data.totalAmount,data.business.currency)}</strong></div><div><small>BOOKED UNDER</small><strong>{data.customer?.name || "Customer"}</strong></div></div>
          </section>
          <section className="client-panel roam-customer-summary-panel">
            <div className="client-panel-heading"><div><span className="client-eyebrow">VEHICLE & PAYMENT</span><h2>Your rental summary</h2></div></div>
            {data.vehicles?.length ? <div className="roam-customer-vehicle-list">{data.vehicles.map((vehicle,index)=><div key={index}><span className="roam-customer-vehicle-icon">🚘</span><span><b>{vehicle.year ? vehicle.year+" " : ""}{vehicle.make} {vehicle.model}</b><small>{[vehicle.type.replaceAll("_"," "),vehicle.transmission,vehicle.seats ? vehicle.seats+" seats" : null].filter(Boolean).join(" · ")}</small><small>{vehicle.branch?.name || "Pickup location to be confirmed"}{vehicle.branch?.address ? " · "+vehicle.branch.address : ""}</small></span><strong>{money(vehicle.rate,data.business.currency)}<small>/day</small></strong></div>)}</div> : <p className="client-panel-copy">Vehicle details will appear here.</p>}
            <div className="roam-customer-payment-summary">
              <div><small>RENTAL TOTAL</small><b>{money(data.totalAmount,data.business.currency)}</b></div>
              <div><small>PAYMENTS RECORDED</small><b>{money(data.paidAmount || 0,data.business.currency)}</b></div>
              <div><small>REMAINING BALANCE</small><b>{money(data.balanceDue ?? data.totalAmount,data.business.currency)}</b></div>
            </div>
            {data.payments?.length ? <div className="roam-customer-payment-list">{data.payments.map((payment,index)=><div key={index}><span><b>{payment.kind.replaceAll("_"," ")}</b><small>{payment.method.replaceAll("_"," ")} · {dateTime(payment.receivedAt,data.business.timezone)}{payment.reference ? " · "+payment.reference : ""}</small></span><strong>{payment.kind==="REFUND"?"−":""}{money(payment.amount,data.business.currency)}</strong></div>)}</div> : <p className="client-panel-copy">No payment has been recorded by the rental team yet. Payment instructions and arrangements will be confirmed directly by the business.</p>}
            <p className="roam-customer-finance-note">Payment figures reflect transactions recorded by the rental business. Uploading proof of payment does not itself count as a recorded payment.</p>
          </section>
          {data.rentalTermsSnapshot && <section className="client-panel"><div className="client-panel-heading"><div><span className="client-eyebrow">RENTAL AGREEMENT</span><h2>Terms you accepted</h2></div></div><div className="client-rental-terms-copy">{data.rentalTermsSnapshot}</div>{data.rentalTermsAcceptedAt && <p className="client-panel-copy">Accepted on {new Date(data.rentalTermsAcceptedAt).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})}.</p>}</section>}
          <section className="client-panel"><div className="client-panel-heading"><div><span className="client-eyebrow">DOCUMENT CHECKLIST</span><h2>Your documents</h2></div><span className="client-count">{data.documents.length} uploaded</span></div>
            <p className="client-panel-copy">Upload clear photos or PDFs. Accepted formats: JPG, PNG, WebP, PDF. Maximum 8 MB per file.</p>
            <form onSubmit={sendFile} className="client-upload-form"><label>Document type<select value={kind} onChange={event=>setKind(event.target.value)}><option value="DRIVERS_LICENSE_FRONT">Driver’s license — front</option><option value="DRIVERS_LICENSE_BACK">Driver’s license — back</option><option value="IDENTITY_DOCUMENT">Government-issued ID</option><option value="OTHER_REQUIREMENT">Other requirement</option></select></label><label className="client-file-picker"><span>{file ? file.name : "Choose a file"}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event=>setFile(event.target.files?.[0]||null)}/></label><button className="client-primary" disabled={busy||!file}>{busy?"Uploading…":"Upload document"} <span>↑</span></button></form>
            {data.documents.length ? <div className="client-document-list">{data.documents.map(document=><div key={document.id}><span className="client-doc-icon">▤</span><span className="client-doc-name"><b>{document.kind.replaceAll("_"," ")}</b><small>{document.fileName}</small></span><span className={"client-doc-status status-"+document.reviewStatus.toLowerCase()}>{docText[document.reviewStatus]||document.reviewStatus}</span></div>)}</div> : <div className="client-empty-inline">No documents uploaded yet. Add the documents requested by the rental team.</div>}
          </section>
          <section className="client-panel"><div className="client-panel-heading"><div><span className="client-eyebrow">DIRECT COMMUNICATION</span><h2>Messages</h2></div><span className="client-count">{data.messages.length} updates</span></div>
            <div className="client-message-list">{data.messages.length ? data.messages.map(item=><article key={item.id} className={"client-message "+(item.sender==="CUSTOMER"?"from-customer":"")}><div><b>{item.sender==="CUSTOMER"?"You":item.sender==="SYSTEM"?"ROAM":"Rental team"}</b><time>{new Date(item.createdAt).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})}</time></div><p>{item.body}</p></article>) : <p className="client-empty-inline">No messages yet.</p>}</div>
            <form onSubmit={send} className="client-message-form"><label htmlFor="client-message">Send a message to the rental team</label><textarea id="client-message" maxLength={2000} value={message} onChange={event=>setMessage(event.target.value)} placeholder="Ask about pickup, requirements, payment or return…"/><label>Attach a screenshot or file<select value={attachmentKind} onChange={event=>setAttachmentKind(event.target.value)}><option value="MESSAGE_ATTACHMENT">General message attachment</option><option value="PAYMENT_EVIDENCE">Proof of payment</option></select></label><label className="client-file-picker"><span>{attachmentFile?attachmentFile.name:"Choose an attachment (JPG, PNG, WebP or PDF · max 8 MB)"}</span><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={event=>setAttachmentFile(event.target.files?.[0]||null)}/></label><div><small>{message.length}/2,000 characters · {attachmentFile?"1 attachment selected":"No attachment"}</small><button className="client-primary" disabled={busy||(!message.trim()&&!attachmentFile)}>{busy?"Sending…":"Send message"} <span>→</span></button></div></form>
          </section>
        </div>
        <aside className="client-portal-side"><section className="client-panel client-help-panel"><span className="client-eyebrow">NEED HELP?</span><h2>Talk to the rental team.</h2><p>For changes to your booking, pickup instructions, or urgent questions, contact the business directly.</p>{data.business.phone ? <a className="client-primary" href={"tel:"+data.business.phone}>Call {data.business.phone} <span>↗</span></a> : <p className="client-panel-copy">Send a message through this portal and the team will get back to you.</p>}</section><div className="client-security-note">🔒 <span><b>Your link is private</b><small>Anyone with this unique link can view this booking. Keep it to yourself.</small></span></div></aside>
      </div>
      <footer className="client-footer">Powered by <b>ROAM</b> · Your rental, in one place.</footer>
    </div>
  </main>;
}
