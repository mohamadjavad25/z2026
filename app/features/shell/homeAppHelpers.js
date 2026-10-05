import { toIsoLikeTimestamp } from "../../shared/lib/time";

export function isWithinLastHours(timestamp, hours) {
  const isoLike = toIsoLikeTimestamp(timestamp);
  if (!isoLike) return false;
  const ms = Date.parse(isoLike);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= hours * 3600 * 1000;
}

// PushManager needs the VAPID public key as a raw Uint8Array, not the
// base64url string it's distributed as — standard conversion, same one
// every Web Push how-to uses (there's no browser-native helper for it).
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

/**
 * Best-effort push opt-in, called once per authenticated session (see
 * onAuthenticated below). Silently does nothing when: push isn't supported
 * (SSR, unsupported browser), the server hasn't configured VAPID keys yet
 * (see .env.example), permission was already denied (re-prompting a denied
 * permission is a browser no-op anyway, but skip the API round-trip), or a
 * subscription already exists (subscribe() on an existing subscription just
 * returns it — this still re-POSTs it, which is fine, saveSubscription
 * upserts by endpoint).
 */
export function pushNotificationsSupported() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (typeof Notification === "undefined") return false;
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

export async function subscribeToPushNotifications() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return;
  if (typeof Notification !== "undefined" && Notification.permission === "denied") return;

  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription })
    });
  } catch {
    // Best-effort — a failed subscribe attempt must never block or crash
    // the login flow it's piggybacking on.
  }
}
