import { getDb, all, run } from "../connection.js";

/**
 * Web Push subscription storage. One row per browser/device a user has
 * granted notification permission on (a user can have several — phone +
 * desktop, or two browsers) — see migrations/001_baseline.sql's
 * push_subscriptions table.
 * endpoint is the natural dedupe key: the same browser re-subscribing (e.g.
 * after clearing site data) gets a fresh endpoint, but re-registering the
 * SAME still-valid subscription (a page reload re-running the subscribe
 * flow) must upsert, not insert a duplicate row that would double-send.
 */
export async function saveSubscription(userId, subscription) {
  const endpoint = String(subscription?.endpoint || "");
  const p256dh = String(subscription?.keys?.p256dh || "");
  const auth = String(subscription?.keys?.auth || "");
  if (!userId || !endpoint || !p256dh || !auth) return { ok: false, error: "اشتراک نامعتبر است." };

  const db = await getDb();
  await run(db, `
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth
  `, [Number(userId), endpoint, p256dh, auth]);

  return { ok: true };
}

export async function removeSubscription(userId, endpoint) {
  if (!userId || !endpoint) return { ok: false };
  const db = await getDb();
  await run(db, "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?", [Number(userId), String(endpoint)]);
  return { ok: true };
}

export async function listSubscriptionsForUser(userId) {
  if (!userId) return [];
  const db = await getDb();
  return all(db, "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", [Number(userId)]);
}

/** Called when a push send comes back 404/410 (gone) — the browser/OS
 *  dropped that subscription (uninstalled, permission revoked, endpoint
 *  rotated); keeping a dead row around just means every future send retries
 *  and fails forever, so prune it the moment web-push tells us it's gone. */
export async function removeSubscriptionById(subscriptionId) {
  if (!subscriptionId) return;
  const db = await getDb();
  await run(db, "DELETE FROM push_subscriptions WHERE id = ?", [Number(subscriptionId)]);
}
