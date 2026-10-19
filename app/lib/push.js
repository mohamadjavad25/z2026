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

async function sendWebPush(userId, payload) {
  if (!ensureConfigured()) return 0;
  const subscriptions = await pushRepo.listSubscriptionsForUser(userId);
  let sent = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent += 1;
    } catch (error) {
      // Gone (uninstalled, permission revoked): prune it. Any other failure is left alone, it may work next time.
      if (error?.statusCode === 404 || error?.statusCode === 410) await pushRepo.removeSubscriptionById(sub.id);
    }
  }));
  return sent;
}

async function sendAppPush(userId, message) {
  if (!fcmConfigured()) return 0;
  const tokens = await nativePush.listFreshTokens(userId);
  let sent = 0;
  await Promise.all(tokens.map(async (row) => {
    const result = await sendFcm(row.token, message).catch(() => ({ ok: false, gone: false }));
    if (result.ok) sent += 1;
    else if (result.gone) await nativePush.removeTokenById(row.id);
  }));
  return sent;
}

/**
 * Sends the same { title, body, url } notification to every browser and app a user has. Best-effort per
 * device: one dead device never blocks the others, and a failure here never fails the action that
 * triggered it. `sent` counts both kinds, `appSent` only the Android app.
 */
export async function sendPushToUser(userId, { title, body, url = "/" } = {}) {
  if (!userId) return { ok: false, sent: 0, appSent: 0 };
  const [webSent, appSent] = await Promise.all([
    sendWebPush(userId, JSON.stringify({ title, body, url })).catch(() => 0),
    sendAppPush(userId, { title, body, url }).catch(() => 0)
  ]);
  return { ok: true, sent: webSent + appSent, appSent };
}

/**
 * Whether a message for this user can go as a push only, saving the SMS: they have the frfro Android app,
 * with notifications allowed, opened in the last 30 days. Everyone else (iPhone and other browsers, where
 * push is unreliable or off; phones without Google services; the old app) still gets the SMS.
 */
export async function reachableByAppPush(userId) {
  if (!fcmConfigured()) return false;
  return nativePush.hasFreshToken(userId);
}
