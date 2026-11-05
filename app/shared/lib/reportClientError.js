/**
 * Fire-and-forget crash report to /api/client-errors. Never throws. One page sends each message once and at most
 * MAX_REPORTS in all, so a bad release on many phones cannot turn into a flood of its own against the server.
 */
const MAX_REPORTS = 10;
const seen = new Set();

export function reportClientError(error, source = "window") {
  try {
    const message = String(error?.message || error || "unknown").slice(0, 500);
    if (seen.has(message) || seen.size >= MAX_REPORTS) return;
    // Scripts an in-app browser (Instagram, Telegram…) injects into the page are not ours to fix.
    if (/iabjs:\/\/|Java object is gone/.test(`${message} ${error?.stack || ""}`)) return;
    seen.add(message);
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
