"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MessageCircle, Search, Send, RefreshCw, UserRound, CalendarDays, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";

type BookingRow = {
  id: string;
  reference: string;
  status: string;
  startAt: string;
  endAt: string;
  totalAmount: number;
  createdAt: string;
  customer: { name: string; email: string | null; phone: string };
  vehicles: string[];
  documentsCount: number;
  messagesCount: number;
};
type Message = { id: string; sender: string; body: string; createdAt: string };
type Conversation = {
  id: string;
  reference: string;
  status: string;
  startAt: string;
  endAt: string;
  totalAmount: number;
  customer: { name: string; email: string | null; phone: string };
  vehicles: { id: string; make: string; model: string; plateNumber: string }[];
  messages: Message[];
  documents: { id: string; kind: string; fileName: string; reviewStatus: string }[];
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
const formatTime = (value: string) =>
  new Date(value).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function MessagesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/bookings`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load conversations.");
      setRows(data.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load conversations.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const openConversation = useCallback(async (reference: string) => {
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(reference)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to open conversation.");
      setSelected(data.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open conversation.");
    }
  }, [slug]);

  useEffect(() => {
    void Promise.resolve().then(() => loadRows());
  }, [loadRows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => !term || [
      row.customer.name, row.customer.email || "", row.customer.phone, row.reference, ...row.vehicles,
    ].join(" ").toLowerCase().includes(term));
  }, [rows, query]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selected || !draft.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(selected.reference)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message could not be sent.");
      setDraft("");
      await Promise.all([openConversation(selected.reference), loadRows()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const activeName = "Booking management";
  return (
    <div className="roam-app-shell">
      <WorkspaceNav slug={slug} name={activeName} role="Workspace team" active="messages" />
      <main className="roam-main">
        <header className="roam-page-header">
          <div>
            <span className="roam-eyebrow">CUSTOMER RELATIONSHIPS</span>
            <h1>Messages</h1>
            <p>Keep every customer conversation connected to its booking.</p>
          </div>
          <button className="roam-button roam-button-secondary" onClick={() => { void loadRows(); if (selected) void openConversation(selected.reference); }} type="button">
            <RefreshCw size={16} /> Refresh
          </button>
        </header>

        {error && <p className="roam-error" role="alert">{error}</p>}
        <section className="roam-messaging-layout" aria-label="Customer messages">
          <aside className="roam-message-list">
            <div className="roam-message-list-heading">
              <div><strong>Conversations</strong><span>{rows.length} bookings</span></div>
              <MessageCircle size={19} />
            </div>
            <label className="roam-message-search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers or bookings" aria-label="Search conversations" />
            </label>
            {loading ? <p className="roam-muted">Loading conversations…</p> : filtered.length === 0 ? (
              <div className="roam-message-empty"><MessageCircle size={28} /><strong>No conversations found</strong><span>Try another search or open a booking to start a conversation.</span></div>
            ) : filtered.map((row) => (
              <button
                type="button"
                key={row.id}
                className={`roam-conversation-row ${selected?.reference === row.reference ? "selected" : ""}`}
                onClick={() => { void openConversation(row.reference); }}
              >
                <span className="roam-conversation-avatar"><UserRound size={18} /></span>
                <span className="roam-conversation-summary">
                  <span className="roam-conversation-name">{row.customer.name}</span>
                  <span className="roam-conversation-preview">{row.vehicles.join(", ") || "Rental booking"}</span>
                  <span className="roam-conversation-meta">#{row.reference} · {row.messagesCount} {row.messagesCount === 1 ? "message" : "messages"}</span>
                </span>
                <span className="roam-conversation-date">{formatDate(row.startAt)}</span>
              </button>
            ))}
          </aside>

          <section className="roam-message-thread" aria-label="Conversation thread">
            {!selected ? (
              <div className="roam-message-welcome">
                <MessageCircle size={42} />
                <h2>Your customer conversations</h2>
                <p>Select a booking on the left to view its message history and reply to the customer.</p>
              </div>
            ) : (
              <>
                <header className="roam-thread-header">
                  <div className="roam-thread-person">
                    <span className="roam-conversation-avatar"><UserRound size={20} /></span>
                    <div><h2>{selected.customer.name}</h2><span>{selected.customer.email || selected.customer.phone}</span></div>
                  </div>
                  <Link href={`/workspace/${slug}/bookings`} className="roam-thread-booking-link">Booking #{selected.reference} <ArrowUpRight size={15} /></Link>
                </header>
                <div className="roam-thread-context">
                  <span><CalendarDays size={15} /> {formatDate(selected.startAt)} – {formatDate(selected.endAt)}</span>
                  <span className={`roam-status-pill status-${selected.status.toLowerCase()}`}>{selected.status.replaceAll("_", " ")}</span>
                  <span>{selected.vehicles.map((vehicle) => `${vehicle.make} ${vehicle.model}`).join(", ") || "Vehicle details pending"}</span>
                </div>
                <div className="roam-thread-messages" aria-live="polite">
                  {selected.messages.length === 0 ? (
                    <div className="roam-thread-first-message"><MessageCircle size={24} /><strong>No messages yet</strong><span>Send the customer an update or answer their question.</span></div>
                  ) : selected.messages.map((message) => (
                    <article key={message.id} className={`roam-chat-message ${message.sender === "OWNER" || message.sender === "SYSTEM" ? "from-team" : "from-customer"}`}>
                      <span className="roam-chat-sender">{message.sender === "OWNER" ? "Your team" : message.sender === "SYSTEM" ? "ROAM system" : "Customer"}</span>
                      <p>{message.body}</p>
                      <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                    </article>
                  ))}
                </div>
                <form className="roam-message-composer" onSubmit={sendMessage}>
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message to your customer…" maxLength={2000} rows={3} aria-label="Message to customer" />
                  <div><span>{draft.length}/2,000 characters · Customer receives an email notification when available</span><button className="roam-button" type="submit" disabled={!draft.trim() || sending}><Send size={16} /> {sending ? "Sending…" : "Send message"}</button></div>
                </form>
              </>
            )}
          </section>
        </section>
      </main>
      <style jsx>{`
        .roam-messaging-layout{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:18px;min-height:620px}
        .roam-message-list,.roam-message-thread{background:var(--roam-card,#fff);border:1px solid var(--roam-border,#e5e7eb);border-radius:16px;overflow:hidden;min-width:0}
        .roam-message-list-heading{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 12px}
        .roam-message-list-heading div{display:grid;gap:3px}.roam-message-list-heading strong{font-size:16px}.roam-message-list-heading span,.roam-muted{font-size:12px;color:var(--roam-muted,#6b7280)}
        .roam-message-search{display:flex;align-items:center;gap:9px;margin:0 14px 12px;padding:10px 12px;border:1px solid var(--roam-border,#e5e7eb);border-radius:10px;color:var(--roam-muted,#6b7280)}
        .roam-message-search input{width:100%;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:13px}
        .roam-conversation-row{display:flex;gap:11px;align-items:flex-start;width:100%;padding:14px;border:0;border-top:1px solid var(--roam-border,#e5e7eb);background:transparent;text-align:left;color:inherit;cursor:pointer}
        .roam-conversation-row:hover,.roam-conversation-row.selected{background:var(--roam-soft,#f3f6fa)}
        .roam-conversation-avatar{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:50%;background:var(--roam-soft,#eef2f7);color:var(--roam-primary,#2357d8)}
        .roam-conversation-summary{display:grid;gap:4px;min-width:0;flex:1}.roam-conversation-name{font-weight:650;font-size:13px}.roam-conversation-preview,.roam-conversation-meta,.roam-conversation-date{font-size:11px;color:var(--roam-muted,#6b7280)}.roam-conversation-preview{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.roam-conversation-date{white-space:nowrap}
        .roam-message-empty,.roam-message-welcome,.roam-thread-first-message{display:grid;place-items:center;gap:9px;padding:48px 22px;text-align:center;color:var(--roam-muted,#6b7280)}.roam-message-empty strong,.roam-thread-first-message strong{color:var(--roam-text,#111827)}.roam-message-empty span,.roam-message-welcome p,.roam-thread-first-message span{font-size:13px;max-width:300px}
        .roam-thread-header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px;border-bottom:1px solid var(--roam-border,#e5e7eb)}.roam-thread-person{display:flex;align-items:center;gap:11px;min-width:0}.roam-thread-person h2{font-size:16px;margin:0 0 3px}.roam-thread-person span{font-size:12px;color:var(--roam-muted,#6b7280)}.roam-thread-booking-link{display:flex;align-items:center;gap:4px;font-size:12px;text-decoration:none;color:var(--roam-primary,#2357d8);white-space:nowrap}
        .roam-thread-context{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid var(--roam-border,#e5e7eb);font-size:12px;color:var(--roam-muted,#6b7280)}.roam-thread-context span:first-child{display:flex;align-items:center;gap:5px}.roam-status-pill{padding:4px 8px;border-radius:999px;background:var(--roam-soft,#f3f6fa);font-weight:650}
        .roam-thread-messages{display:flex;flex-direction:column;gap:14px;padding:20px;min-height:300px;max-height:480px;overflow:auto;background:var(--roam-page,#f8fafc)}
        .roam-chat-message{max-width:min(78%,560px);padding:12px 14px;border-radius:14px;background:var(--roam-card,#fff);border:1px solid var(--roam-border,#e5e7eb);align-self:flex-start}.roam-chat-message.from-team{align-self:flex-end;background:var(--roam-soft,#eef3ff)}.roam-chat-sender{font-size:11px;font-weight:700;color:var(--roam-muted,#6b7280)}.roam-chat-message p{font-size:13px;line-height:1.55;margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere}.roam-chat-message time{display:block;text-align:right;font-size:10px;color:var(--roam-muted,#6b7280)}
        .roam-message-composer{padding:14px 18px;border-top:1px solid var(--roam-border,#e5e7eb)}.roam-message-composer textarea{display:block;width:100%;resize:vertical;border:1px solid var(--roam-border,#d1d5db);border-radius:10px;padding:11px 12px;background:var(--roam-card,#fff);color:inherit;font:inherit;font-size:13px}.roam-message-composer>div{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px}.roam-message-composer>div span{font-size:11px;color:var(--roam-muted,#6b7280)}
        @media(max-width:900px){.roam-messaging-layout{grid-template-columns:1fr;min-height:0}.roam-message-list{max-height:350px;overflow:auto}.roam-thread-messages{max-height:420px}.roam-thread-header{align-items:flex-start;flex-direction:column}.roam-message-composer>div{align-items:flex-start;flex-direction:column}}
      `}</style>
    </div>
  );
}
