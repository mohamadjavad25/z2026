/* frfro — minimal service worker for "Add to Home Screen" installability,
   plus real Web Push handling (see app/lib/push.js for the server side).
   Intentionally does NOT cache anything (no offline mode). */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // No-op: network only. A fetch handler is required for installability.
  return;
});

// Payload shape is whatever sendPushToUser() in app/lib/push.js sent —
// always { title, body, url }, url being where notificationclick below
// should focus/open. Never trust it beyond safe display: this only ever
// runs with data this server itself encrypted and signed (Web Push/VAPID),
// but a malformed/missing payload must still not throw and break the
// subscription for every future push.
self.addEventListener("push", (event) => {
  let data = { title: "frfro", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload (shouldn't happen — we always send JSON) — fall
    // back to the default title/empty body rather than dropping the push.
  }
  const title = data.title || "frfro";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      dir: "rtl",
      lang: "fa",
      data: { url: data.url || "/" }
    })
  );
});

// Focuses an already-open frfro tab instead of always opening a new one. When the notification is about a
// particular screen (url other than "/", e.g. "/?billing=plans" or "/admin?p=support"), that tab is sent there;
// a plain "/" keeps whatever the tab is showing. Only paths on this site are followed.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = String(event.notification.data?.url || "/");
  const path = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      const client = clientList.find((item) => "focus" in item);
      if (client) {
        const target = new URL(path, self.location.origin);
        const current = new URL(client.url);
        if (path !== "/" && current.pathname + current.search !== target.pathname + target.search && "navigate" in client) {
          const moved = await client.navigate(target.href).catch(() => null);
          return (moved || client).focus();
        }
        return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(path);
    })
  );
});
