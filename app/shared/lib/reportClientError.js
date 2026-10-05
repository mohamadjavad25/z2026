/** Fire-and-forget crash report to /api/client-errors. Never throws, never reports twice in a row for the same message. */
let lastMessage = "";

export function reportClientError(error, source = "window") {
  try {
    const message = String(error?.message || error || "unknown").slice(0, 500);
    if (message === lastMessage) return;
    lastMessage = message;
    const payload = JSON.stringify({
      message,
      stack: String(error?.stack || "").slice(0, 4000) || undefined,
      source,
      url: typeof location !== "undefined" ? location.pathname : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : undefined
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/client-errors", new Blob([payload], { type: "application/json" }));
    } else {
      void fetch("/api/client-errors", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    // reporting must never break the page
  }
}
