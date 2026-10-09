import webpush from "web-push";
import * as pushRepo from "./db/repos/push.js";

/**
 * Real Web Push notifications (see the audit item this closes: the app had
 * an installed-but-no-op service worker and zero push infrastructure, which
 * was the actual root cause of "salon/artist never finds out a request
 * auto-expired unless they happen to reopen the app"). Fails closed and
 * silent — see .env.example — so a deploy that hasn't set the VAPID env vars
 * yet just never sends pushes instead of crashing every booking/order route
 * that tries to notify someone.
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

/**
 * Sends the same { title, body, url } notification to every device/browser
 * a user has subscribed on. Best-effort per subscription: one dead
 * subscription (uninstalled app, revoked permission) must never block
 * delivery to the user's other devices, and a send failure here must never
 * fail the booking action that triggered it — callers fire this and move
 * on ("notification is best-effort", see bookingExpirySweep.js).
 */
export async function sendPushToUser(userId, { title, body, url = "/" } = {}) {
  if (!ensureConfigured()) return { ok: false, sent: 0, reason: "not-configured" };
  const subscriptions = await pushRepo.listSubscriptionsForUser(userId);
  if (!subscriptions.length) return { ok: true, sent: 0 };

  const payload = JSON.stringify({ title, body, url });
  let sent = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent += 1;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await pushRepo.removeSubscriptionById(sub.id);
      }
      // Any other failure (network blip, push service outage) is left
      // alone — the subscription might still be good next time.
    }
  }));
  return { ok: true, sent };
}
