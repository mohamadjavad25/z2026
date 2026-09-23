import { getDb } from "../connection.js";

/**
 * Web Push subscription storage. One row per browser/device a user has
 * granted notification permission on (a user can have several — phone +
 * desktop, or two browsers) — see schema.js's push_subscriptions table.
 * endpoint is the natural dedupe key: the same browser re-subscribing (e.g.
 * after clearing site data) gets a fresh endpoint, but re-registering the
 * SAME still-valid subscription (a page reload re-running the subscribe
 * flow) must upsert, not insert a duplicate row that would double-send.
 */
export function saveSubscription(userId, subscription) {
  const endpoint = String(subscription?.endpoint || "");
  const p256dh = String(subscription?.keys?.p256dh || "");
  const auth = String(subscription?.keys?.auth || "");
  if (!userId || !endpoint || !p256dh || !auth) return { ok: false, error: "اشتراک نامعتبر است." };

  getDb().prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth
  `).run(Number(userId), endpoint, p256dh, auth);

  return { ok: true };
}

export function removeSubscription(userId, endpoint) {
  if (!userId || !endpoint) return { ok: false };
  getDb().prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?")
    .run(Number(userId), String(endpoint));
  return { ok: true };
}

export function listSubscriptionsForUser(userId) {
  if (!userId) return [];
  return getDb().prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
    .all(Number(userId));
}

/** Called when a push send comes back 404/410 (gone) — the browser/OS
 *  dropped that subscription (uninstalled, permission revoked, endpoint
 *  rotated); keeping a dead row around just means every future send retries
 *  and fails forever, so prune it the moment web-push tells us it's gone. */
export function removeSubscriptionById(subscriptionId) {
  if (!subscriptionId) return;
  getDb().prepare("DELETE FROM push_subscriptions WHERE id = ?").run(Number(subscriptionId));
}
