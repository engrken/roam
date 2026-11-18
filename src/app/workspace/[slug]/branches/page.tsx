"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, MapPin, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { WorkspaceNav } from "@/components/workspace-nav";
import "./branches.css";

type Branch = { id: string; name: string; code: string | null; address: string | null; isActive: boolean; createdAt: string };
const emptyForm = { name: "", code: "", address: "" };

export default function BranchesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/branches?includeInactive=1", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load branches.");
      setBranches(data.branches || []);
      setCanManage(Boolean(data.canManage));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load branches.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) void load(); });
    return () => { active = false; };
  }, [load]);

  function edit(branch: Branch) {
    setEditingId(branch.id);
    setForm({ name: branch.name, code: branch.code || "", address: branch.address || "" });
    setShowForm(true);
    setError("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/branches", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save branch.");
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save branch.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(branch: Branch) {
    setBusy(true);
    setError("");
    try {
      const url = "/api/workspaces/" + encodeURIComponent(slug) + "/branches";
      const response = await fetch(branch.isActive ? url + "?id=" + encodeURIComponent(branch.id) : url, {
        method: branch.isActive ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(branch.isActive ? {} : { body: JSON.stringify({ id: branch.id, isActive: true }) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update branch.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update branch.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="roam-loading">Loading branches…</main>;

  return (
    <div className="roam-app-shell">
      <WorkspaceNav slug={slug} name="Branch management" role="Workspace team" active="branches" />
      <main className="roam-main">
        <header className="roam-topbar">
          <div>
            <Link href={"/workspace/" + slug} className="roam-back-link"><ArrowLeft size={14} /> Overview</Link>
            <span className="roam-eyebrow">LOCATIONS</span>
            <h1>Branches</h1>
            <p>Manage pickup locations and keep vehicle assignments organized.</p>
          </div>
          <div className="roam-topbar-actions">
            <button className="roam-secondary-btn" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button>
            {canManage && <button className="roam-primary-btn" onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm((value) => !value); }}><Plus size={16} /> Add branch</button>}
          </div>
        </header>

        {error && <p className="roam-error" role="alert">{error}</p>}

        {showForm && canManage && (
          <form className="roam-panel roam-vehicle-form" onSubmit={save}>
            <div className="roam-panel-heading">
              <div><span className="roam-eyebrow">{editingId ? "UPDATE LOCATION" : "NEW LOCATION"}</span><h2>{editingId ? "Edit branch" : "Add a branch"}</h2></div>
              <button type="button" className="roam-quiet-btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
            <div className="roam-form-grid">
              <label>Branch name<input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Branch code<input maxLength={20} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="e.g. CEB-01" /></label>
              <label>Address<input maxLength={250} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Pickup address" /></label>
            </div>
            <button className="roam-primary-btn" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Create branch"}</button>
          </form>
        )}

        <section className="roam-panel">
          <div className="roam-panel-heading"><div><span className="roam-eyebrow">WORKSPACE LOCATIONS</span><h2>{branches.length} branches</h2></div></div>
          {branches.length ? (
            <div className="roam-branch-list">
              {branches.map((branch) => (
                <article className="roam-branch-row" key={branch.id}>
                  <div className="roam-branch-icon"><MapPin size={18} /></div>
                  <div className="roam-branch-content">
                    <b>{branch.name}</b>
                    <small>{branch.code || "No branch code"} · {branch.address || "No address added"}</small>
                    <span className={"roam-booking-badge " + (branch.isActive ? "confirmed" : "cancelled")}>{branch.isActive ? "ACTIVE" : "INACTIVE"}</span>
                  </div>
                  {canManage && <div className="roam-branch-actions">
                    <button className="roam-secondary-btn" onClick={() => edit(branch)}>Edit</button>
                    <button className="roam-quiet-btn" disabled={busy} onClick={() => void toggleActive(branch)}>{branch.isActive ? "Deactivate" : "Reactivate"}</button>
                  </div>}
                </article>
              ))}
            </div>
          ) : (
            <div className="roam-empty"><MapPin size={26} /><b>No branches yet</b><span>Add your first pickup location to organize the fleet.</span></div>
          )}
        </section>
      </main>
    </div>
  );
}
