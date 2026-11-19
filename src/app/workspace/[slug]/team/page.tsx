"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCw, UserPlus, Users, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";

type Member = { id: string; userId: string; email: string; name: string | null; role: string; joinedAt: string };
type TeamData = { members: Member[]; limits: { plan: string; maxMembers: number | null; currentMembers: number }; actorRole: string };

const roleLabels: Record<string, string> = { OWNER: "Owner", ADMIN: "Administrator", MANAGER: "Manager", STAFF: "Staff" };

export default function TeamPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<TeamData | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/team", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load the team.");
      setData(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the team.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  async function addMember(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to add team member.");
      setEmail(""); setRole("STAFF"); setNotice("Team member added. They can now sign in and access this workspace.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add team member.");
    } finally { setBusy(false); }
  }

  async function changeRole(member: Member, nextRole: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/team", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: member.id, role: nextRole }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to update role.");
      setNotice("Team role updated."); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update role.");
    } finally { setBusy(false); }
  }

  async function removeMember(member: Member) {
    if (!window.confirm("Remove " + member.email + " from this workspace? Their ROAM account will remain active.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/team?membershipId=" + encodeURIComponent(member.id), { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to remove member.");
      setNotice("Workspace access removed."); await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove member.");
    } finally { setBusy(false); }
  }

  if (loading) return <main className="roam-loading">Loading team…</main>;
  if (!data) return <main className="roam-loading"><h1>Team management unavailable</h1><p>{error}</p><Link href={"/workspace/" + slug}>Back to workspace</Link></main>;

  const roles = data.actorRole === "OWNER" ? ["ADMIN", "MANAGER", "STAFF"] : ["MANAGER", "STAFF"];
  const canManageTarget = (member: Member) => member.role !== "OWNER" && !(data.actorRole === "ADMIN" && member.role === "ADMIN");

  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Team management" role={data.actorRole} active="team"/>
    <main className="roam-main">
      <header className="roam-topbar">
        <div><Link href={"/workspace/" + slug} className="roam-back-link"><ArrowLeft size={14}/> Overview</Link><span className="roam-eyebrow">PEOPLE & ACCESS</span><h1>Your team</h1><p>Control who can access this rental workspace and what they can manage.</p></div>
        <div className="roam-topbar-actions"><button className="roam-secondary-btn" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div>
      </header>
      {error && <p className="roam-error" role="alert">{error}</p>}
      {notice && <p className="client-notice" role="status">{notice}</p>}
      <section className="roam-booking-stats">
        <article><span>Workspace members</span><b>{data.limits.currentMembers}</b></article>
        <article><span>Plan</span><b>{data.limits.plan}</b></article>
        <article><span>Member allowance</span><b>{data.limits.maxMembers == null ? "Unlimited" : data.limits.maxMembers}</b></article>
        <article><span>Available seats</span><b>{data.limits.maxMembers == null ? "Unlimited" : Math.max(0, data.limits.maxMembers - data.limits.currentMembers)}</b></article>
      </section>
      <section className="roam-panel roam-vehicle-form">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">ADD ACCESS</span><h2>Add an existing ROAM user</h2></div><UserPlus size={22}/></div>
        <p className="roam-muted">The person must register for ROAM using this email address first. Adding them here grants access only to this workspace; it does not create or change their account.</p>
        <form onSubmit={addMember} className="roam-form-grid">
          <label>Email address<input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="teammate@example.com"/></label>
          <label>Workspace role<select value={role} onChange={event => setRole(event.target.value)}>{roles.map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>
          <div className="roam-settings-actions"><button className="roam-primary-btn" disabled={busy || (data.limits.maxMembers != null && data.limits.currentMembers >= data.limits.maxMembers)}><UserPlus size={16}/>{busy ? "Saving…" : "Add team member"}</button></div>
        </form>
      </section>
      <section className="roam-panel roam-table-panel">
        <div className="roam-panel-heading"><div><span className="roam-eyebrow">WORKSPACE ACCESS</span><h2>Members</h2></div><span className="roam-panel-total">{data.members.length} people</span></div>
        {data.members.length ? <div className="roam-table-scroll"><table className="roam-table"><thead><tr><th>Person</th><th>Role</th><th>Added</th><th>Actions</th></tr></thead><tbody>
          {data.members.map(member => <tr key={member.id}><td><div className="roam-vehicle-cell"><span className="roam-vehicle-avatar"><Users size={17}/></span><span><b>{member.name || member.email}</b><small>{member.email}</small></span></div></td>
            <td>{member.role === "OWNER" ? <span className="roam-booking-badge confirmed"><ShieldCheck size={13}/> Owner</span> : canManageTarget(member) ? <select value={member.role} disabled={busy} onChange={event => void changeRole(member, event.target.value)} aria-label={"Role for " + member.email}>{roles.filter(item => item !== "OWNER").map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}</select> : roleLabels[member.role]}</td>
            <td>{new Date(member.joinedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</td>
            <td>{canManageTarget(member) ? <button className="roam-danger-btn" disabled={busy} onClick={() => void removeMember(member)}><Trash2 size={14}/> Remove</button> : <span className="roam-muted">Protected</span>}</td>
          </tr>)}
        </tbody></table></div> : <div className="roam-empty"><Users size={28}/><b>No team members yet</b><span>Add a registered ROAM user to share workspace access.</span></div>}
      </section>
      <footer className="roam-footer">ROAM Team Management <span>Removing a member does not delete their ROAM account or other workspace access.</span></footer>
    </main>
  </div>;
}
