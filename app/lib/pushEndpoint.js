/**
 * Which web-push addresses the server will post to (HEALTH debt 13, 2026-11-08).
 *
 * A browser's PushSubscription names the push service of its maker; the server later sends an HTTPS POST there. Without
 * a check, any signed-in account could save an address of its own choosing and make the server call it (an internal
 * address, a metadata service, someone else's site) every time a notice goes out. Only the real push services are kept.
 */

// Host suffixes of the browser makers' push services (Chrome, Edge, Samsung, Opera and other Chromium browsers use FCM).
const PUSH_SERVICE_SUFFIXES = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com"
];

function parse(endpoint) {
  try {
    return new URL(String(endpoint || ""));
  } catch {
    return null;
  }
}

function hostMatches(host, suffix) {
  return host === suffix || host.endsWith(`.${suffix}`);
}

/** True when `endpoint` is an https address on a known browser push service (no port, no user part). */
export function isKnownPushEndpoint(endpoint) {
  const url = parse(endpoint);
  if (!url || url.protocol !== "https:" || url.port || url.username || url.password) return false;
  if (String(endpoint).length > 1000) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_SUFFIXES.some((suffix) => hostMatches(host, suffix));
}

/**
 * The narrower check at send time, for subscriptions saved before the list above existed: never post to a plain-http
 * address, a raw IP, or a local name. Such a row is skipped, not deleted.
 */
export function isSafeToPost(endpoint) {
  const url = parse(endpoint);
  if (!url || url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^[\d.]+$/.test(host) || host.startsWith("[")) return false;
  return true;
}
