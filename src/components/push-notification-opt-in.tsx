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
        await fetch("/api/push/subscribe",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({...props,endpoint:subscription.endpoint})});
        await subscription.unsubscribe();setEnabled(false);setMessage("Browser notifications turned off.");return;
      }
      const result=await Notification.requestPermission();setPermission(result);
      if(result!=="granted")throw new Error("Allow notifications in your browser settings to receive updates.");
      const keyResponse=await fetch("/api/push/key",{cache:"no-store"});const keyBody=await keyResponse.json();if(!keyResponse.ok)throw new Error(keyBody.error||"Notifications are not configured.");
      subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeKey(keyBody.publicKey)});
      const response=await fetch("/api/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...props,subscription})});
      const body=await response.json();if(!response.ok)throw new Error(body.error||"Unable to enable notifications.");
      setMessage("Browser notifications enabled on this device.");
    } catch(error) {setMessage(error instanceof Error?error.message:"Unable to update notification settings.");}
    finally {setBusy(false);}
  }
  if(!supported)return <p className="text-xs text-slate-500">Browser push notifications are not supported in this browser.</p>;
  return <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-3"><div className="min-w-0 flex-1"><strong className="block text-sm">Browser notifications</strong><span className="text-xs text-slate-500">{message|| (permission==="granted"?"This device can receive booking updates.":"Get booking and payment updates on this device.")}</span></div><button type="button" className="roam-button roam-button-secondary" disabled={busy} onClick={()=>void toggle()}>{busy?"Please wait…":enabled?"Turn off notifications":"Enable notifications"}</button></div>;
}
