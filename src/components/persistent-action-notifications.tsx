"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Bell, ArrowUpRight, History, Clock3, CheckCircle2, AlertCircle } from "lucide-react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedByLabel: string | null;
};

type Props = { endpoint: string; token?: string };

export function PersistentActionNotifications({ endpoint, token }: Props) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const requestHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = "Bearer " + token;
    return headers;
  }, [token]);

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store", headers: requestHeaders });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Unable to load notifications.");
    setItems(Array.isArray(body.notifications) ? body.notifications : []);
  }, [endpoint, requestHeaders]);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const sync = async () => {
      if (!active || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        await load();
        if (active) setError("");
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to refresh notifications.");
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    void sync();
    const timer = window.setInterval(() => { void sync(); }, 12000);
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const pending = useMemo(
    () => items.filter(item => !item.acknowledgedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [items],
  );
  const history = useMemo(() => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [items]);
  const current = pending[0];
  const actionHref = current
    ? token
      ? (() => {
          const hashIndex = current.actionUrl.indexOf("#");
          const path = hashIndex >= 0 ? current.actionUrl.slice(0, hashIndex) : current.actionUrl;
          const hash = hashIndex >= 0 ? current.actionUrl.slice(hashIndex) : "";
          return path + (path.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token) + hash;
        })()
      : current.actionUrl
    : "#";

  async function openNotification(item: NotificationItem) {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      const target = new URL(item.actionUrl, window.location.origin);
      if (target.origin !== window.location.origin) {
        throw new Error("This notification has an invalid destination. It has not been cleared.");
      }
      if (token && target.pathname.startsWith("/booking/")) target.searchParams.set("token", token);

      const response = await fetch(endpoint + "/" + encodeURIComponent(item.id) + "/acknowledge", {
        method: "POST",
        cache: "no-store",
        headers: { ...requestHeaders, "Content-Type": "application/json" },
        body: token ? JSON.stringify({ token }) : "{}",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.acknowledged !== true) {
        throw new Error(body.error || "We could not acknowledge this notification. Please try again.");
      }
      setItems(previous => previous.map(row => row.id === item.id
        ? { ...row, acknowledgedAt: new Date().toISOString(), acknowledgedByLabel: row.acknowledgedByLabel || (token ? "You" : "Workspace team") }
        : row));
      window.location.assign(target.toString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open this notification.");
      setWorking(false);
    }
  }

  const controlStyle: CSSProperties = {
    position: "fixed", right: 18, bottom: 18, zIndex: 9000, display: "flex", alignItems: "center",
    gap: 8, border: "1px solid #d7e0e8", borderRadius: 999, padding: "11px 15px",
    background: "#fff", color: "#172b3a", boxShadow: "0 8px 28px rgba(15,23,42,.16)",
    fontWeight: 700, cursor: "pointer",
  };
  const overlayStyle: CSSProperties = {
    position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center",
    padding: 16, background: "rgba(9, 20, 31, .72)",
  };
  const dialogStyle: CSSProperties = {
    width: "min(560px, calc(100vw - 32px))", maxHeight: "min(85vh, 760px)", overflowY: "auto",
    borderRadius: 22, background: "#fff", color: "#172b3a", boxShadow: "0 24px 90px rgba(0,0,0,.32)",
    padding: "clamp(22px, 5vw, 34px)",
  };
  const actionStyle: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
    minHeight: 48, border: 0, borderRadius: 12, padding: "12px 18px", background: "#0f6678",
    color: "#fff", fontWeight: 800, cursor: working ? "wait" : "pointer", opacity: working ? .7 : 1,
  };

  return (
    <>
      <button type="button" style={controlStyle} onClick={() => setHistoryOpen(value => !value)}
        aria-expanded={historyOpen} aria-label={pending.length + " pending notifications. Open notification history."}>
        <Bell size={18}/> Notifications
        <span style={{ minWidth: 22, height: 22, padding: "0 6px", display: "inline-grid", placeItems: "center", borderRadius: 999, background: pending.length ? "#b42318" : "#edf2f6", color: pending.length ? "#fff" : "#425466", fontSize: 12 }}>
          {pending.length}
        </span>
      </button>

      {historyOpen && (
        <section aria-label="Notification history" style={{
          position: "fixed", right: 18, bottom: 76, zIndex: 9001, width: "min(430px, calc(100vw - 32px))",
          maxHeight: "min(65vh, 560px)", overflowY: "auto", padding: 18, border: "1px solid #d7e0e8",
          borderRadius: 18, background: "#fff", color: "#172b3a", boxShadow: "0 12px 38px rgba(15,23,42,.2)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800 }}><History size={17}/> Notification history</div>
            <button type="button" onClick={() => setHistoryOpen(false)} style={{ border: 0, background: "transparent", color: "#0f6678", fontWeight: 700, cursor: "pointer" }}>Close history</button>
          </div>
          {loading && <p style={{ color: "#657786", fontSize: 13 }}>Loading notifications…</p>}
          {!loading && history.length === 0 && <p style={{ color: "#657786", fontSize: 13 }}>No notifications yet.</p>}
          <div style={{ display: "grid", gap: 10 }}>
            {history.map(item => (
              <article key={item.id} style={{ padding: 12, borderRadius: 12, background: item.acknowledgedAt ? "#f6f8fa" : "#fff8e8", border: "1px solid #e3e9ef" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 750, fontSize: 13 }}>
                  {item.acknowledgedAt ? <CheckCircle2 size={15} color="#16804a"/> : <Clock3 size={15} color="#b45309"/>}
                  {item.title}
                </div>
                <p style={{ margin: "7px 0", fontSize: 13, lineHeight: 1.5, color: "#425466" }}>{item.message}</p>
                <small style={{ color: "#718096", fontSize: 11 }}>
                  {new Date(item.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
                  {item.acknowledgedAt ? " · Opened" + (item.acknowledgedByLabel ? " by " + item.acknowledgedByLabel : "") : " · Action required"}
                </small>
              </article>
            ))}
          </div>
          {error && <p role="alert" style={{ marginTop: 10, color: "#b42318", fontSize: 12 }}>{error}</p>}
        </section>
      )}

      {current && (
        <div style={overlayStyle} role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="roam-action-notification-title" aria-describedby="roam-action-notification-message" style={dialogStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#0f6678", fontWeight: 800, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase" }}>
              <Bell size={16}/> ROAM · Action required
            </div>
            <h2 id="roam-action-notification-title" style={{ margin: "17px 0 10px", fontSize: "clamp(22px, 4vw, 30px)", lineHeight: 1.2, letterSpacing: "-.03em" }}>{current.title}</h2>
            <p id="roam-action-notification-message" style={{ margin: 0, color: "#425466", fontSize: 15, lineHeight: 1.65 }}>{current.message}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, color: "#718096", fontSize: 12 }}>
              <Clock3 size={14}/> Received {new Date(current.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
            </div>
            <p style={{ margin: "18px 0 20px", padding: 12, borderRadius: 10, background: "#f4f8fa", color: "#425466", fontSize: 12, lineHeight: 1.5 }}>
              This prompt stays on screen until you open the linked item. It will remain here after refreshing or signing back in.
            </p>
            {error && <p role="alert" style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 0 14px", color: "#b42318", fontSize: 13 }}><AlertCircle size={15}/>{error}</p>}
            <a href={actionHref} style={{ ...actionStyle, textDecoration: "none" }}
              aria-disabled={working} onClick={event => { event.preventDefault(); if (!working) void openNotification(current); }}>
              {working ? "Opening…" : "Open linked item"} <ArrowUpRight size={17}/>
            </a>
            {pending.length > 1 && <p style={{ margin: "14px 0 0", color: "#718096", fontSize: 12 }}>{pending.length - 1} more action-required notification{pending.length - 1 === 1 ? "" : "s"} will follow.</p>}
          </section>
        </div>
      )}
    </>
  );
}
