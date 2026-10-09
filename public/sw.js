/* Farfaroo — minimal service worker for "Add to Home Screen" installability,
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
  let data = { title: "Farfaroo", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON payload (shouldn't happen — we always send JSON) — fall
    // back to the default title/empty body rather than dropping the push.
  }
  const title = data.title || "Farfaroo";
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

// Focuses an already-open Farfaroo tab instead of always opening a new one —
// this is a single-page app (one route, "/"), so "the right screen" is
// whatever in-app state that tab is already holding, not a URL to navigate
// to; url in the payload is carried through for a future deep-link need but
// intentionally unused for navigation today.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(event.notification.data?.url || "/");
    })
  );
});
