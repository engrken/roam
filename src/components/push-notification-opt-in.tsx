"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = { slug?: string; reference?: string; token?: string };
type PushApiResponse = { error?: string; publicKey?: string };

function decodeKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

async function readResponse(response: Response) {
  return response.json().catch(() => ({})) as Promise<PushApiResponse>;
}

export function PushNotificationOptIn(props: Props) {
  const { slug, reference, token } = props;
  const pushContextKey = `${slug ?? ""}\\u0000${reference ?? ""}\\u0000${token ?? ""}`;
  const lastSyncedSubscriptionKey = useRef<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);
  const [synced, setSynced] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const syncSubscription = useCallback(async (subscription: PushSubscription) => {
    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ slug, reference, token, subscription: subscription.toJSON() }),
    });
    const result = await readResponse(response);
    if (!response.ok) {
      throw new Error(result.error || "ROAM could not save this device's notification subscription.");
    }
  }, [slug, reference, token]);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      setChecking(true);
      const available =
        typeof window !== "undefined" &&
        window.isSecureContext &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!active) return;
      setSupported(available);

      if (!available) {
        setPermission("default");
        lastSyncedSubscriptionKey.current = null;
        setEnabled(false);
        setSynced(false);
        setMessage("Browser push requires HTTPS and a compatible browser.");
        setChecking(false);
        return;
      }

      const currentPermission = Notification.permission;
      setPermission(currentPermission);
      if (currentPermission !== "granted") {
        lastSyncedSubscriptionKey.current = null;
        setEnabled(false);
        setSynced(false);
        setMessage(currentPermission === "denied"
          ? "Blocked in browser settings. Allow notifications for this site, then reload."
          : "");
        setChecking(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (!active) return;

        setEnabled(Boolean(subscription));
        if (!subscription) {
          lastSyncedSubscriptionKey.current = null;
          setSynced(false);
          setMessage("");
          return;
        }

        const subscriptionKey = `${pushContextKey}\\u0000${subscription.endpoint}`;
        if (lastSyncedSubscriptionKey.current === subscriptionKey) {
          setSynced(true);
          setMessage("");
          return;
        }

        try {
          await syncSubscription(subscription);
          if (active) {
            lastSyncedSubscriptionKey.current = subscriptionKey;
            setSynced(true);
            setMessage("");
          }
        } catch {
          if (active) {
            lastSyncedSubscriptionKey.current = null;
            setSynced(false);
            setMessage("This browser has a subscription, but ROAM could not sync it. Press RETRY to repair the connection.");
          }
        }
      } catch {
        if (active) {
          setEnabled(false);
          setSynced(false);
          setMessage("Could not check this device's notification subscription. Try again.");
        }
      } finally {
        if (active) setChecking(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [syncSubscription, pushContextKey]);

  async function toggle() {
    setBusy(true);
    setMessage("");
    let newlyCreatedSubscription: PushSubscription | null = null;

    try {
      if (!supported) {
        throw new Error("This browser does not support secure web push notifications.");
      }

      if (enabled && synced) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) {
          lastSyncedSubscriptionKey.current = null;
          setEnabled(false);
          setSynced(false);
          throw new Error("This device no longer has an active push subscription. Turn notifications on again.");
        }

        await subscription.unsubscribe();
        lastSyncedSubscriptionKey.current = null;
        setEnabled(false);
        setSynced(false);

        const response = await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ ...props, endpoint: subscription.endpoint }),
        });
        const result = await readResponse(response);
        setMessage(response.ok
          ? "Notifications are off on this device."
          : "Notifications are off in this browser, but ROAM could not clear the old server record. It will be cleaned up on the next delivery attempt.");
        if (!response.ok) console.warn("ROAM push subscription cleanup failed", result.error);
        return;
      }

      if (enabled && !synced) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) {
          setEnabled(false);
          setSynced(false);
          throw new Error("The browser subscription is no longer available. Turn notifications on again.");
        }
        await syncSubscription(subscription);
        lastSyncedSubscriptionKey.current = `${pushContextKey}\\u0000${subscription.endpoint}`;
        setSynced(true);
        setMessage("Notification connection repaired. This device is registered with ROAM.");
        return;
      }

      let currentPermission = Notification.permission;
      if (currentPermission === "default") {
        // Ask immediately from the user's click, before other asynchronous work.
        currentPermission = await Notification.requestPermission();
      }
      setPermission(currentPermission);
      if (currentPermission !== "granted") {
        throw new Error(currentPermission === "denied"
          ? "Notifications are blocked. Allow them in your browser's site settings, then reload ROAM."
          : "Notification permission was not granted. You can enable it whenever you are ready.");
      }

      const [keyResponse, registration] = await Promise.all([
        fetch("/api/push/key", { cache: "no-store" }),
        navigator.serviceWorker.register("/sw.js", { scope: "/" }),
      ]);
      const keyBody = await readResponse(keyResponse);
      if (!keyResponse.ok || !keyBody.publicKey) {
        throw new Error(keyBody.error || "ROAM's browser notification service is not configured correctly.");
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(keyBody.publicKey),
        });
        newlyCreatedSubscription = subscription;
      }

      await syncSubscription(subscription);
      lastSyncedSubscriptionKey.current = `${pushContextKey}\\u0000${subscription.endpoint}`;
      setEnabled(true);
      setSynced(true);
      setMessage("Notifications are on. This device is registered to receive ROAM booking and payment updates.");
    } catch (error) {
      if (newlyCreatedSubscription) {
        await newlyCreatedSubscription.unsubscribe().catch(() => false);
      }
      if (newlyCreatedSubscription) {
        setEnabled(false);
        setSynced(false);
      }
      setMessage(error instanceof Error ? error.message : "Unable to update notification settings.");
    } finally {
      setBusy(false);
      setChecking(false);
    }
  }

  const isOn = supported && enabled && synced && permission === "granted";
  const needsRepair = supported && enabled && !synced && permission === "granted";
  const unavailable = !supported || permission === "denied";

  return (
    <section className="roam-notification-card" aria-label="Browser notification settings">
      <span className="roam-notification-label">Notification:</span>
      <button
        type="button"
        disabled={busy || checking || unavailable}
        aria-pressed={isOn}
        aria-label={needsRepair ? "Repair browser notification connection" : `Notifications ${isOn ? "on" : "off"}`}
        title={message || (permission === "denied" ? "Allow notifications in your browser site settings." : "Toggle browser notifications")}
        onClick={() => void toggle()}
        className={`roam-notification-button ${isOn ? "is-on" : needsRepair ? "is-error" : "is-off"}`}
      >
        {busy || checking ? "…" : needsRepair ? "RETRY" : isOn ? "ON" : "OFF"}
      </button>
      <span className="roam-notification-feedback" role="status" aria-live="polite">
        {message || (checking ? "Checking this device…" : "")}
      </span>
    </section>
  );
}
