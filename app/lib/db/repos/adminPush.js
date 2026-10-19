import { getDb, all, run } from "../connection.js";
import { FRESH_DAYS } from "./nativePush.js";

/**
 * Device tokens of the private «فرفرو مدیر» app (migrations/042_admin_push_tokens.sql), one row per
 * installed admin app. Same rules as nativePush.js: the token is the dedupe key, and one not refreshed
 * for FRESH_DAYS counts as gone.
 */

export async function saveToken(userId, token) {
  const value = String(token || "").trim();
  if (!userId || !value || value.length > 4096) return { ok: false, error: "توکن نامعتبر است." };
  const db = await getDb();
  await run(db, `
    INSERT INTO admin_push_tokens (user_id, token)
    VALUES ($1, $2)
    ON CONFLICT (token) DO UPDATE SET user_id = excluded.user_id, last_seen_at = now()
  `, [Number(userId), value]);
  return { ok: true };
}

export async function removeToken(userId, token) {
  if (!userId || !token) return;
  const db = await getDb();
  await run(db, "DELETE FROM admin_push_tokens WHERE user_id = $1 AND token = $2", [Number(userId), String(token)]);
}

export async function removeTokenById(id) {
  if (!id) return;
  const db = await getDb();
  await run(db, "DELETE FROM admin_push_tokens WHERE id = $1", [Number(id)]);
}

/** Fresh tokens of the accounts whose phone is in `phones` (the current FRFRO_ADMIN_PHONES), with each one's phone. */
export async function listFreshTokensForPhones(phones) {
  if (!phones?.length) return [];
  const db = await getDb();
  return all(db, `
    SELECT t.id, t.token, u.phone FROM admin_push_tokens t JOIN users u ON u.id = t.user_id
    WHERE u.phone = ANY($1::text[]) AND u.suspended_at IS NULL
      AND t.last_seen_at > now() - make_interval(days => $2)
  `, [phones, FRESH_DAYS]).catch(() => []);
}
