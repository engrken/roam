"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ClipboardList, RefreshCw } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type AuditEvent = {
  id: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export default function WorkspaceAuditPage() {
  const { slug } = useParams<{ slug: string }>();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/audit-logs?limit=100", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load audit history.");
      setEvents(Array.isArray(body.logs) ? body.logs : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load audit history.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Audit history" role="Workspace" active="audit"/>
    <main className="roam-main">
      <header className="roam-topbar">
        <div><span className="roam-eyebrow">SECURITY & ACCOUNTABILITY</span><h1>Workspace audit history</h1><p>Review sensitive workspace actions performed by owners, admins, managers and invited members.</p></div>
        <div className="roam-topbar-actions"><button className="roam-secondary-btn" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Refresh</button></div>
      </header>
      {error && <p className="roam-error" role="alert">{error}</p>}
      <section className="roam-panel roam-table-panel">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">LATEST EVENTS</span><h2>Recent activity</h2></div><ClipboardList size={22}/></div>
        {loading ? <p className="roam-muted">Loading audit history…</p> : events.length ? <div className="roam-table-scroll">
          <table className="roam-table">
            <thead><tr><th>Date & time</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>{events.map(event => {
              const details = event.details || {};
              const targetType = typeof details.targetType === "string" ? details.targetType : "—";
              const targetId = typeof details.targetId === "string" ? details.targetId : "—";
              const summary = Object.entries(details).filter(([key]) => key !== "targetType" && key !== "targetId").map(([key, value]) => key + ": " + (typeof value === "string" ? value : JSON.stringify(value))).join(" · ");
              return <tr key={event.id}>
                <td>{new Date(event.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td>{event.actorEmail}</td>
                <td><strong>{event.action.replace(/^workspace\./, "").replaceAll(".", " ")}</strong></td>
                <td>{targetType}<br/><small>{targetId}</small></td>
                <td>{summary || "—"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div> : <div className="roam-empty"><ClipboardList size={28}/><b>No audit events yet</b><span>Newly recorded sensitive workspace actions will appear here.</span></div>}
      </section>
      <p className="roam-settings-footnote">Audit history records actions that ROAM has instrumented. It is not a complete record of every read or page view. The latest 100 events are shown.</p>
    </main>
  </div>;
}
