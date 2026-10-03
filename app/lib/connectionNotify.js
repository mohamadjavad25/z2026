import { sendPushToUser } from "./push.js";

/**
 * Best-effort push for salon <-> artist connection events (invite sent /
 * answered, proposal sent / answered, QR join, member removed). Fire-and-forget:
 * a missing VAPID config, a user with no subscriptions, or a dead subscription
 * must never fail the action that triggered it.
 */
export function notifyConnection(userId, { title, body, url = "/" }) {
  const id = Number(userId || 0);
  if (!id) return;
  void sendPushToUser(id, { title, body, url }).catch(() => {});
}
