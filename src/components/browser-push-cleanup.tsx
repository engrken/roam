"use client";

import { useEffect } from "react";

/**
 * Remove the legacy ROAM browser-push worker and its subscription from devices
 * that still have it installed. This cleanup does not touch unrelated workers.
 */
export function BrowserPushCleanup() {
  useEffect(() => {
    let active = true;

    async function unregisterLegacyPush() {
      if (!("serviceWorker" in navigator)) return;

      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          if (!active) return;

          const workers = [registration.active, registration.waiting, registration.installing];
          const isLegacyRoamWorker = workers.some(worker => {
            if (!worker) return false;
            try {
              return new URL(worker.scriptURL).pathname === "/sw.js";
            } catch {
              return false;
            }
          });

          if (!isLegacyRoamWorker) continue;

          try {
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) await subscription.unsubscribe();
          } catch (error) {
            console.warn("ROAM could not clear a legacy browser-push subscription.", error);
          }

          await registration.unregister();
        }
      } catch (error) {
        console.warn("ROAM could not unregister its legacy browser-push worker.", error);
      }
    }

    void unregisterLegacyPush();
    return () => {
      active = false;
    };
  }, []);

  return null;
}
