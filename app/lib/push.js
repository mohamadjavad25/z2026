import webpush from "web-push";
import * as pushRepo from "./db/repos/push.js";
import * as nativePush from "./db/repos/nativePush.js";
import { fcmConfigured, sendFcm } from "./fcm.js";

/**
 * Push notifications, two kinds side by side:
 *  - Web Push (VAPID) to browsers that subscribed (push_subscriptions), and
 *  - Firebase (fcm.js) to the frfro Android app (native_push_tokens).
 * Each half fails closed and silent when its env vars are not set, so a deploy without them just never
 * sends that kind instead of crashing every booking/order route that tries to notify someone.
 */
/** How long one push service may take to answer before we move on (a phone's push service that never answers
 *  used to stall the whole reminder sweep and the admin's broadcast). */
const SEND_TIMEOUT_MS = 8000;
/** How long a push waits for an offline phone by default. Reminders pass their own, shorter one. */
const DEFAULT_TTL_SECONDS = 24 * 3600;

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.FRFRO_VAPID_PRIVATE_KEY;
  const contact = process.env.FRFRO_VAPID_CONTACT;
  if (!publicKey || !privateKey || !contact) return false;
  webpush.setVapidDetails(contact, publicKey, privateKey);
  configured = true;
  return true;
}

async function sendWebPush(userId, payload, ttl) {
  if (!ensureConfigured()) return 0;
  const subscriptions = await pushRepo.listSubscriptionsForUser(userId);
  let sent = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: ttl, timeout: SEND_TIMEOUT_MS, urgency: "high" });
      sent += 1;
    } catch (error) {
      // Gone (uninstalled, permission revoked): prune it. Any other failure is left alone, it may work next time.
      if (error?.statusCode === 404 || error?.statusCode === 410) await pushRepo.removeSubscriptionById(sub.id);
    }
  }));
  return sent;
}

async function sendAppPush(userId, message, ttl) {
  if (!fcmConfigured()) return 0;
  const tokens = await nativePush.listFreshTokens(userId);
  let sent = 0;
  await Promise.all(tokens.map(async (row) => {
    const result = await sendFcm(row.token, { ...message, ttl }).catch(() => ({ ok: false, gone: false }));
    if (result.ok) sent += 1;
    else if (result.gone) await nativePush.removeTokenById(row.id);
  }));
  return sent;
}

/**
 * Sends the same { title, body, url } notification to every browser and app a user has. Best-effort per
 * device: one dead device never blocks the others, and a failure here never fails the action that
 * triggered it. `sent` counts both kinds, `appSent` only the Android app (Firebase took it). `ttl` (seconds) is how long
 * it may wait for a phone that is off: a reminder past its appointment is worse than none.
 */
export async function sendPushToUser(userId, { title, body, url = "/", ttl = DEFAULT_TTL_SECONDS } = {}) {
  if (!userId) return { ok: false, sent: 0, appSent: 0 };
  const seconds = Math.max(60, Math.round(Number(ttl) || DEFAULT_TTL_SECONDS));
  const [webSent, appSent] = await Promise.all([
    sendWebPush(userId, JSON.stringify({ title, body, url }), seconds).catch(() => 0),
    sendAppPush(userId, { title, body, url }, seconds).catch(() => 0)
  ]);
  return { ok: true, sent: webSent + appSent, appSent };
}

/**
 * Whether a message for this user can go as a push only, saving the SMS: they have the frfro Android app,
 * with notifications allowed, opened in the last 30 days. Everyone else (iPhone and other browsers, where
 * push is unreliable or off; phones without Google services; the old app) still gets the SMS.
 * Callers that just sent the push should look at its `appSent` instead (pushReachedApp): a fresh token
 * says nothing about whether Firebase took this one message.
 */
export async function reachableByAppPush(userId) {
  if (!fcmConfigured()) return false;
  return nativePush.hasFreshToken(userId);
}

/** After a sendPushToUser(): true when Firebase took it for at least one of the person's Android apps, so the SMS can
 *  be skipped. A push that failed (Google unreachable, token dead) is false, and the SMS goes as before. */
export async function pushReachedApp(pushPromise) {
  const result = await Promise.resolve(pushPromise).catch(() => null);
  return Number(result?.appSent || 0) > 0;
}
