"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BarChart3, Download, RefreshCw } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Branch = { id: string; name: string; code: string | null };

type Report = {
  range: { from: string; to: string };
  summary: { bookings: number; completed: number; cancelled: number; pending: number; confirmed: number; active: number; rejected: number; completedRevenue: number; openBookingValue: number; fleetCount: number };
  statusCounts: Record<string, number>;
  daily: { date: string; bookings: number; completed: number; revenue: number }[];
  bookings: { reference: string; customer: string; status: string; startAt: string; endAt: string; totalAmount: number; branch: string }[];
};

const money = (value: number, currency: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(value);

export default function ReportsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ from, to });
      if (branchId) query.set("branchId", branchId);
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/reports?" + query.toString(), { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load reports.");
      setReport(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load reports.");
    } finally { setLoading(false); }
  }, [branchId, from, slug, to]);

  useEffect(() => {
    let active = true;
    fetch("/api/workspaces/" + encodeURIComponent(slug) + "/branches", { cache: "no-store" })
      .then(response => response.json()).then(body => { if (active) setBranches(Array.isArray(body.branches) ? body.branches : []); })
      .catch(() => undefined);
    fetch("/api/workspaces/" + encodeURIComponent(slug) + "/overview", { cache: "no-store" })
      .then(response => response.json()).then(body => { if (active && body.workspace?.currency) setCurrency(body.workspace.currency); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [slug]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load fetches the selected report range on entry and when filters change.
  useEffect(() => { void load(); }, [load]);

  function exportCsv() {
    if (!report) return;
    const safe = (value: string) => /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
    const rows = [["Reference", "Customer", "Branch", "Status", "Start", "End", "Amount"], ...report.bookings.map(item => [item.reference, item.customer, item.branch, item.status, item.startAt, item.endAt, String(item.totalAmount)])];
    const csv = rows.map(row => row.map(value => '"' + safe(value).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "roam-booking-report-" + from + "-to-" + to + ".csv"; anchor.click();
    URL.revokeObjectURL(url);
  }

  const s = report?.summary;
  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Operational reports" role="Workspace" active="reports"/>
    <main className="roam-main">
      <header className="roam-topbar"><div><span className="roam-eyebrow">BUSINESS INSIGHTS</span><h1>Operational reports</h1><p>Review booking activity and completed booking value for a selected period.</p></div><div className="roam-topbar-actions"><button className="roam-secondary-btn" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div></header>
      <section className="roam-panel">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">REPORT FILTERS</span><h2>Date range and location</h2></div><BarChart3 size={22}/></div>
        <div className="roam-form-grid"><label>Branch<select value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}{branch.code ? " (" + branch.code + ")" : ""}</option>)}</select></label><label>From<input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)}/></label><label>To<input type="date" value={to} min={from} onChange={event => setTo(event.target.value)}/></label><div className="roam-settings-actions"><button className="roam-primary-btn" onClick={() => void load()} disabled={loading}>Apply dates</button></div></div>
      </section>
      {error && <p className="roam-error" role="alert">{error}</p>}
      {loading ? <p className="roam-muted">Loading report…</p> : s && <>
        <section className="roam-booking-stats">
          <article><span>Bookings</span><b>{s.bookings}</b></article><article><span>Completed</span><b>{s.completed}</b></article><article><span>Cancelled</span><b>{s.cancelled}</b></article><article><span>Fleet size</span><b>{s.fleetCount}</b></article>
          <article><span>Completed booking value</span><b>{money(s.completedRevenue, currency)}</b></article><article><span>Open booking value</span><b>{money(s.openBookingValue, currency)}</b></article><article><span>Pending</span><b>{s.pending}</b></article><article><span>Active / confirmed</span><b>{s.active + s.confirmed}</b></article>
        </section>
        <section className="roam-panel roam-table-panel">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">BOOKING ACTIVITY</span><h2>Daily summary</h2></div></div>
          <div className="roam-table-scroll"><table className="roam-table"><thead><tr><th>Date</th><th>Bookings</th><th>Completed</th><th>Completed value</th></tr></thead><tbody>{report.daily.map(day => <tr key={day.date}><td>{new Date(day.date + "T00:00:00").toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"})}</td><td>{day.bookings}</td><td>{day.completed}</td><td>{money(day.revenue,currency)}</td></tr>)}</tbody></table></div>
        </section>
        <section className="roam-panel roam-table-panel">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">DETAIL</span><h2>Bookings in period</h2></div><button className="roam-secondary-btn" onClick={exportCsv}><Download size={15}/> Export CSV</button></div>
          {report.bookings.length ? <div className="roam-table-scroll"><table className="roam-table"><thead><tr><th>Reference</th><th>Customer</th><th>Branch</th><th>Status</th><th>Start</th><th>End</th><th>Amount</th></tr></thead><tbody>{report.bookings.map(item => <tr key={item.reference}><td>{item.reference}</td><td>{item.customer}</td><td>{item.branch}</td><td>{item.status}</td><td>{new Date(item.startAt).toLocaleDateString()}</td><td>{new Date(item.endAt).toLocaleDateString()}</td><td>{money(item.totalAmount,currency)}</td></tr>)}</tbody></table></div> : <div className="roam-empty"><BarChart3 size={28}/><b>No bookings in this period</b><span>Try a different date range.</span></div>}
        </section>
      </>}
      <p className="roam-settings-footnote">Completed booking value is based on completed bookings whose start date falls within the selected period. This is an operational report, not an accounting statement or proof of payment collection.</p>
    </main>
  </div>;
}
