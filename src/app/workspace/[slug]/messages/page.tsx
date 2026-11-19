"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { MessageCircle, RefreshCw, Search, Send, UserRound, CalendarDays, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";

type Booking = {
  id: string; reference: string; status: string; startAt: string; endAt: string;
  totalAmount: number; createdAt: string;
  customer: { name: string; email: string | null; phone: string };
  vehicles: string[]; documentsCount: number; messagesCount: number;
};
type Message = { id: string; sender: string; body: string; createdAt: string };
type Detail = {
  id: string; reference: string; status: string; startAt: string; endAt: string;
  totalAmount: number; customer: { name: string; email: string | null; phone: string };
  vehicles: { id: string; make: string; model: string; plateNumber: string }[];
  messages: Message[];
};
const money = (n: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);
const date = (value: string) => new Date(value).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function MessagesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [rows, setRows] = useState<Booking[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/bookings", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load conversations.");
      const bookings: Booking[] = body.bookings || [];
      setRows(bookings);
      return bookings;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load conversations.");
      return [];
    } finally { setLoading(false); }
  }, [slug]);

  const open = useCallback(async (reference: string) => {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/bookings/" + encodeURIComponent(reference), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to open conversation.");
      setDetail(body.booking);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open conversation.");
    }
  }, [slug]);

  useEffect(() => {
    let active = true;
    void load().then(bookings => {
      if (active && bookings.length) {
        const first = [...bookings].sort((a, b) => b.messagesCount - a.messagesCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (first) void open(first.reference);
      }
    });
    return () => { active = false; };
  }, [load, open]);

  const filtered = useMemo(() => rows
    .filter(item => filter === "ALL" || (filter === "WITH_MESSAGES" ? item.messagesCount > 0 : item.status === filter))
    .filter(item => [item.reference, item.customer.name, item.customer.email || "", item.customer.phone, ...item.vehicles].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.messagesCount - a.messagesCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [rows, filter, search]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!detail || !reply.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/bookings/" + encodeURIComponent(detail.reference), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to send reply.");
      setReply("");
      await Promise.all([load(), open(detail.reference)]);
      setNotice("Reply sent. The customer email notification was attempted where an email address is available.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send reply.");
    } finally { setBusy(false); }
  }

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Customer messages" role="Workspace team" active="messages" />
    <main className="roam-main roam-messages-main">
      <header className="roam-topbar">
        <div><Link href={"/workspace/" + slug} className="roam-back-link"><ArrowLeft size={14} /> Overview</Link><span className="roam-eyebrow">CUSTOMER RELATIONSHIPS</span><h1>Messages</h1><p>Keep every customer conversation connected to its booking.</p></div>
        <div className="roam-topbar-actions"><span className="roam-date-pill">{rows.filter(item => item.messagesCount > 0).length} conversations</span><button className="roam-secondary-btn" onClick={() => { setLoading(true); void load().then(items => { if (detail && items.some(item => item.reference === detail.reference)) void open(detail.reference); }); }}><RefreshCw size={15} /> Refresh</button></div>
      </header>
      {error && <p className="roam-error" role="alert">{error}</p>}
      {notice && <p className="roam-message-notice" role="status">{notice}</p>}
      <div className="roam-messages-layout">
        <section className="roam-panel roam-messages-list">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">INBOX</span><h2>Customer conversations</h2></div><span className="roam-panel-total">{filtered.length}</span></div>
          <label className="roam-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, phone or booking" /></label>
          <div className="roam-booking-filters">
            {[["ALL", "All"], ["WITH_MESSAGES", "Messages"], ["PENDING", "Pending"], ["CONFIRMED", "Confirmed"], ["ACTIVE", "Active"]].map(([value, label]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
          {loading ? <p className="roam-muted">Loading conversations…</p> : filtered.length ? filtered.map(item => <button key={item.id} className={"roam-inbox-row " + (detail?.id === item.id ? "selected" : "")} onClick={() => void open(item.reference)}>
            <span className="roam-inbox-avatar">{item.customer.name.slice(0, 1).toUpperCase()}</span>
            <span className="roam-inbox-content"><b>{item.customer.name}</b><small>{item.reference} · {item.vehicles.join(", ") || "Vehicle pending"}</small><small>{date(item.startAt)} – {date(item.endAt)}</small><span className={"roam-booking-badge " + item.status.toLowerCase()}>{item.status}</span></span>
            <span className="roam-inbox-meta"><small>{item.messagesCount} messages</small><small>{item.documentsCount} docs</small></span>
          </button>) : <div className="roam-empty"><MessageCircle size={26} /><b>No conversations found</b><span>Customer portal messages will appear here.</span></div>}
        </section>
        <section className="roam-panel roam-messages-thread">
          {detail ? <>
            <div className="roam-panel-heading"><div><span className="roam-eyebrow">BOOKING CONVERSATION</span><h2>{detail.customer.name}</h2><span className="roam-muted">{detail.reference} · {detail.status}</span></div><span className="roam-booking-badge">{detail.messages.length} messages</span></div>
            <div className="roam-message-customer-card"><span className="roam-message-customer-avatar"><UserRound size={18} /></span><div><b>{detail.customer.name}</b><small>{detail.customer.email || "No email address"} · {detail.customer.phone}</small><small>{detail.vehicles.map(vehicle => vehicle.make + " " + vehicle.model + " · " + vehicle.plateNumber).join(", ")}</small></div><Link href={"/workspace/" + slug + "/bookings"}>Booking details</Link></div>
            <div className="roam-message-booking-context"><span><CalendarDays size={14} /> Pickup: {date(detail.startAt)}</span><span>Return: {date(detail.endAt)}</span><b>{money(detail.totalAmount)}</b></div>
            <div className="roam-message-thread" aria-live="polite">
              {detail.messages.length ? detail.messages.map(message => <article key={message.id} className={"roam-thread-message " + message.sender.toLowerCase()}><div><b>{message.sender === "OWNER" ? "Your team" : message.sender === "CUSTOMER" ? detail.customer.name : "ROAM system"}</b><time>{date(message.createdAt)}</time></div><p>{message.body}</p></article>) : <div className="roam-empty"><MessageCircle size={24} /><b>No messages yet</b><span>Send the first message to start the conversation.</span></div>}
            </div>
            <form className="roam-message-compose" onSubmit={send}><label htmlFor="roam-message-reply">Reply to customer</label><textarea id="roam-message-reply" value={reply} onChange={event => setReply(event.target.value)} maxLength={2000} placeholder="Write a message about pickup, documents, payment or return…" required /><div><small>{reply.length}/2,000 characters</small><button className="roam-primary-btn" disabled={busy || !reply.trim()}><Send size={15} /> {busy ? "Sending…" : "Send reply"}</button></div></form>
          </> : <div className="roam-empty roam-message-empty"><MessageCircle size={30} /><b>Select a conversation</b><span>Choose a customer on the left to view the booking context and message history.</span></div>}
        </section>
      </div>
    </main>
  </div>;
}
