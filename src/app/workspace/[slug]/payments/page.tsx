"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, CreditCard, Upload } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Method = { id: string; key: string; label: string; accountName: string | null; instructions: string | null; qrImageData: string | null; qrContentType: string | null };
type Submission = { id: string; methodLabel: string; reference: string; amount: number; paidAt: string; status: string; provisionalUntil: string; rejectionReason: string | null; createdAt: string };
type PageData = { methods: Method[]; submissions: Submission[]; subscription: { tier: string; status: string; planName: string; monthlyPrice: number; currentPeriodEnd: string | null } | null };

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read receipt image."));
    reader.readAsDataURL(file);
  });
}

export default function SubscriptionPaymentsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PageData | null>(null);
  const [methodId, setMethodId] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0,16));
  const [receiptData, setReceiptData] = useState("");
  const [receiptContentType, setReceiptContentType] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/subscription-payments", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load payment details.");
    setData(body);
    if (!methodId && body.methods?.length) setMethodId(body.methods[0].id);
    if (!amount && body.subscription?.monthlyPrice) setAmount(String(body.subscription.monthlyPrice));
  }

  useEffect(() => {
    let active = true;
    fetch("/api/workspaces/" + encodeURIComponent(slug) + "/subscription-payments", { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load payment details."); if (active) { setData(body); setMethodId(body.methods?.[0]?.id || ""); setAmount(body.subscription?.monthlyPrice ? String(body.subscription.monthlyPrice) : ""); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load payment details."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  async function chooseReceipt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError("Receipt screenshot must be PNG, JPG or WebP and no larger than 2 MB.");
      event.target.value = "";
      return;
    }
    try { setReceiptData(await readImage(file)); setReceiptContentType(file.type); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to read receipt."); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/subscription-payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methodId, reference, amount: Number(amount), paidAt: new Date(paidAt).toISOString(), receiptData: receiptData || null, receiptContentType: receiptContentType || null }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to submit payment.");
      setNotice("Payment submitted. Your workspace has provisional access until " + new Date(body.submission.provisionalUntil).toLocaleString("en-PH") + " while an administrator reviews it.");
      setReference(""); setReceiptData(""); setReceiptContentType("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit payment.");
    } finally { setBusy(false); }
  }

  const pending = data?.submissions.find(item => item.status === "PENDING");
  const currentMethod = data?.methods.find(item => item.id === methodId);

  return <div className="min-h-screen bg-[var(--roam-page)]"><WorkspaceNav slug={slug} name="Subscription payments" role="OWNER" active="account"/>
    <main className="roam-main"><div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href={"/workspace/" + slug + "/account"} className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--roam-muted)] hover:text-[var(--roam-text)]"><ArrowLeft size={15}/> Account & subscription</Link>
      <div className="mb-7"><span className="roam-eyebrow">MANUAL SUBSCRIPTION PAYMENT</span><h1 className="mt-2 text-3xl font-bold text-[var(--roam-text)]">Pay by QR code</h1><p className="mt-2 text-sm text-[var(--roam-muted)]">Scan an enabled payment QR code, send your payment, then submit the transaction details for confirmation.</p></div>
      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-600">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700">{notice}</p>}
      {loading ? <p className="py-10 text-sm text-[var(--roam-muted)]">Loading payment methods…</p> : data?.subscription?.tier === "FREE" ? <section className="roam-card p-6"><h2 className="text-lg font-semibold">Complimentary plan</h2><p className="mt-2 text-sm text-[var(--roam-muted)]">Your current plan is free. No subscription payment is required.</p></section> : <>
        {pending && <section className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4"><div className="flex items-center gap-2 font-semibold text-amber-700"><Clock3 size={17}/> Payment awaiting confirmation</div><p className="mt-1 text-sm text-[var(--roam-muted)]">Your submission {pending.reference} is pending. Provisional access ends {new Date(pending.provisionalUntil).toLocaleString("en-PH")} unless it is approved earlier.</p></section>}
        <section className="roam-card mb-6 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[var(--roam-muted)]">Current subscription</p><h2 className="mt-1 text-xl font-bold text-[var(--roam-text)]">{data?.subscription?.planName || "No plan assigned"}</h2></div><p className="text-xl font-bold text-[var(--roam-text)]">₱{(data?.subscription?.monthlyPrice || 0).toLocaleString("en-PH",{minimumFractionDigits:2})}<span className="text-xs font-normal text-[var(--roam-muted)]"> / month</span></p></div></section>
        <section className="mb-6"><h2 className="mb-3 text-lg font-semibold text-[var(--roam-text)]">Available payment methods</h2>
          {data?.methods.length ? <div className="grid gap-4 md:grid-cols-3">{data.methods.map(method => <button type="button" key={method.id} onClick={() => setMethodId(method.id)} className={"roam-card p-4 text-left " + (methodId === method.id ? "ring-2 ring-cyan-500" : "")}>
            <div className="flex items-center justify-between"><span className="font-semibold text-[var(--roam-text)]">{method.label}</span>{methodId === method.id && <CheckCircle2 size={17} className="text-cyan-600"/>}</div>
            {method.qrImageData ? <img src={method.qrImageData} alt={method.label + " QR code"} className="mx-auto my-4 h-40 w-full object-contain"/> : <div className="my-4 grid h-40 place-items-center rounded-xl bg-[var(--roam-panel)] text-center text-xs text-[var(--roam-muted)]">QR code not uploaded yet</div>}
            <p className="text-xs text-[var(--roam-muted)]">{method.accountName || "Recipient details not provided"}</p>
            {method.instructions && <p className="mt-2 whitespace-pre-wrap text-xs text-[var(--roam-muted)]">{method.instructions}</p>}
          </button>)}</div> : <div className="roam-card p-6 text-sm text-[var(--roam-muted)]">No payment methods are enabled yet. Please contact ROAM support or check again later.</div>}
        </section>
        {data?.methods.length ? <form onSubmit={submit} className="roam-card grid gap-4 p-5">
          <h2 className="text-lg font-semibold text-[var(--roam-text)]">Submit payment details</h2>
          <label className="grid gap-1 text-sm text-[var(--roam-muted)]">Payment method<select required value={methodId} onChange={event => setMethodId(event.target.value)} className="roam-input">{data.methods.map(method=><option key={method.id} value={method.id}>{method.label}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-[var(--roam-muted)]">Amount paid (PHP)<input required type="number" min={data.subscription?.monthlyPrice || 0.01} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className="roam-input"/></label>
            <label className="grid gap-1 text-sm text-[var(--roam-muted)]">Date and time paid<input required type="datetime-local" value={paidAt} onChange={event => setPaidAt(event.target.value)} className="roam-input"/></label>
          </div>
          <label className="grid gap-1 text-sm text-[var(--roam-muted)]">Transaction / reference number<input required minLength={3} maxLength={120} value={reference} onChange={event => setReference(event.target.value)} placeholder="Enter the reference from your payment app" className="roam-input"/></label>
          <label className="grid gap-1 text-sm text-[var(--roam-muted)]">Receipt screenshot (optional)<span className="flex items-center gap-2"><Upload size={16}/><input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void chooseReceipt(event)} className="block w-full text-xs"/></span><span className="text-xs">PNG, JPG or WebP · maximum 2 MB</span></label>
          {receiptData && <img src={receiptData} alt="Payment receipt preview" className="max-h-52 max-w-xs rounded-xl object-contain"/>}
          <div className="rounded-xl bg-[var(--roam-panel)] p-3 text-xs leading-5 text-[var(--roam-muted)]">Submitting gives your workspace temporary access for up to 3 days while we verify the payment. Your payment is not marked received until an administrator approves it. If rejected or not approved before expiry, your previous subscription state is restored.</div>
          <button disabled={busy || !!pending || !currentMethod} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : pending ? "Payment already pending" : "Submit payment for review"}</button>
        </form> : null}
        <section className="mt-8"><h2 className="mb-3 text-lg font-semibold text-[var(--roam-text)]">Your payment submissions</h2>
          {data?.submissions.length ? <div className="grid gap-3">{data.submissions.map(item=><article key={item.id} className="roam-card flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold text-[var(--roam-text)]">{item.methodLabel} · ₱{item.amount.toLocaleString("en-PH",{minimumFractionDigits:2})}</p><p className="mt-1 text-xs text-[var(--roam-muted)]">Reference: {item.reference} · {new Date(item.createdAt).toLocaleString("en-PH")}</p>{item.rejectionReason && <p className="mt-1 text-xs text-rose-600">{item.rejectionReason}</p>}</div><span className="rounded-full bg-[var(--roam-panel)] px-3 py-1 text-xs font-bold text-[var(--roam-text)]">{item.status}</span></article>)}</div> : <p className="roam-card p-5 text-sm text-[var(--roam-muted)]">No payment submissions yet.</p>}
        </section>
      </>}
    </div></main>
  </div>;
}
