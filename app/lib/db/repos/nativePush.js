import { getDb, all, get, run } from "../connection.js";

/**
 * Device tokens of the frfro Android app (Firebase Cloud Messaging), one row per installed app
 * (migrations/041_native_push_tokens.sql). The token is the dedupe key: the same phone opening the
 * app again only refreshes last_seen_at, and a phone that logs in as someone else moves to them.
 */

/** A token the app has not refreshed for this long counts as gone (uninstalled without telling us). */
export const FRESH_DAYS = 30;

export async function saveToken(userId, token, platform = "android") {
  const value = String(token || "").trim();
  if (!userId || !value || value.length > 4096) return { ok: false, error: "توکن نامعتبر است." };
  const db = await getDb();
  await run(db, `
    INSERT INTO native_push_tokens (user_id, token, platform)
    VALUES ($1, $2, $3)
    ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now()
  `, [Number(userId), value, platform === "ios" ? "ios" : "android"]);
  return { ok: true };
}

export async function removeToken(userId, token) {
  if (!userId || !token) return;
  const db = await getDb();
  await run(db, "DELETE FROM native_push_tokens WHERE user_id = $1 AND token = $2", [Number(userId), String(token)]);
}

export async function removeTokenById(id) {
  if (!id) return;
  const db = await getDb();
  await run(db, "DELETE FROM native_push_tokens WHERE id = $1", [Number(id)]);
}

export async function listFreshTokens(userId) {
  if (!userId) return [];
  const db = await getDb();
  return all(db, `
    SELECT id, token, platform FROM native_push_tokens
    WHERE user_id = $1 AND last_seen_at > now() - make_interval(days => $2)
  `, [Number(userId), FRESH_DAYS]).catch(() => []);
}

export async function hasFreshToken(userId) {
  if (!userId) return false;
  const db = await getDb();
  const row = await get(db, `
    SELECT 1 AS yes FROM native_push_tokens
    WHERE user_id = $1 AND last_seen_at > now() - make_interval(days => $2) LIMIT 1
  `, [Number(userId), FRESH_DAYS]).catch(() => null);
  return Boolean(row);
}
