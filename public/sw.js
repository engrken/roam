self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "ROAM update", body: event.data?.text() || "You have a new update." }; }
  event.waitUntil(self.registration.showNotification(data.title || "ROAM update", {
    body: data.body || "You have a new booking update.",
    icon: data.icon || "/favicon.svg",
    badge: data.badge || "/favicon.svg",
    data: { url: data.url || "/" },
    tag: data.tag || "roam-update",
    renotify: true,
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windows => {
    const existing = windows.find(client => client.url.startsWith(self.location.origin));
    if (existing) { if (new URL(target).pathname !== "/" && new URL(existing.url).pathname !== new URL(target).pathname) await existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  }));
});
