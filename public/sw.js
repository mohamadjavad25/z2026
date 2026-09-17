/* زیبابان — minimal service worker for "Add to Home Screen" installability.
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
