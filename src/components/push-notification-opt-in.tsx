"use client";
import { useEffect, useState } from "react";
type Props = { slug?: string; reference?: string; token?: string };
function decodeKey(value: string) { const padding = "=".repeat((4 - value.length % 4) % 4); const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/"); const raw = atob(base64); return Uint8Array.from(raw, c => c.charCodeAt(0)); }
export function PushNotificationOptIn(props: Props) {
  const [supported,setSupported]=useState(false); const [permission,setPermission]=useState<NotificationPermission>("default"); const [enabled,setEnabled]=useState(false); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  useEffect(()=>{let active=true;const check=async()=>{const ok=typeof window!=="undefined"&&"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;if(!active)return;setSupported(ok);if(ok){setPermission(Notification.permission);try{const registration=await navigator.serviceWorker.getRegistration("/");if(active)setEnabled(!!(await registration?.pushManager.getSubscription()));}catch{/* Browser has not registered the service worker yet. */}}};void check();return()=>{active=false;};},[]);
  async function toggle() {
    setBusy(true);setMessage("");
    try {
      if(!supported)throw new Error("This browser does not support web push notifications.");
      const registration=await navigator.serviceWorker.register("/sw.js");
      let subscription=await registration.pushManager.getSubscription();
      if(subscription) {
        const response=await fetch("/api/push/subscribe",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({...props,endpoint:subscription.endpoint})});
        if(!response.ok)throw new Error("Could not update this device's notification settings. Please try again.");
        await subscription.unsubscribe();setEnabled(false);setMessage("Notifications are off on this device.");return;
      }
      const result=await Notification.requestPermission();setPermission(result);
      if(result!=="granted")throw new Error(result==="denied"?"Notifications are blocked. Allow them in your browser site settings, then try again.":"Notification permission was not granted. You can enable it whenever you are ready.");
      const keyResponse=await fetch("/api/push/key",{cache:"no-store"});const keyBody=await keyResponse.json();if(!keyResponse.ok)throw new Error(keyBody.error||"Notifications are not configured.");
      subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(keyBody.publicKey)});
      const response=await fetch("/api/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...props,subscription})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to enable notifications.");
      setEnabled(true);setMessage("Notifications are on. This device can receive booking and payment updates.");
    } catch(error) {setMessage(error instanceof Error?error.message:"Unable to update notification settings.");}
    finally {setBusy(false);}
  }
  const isOn = supported && enabled && permission === "granted";
  const unavailable = !supported || permission === "denied";
  return <section className="roam-notification-card" aria-label="Browser notification settings">
    <span className="roam-notification-label">Notification:</span>
    <button type="button" disabled={busy || unavailable} aria-pressed={isOn} aria-label={`Notifications ${isOn ? "on" : "off"}. ${busy ? "Updating." : message}`} title={message || (permission === "denied" ? "Allow notifications in your browser site settings." : "Toggle browser notifications")} onClick={()=>void toggle()} className={`roam-notification-button ${isOn ? "is-on" : "is-off"}`}>
      {busy ? "…" : isOn ? "ON" : "OFF"}
    </button>
    <span className="roam-notification-feedback" role="status" aria-live="polite">{message || (permission === "denied" ? "Blocked in browser settings" : !supported ? "Unavailable in this browser" : "")}</span>
  </section>;
}
