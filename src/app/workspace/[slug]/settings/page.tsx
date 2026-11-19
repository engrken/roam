"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { Building2, Save } from "lucide-react";
import { WorkspaceNav } from "@/components/workspace-nav";

type Settings = { name: string; email: string; phone: string; timezone: string; currency: string };

export default function BusinessSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [settings, setSettings] = useState<Settings>({ name: "", email: "", phone: "", timezone: "Asia/Manila", currency: "PHP" });
  const [role, setRole] = useState("STAFF");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/workspaces/" + encodeURIComponent(slug) + "/settings", { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load business settings.");
        if (active) {
          setSettings({ name: body.tenant.name || "", email: body.tenant.email || "", phone: body.tenant.phone || "", timezone: body.tenant.timezone || "Asia/Manila", currency: body.tenant.currency || "PHP" });
          setRole(body.role);
        }
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Unable to load business settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  function update(field: keyof Settings, value: string) {
    setSettings(current => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/workspaces/" + encodeURIComponent(slug) + "/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save business settings.");
      setSettings({ name: body.tenant.name, email: body.tenant.email, phone: body.tenant.phone || "", timezone: body.tenant.timezone, currency: body.tenant.currency });
      setNotice("Business settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save business settings.");
    } finally { setSaving(false); }
  }

  const editable = role === "OWNER" || role === "ADMIN";
  return <div className="roam-app-shell">
    <WorkspaceNav slug={slug} name="Business settings" role={role} active="settings"/>
    <main className="roam-main">
      <header className="roam-topbar"><div><span className="roam-eyebrow">WORKSPACE CONFIGURATION</span><h1>Business settings</h1><p>Manage the business details and regional defaults used by this workspace.</p></div></header>
      <section className="roam-panel roam-settings-panel">
        <div className="roam-settings-heading"><span className="roam-help-card-icon"><Building2 size={20}/></span><div><h2>Business profile</h2><p>These details identify your rental business to customers and set the workspace currency and time zone.</p></div></div>
        {error && <div className="client-alert" role="alert">{error}</div>}
        {notice && <div className="client-success-inline" role="status">{notice}</div>}
        {loading ? <p>Loading business settings…</p> : <form onSubmit={save} className="roam-settings-form">
          <label htmlFor="business-name">Business name</label>
          <input id="business-name" required maxLength={120} value={settings.name} disabled={!editable} onChange={event => update("name", event.target.value)}/>
          <label htmlFor="business-email">Business email</label>
          <input id="business-email" type="email" required maxLength={254} value={settings.email} disabled={!editable} onChange={event => update("email", event.target.value)}/>
          <label htmlFor="business-phone">Business phone</label>
          <input id="business-phone" maxLength={40} value={settings.phone} disabled={!editable} onChange={event => update("phone", event.target.value)} placeholder="Contact number"/>
          <label htmlFor="business-timezone">Time zone</label>
          <select id="business-timezone" value={settings.timezone} disabled={!editable} onChange={event => update("timezone", event.target.value)}>
            <option value="Asia/Manila">Asia/Manila (Philippines)</option><option value="Asia/Singapore">Asia/Singapore</option><option value="Asia/Tokyo">Asia/Tokyo</option><option value="Australia/Sydney">Australia/Sydney</option><option value="Europe/London">Europe/London</option><option value="America/Los_Angeles">America/Los_Angeles</option><option value="America/New_York">America/New_York</option><option value="UTC">UTC</option>
          </select>
          <label htmlFor="business-currency">Currency</label>
          <select id="business-currency" value={settings.currency} disabled={!editable} onChange={event => update("currency", event.target.value)}>
            <option value="PHP">PHP — Philippine Peso</option><option value="USD">USD — US Dollar</option><option value="SGD">SGD — Singapore Dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound Sterling</option><option value="JPY">JPY — Japanese Yen</option><option value="AUD">AUD — Australian Dollar</option>
          </select>
          {editable ? <div className="roam-settings-actions"><button type="submit" className="roam-primary-button" disabled={saving}><Save size={16}/>{saving ? "Saving…" : "Save business settings"}</button></div> : <p className="roam-settings-footnote">Only workspace owners and administrators can change business settings.</p>}
        </form>}
      </section>
    </main>
  </div>;
}
