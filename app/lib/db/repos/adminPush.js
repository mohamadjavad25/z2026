import { getDb, all, run } from "../connection.js";
import { FRESH_DAYS } from "./nativePush.js";

/**
 * Device tokens of the private «فرفرو مدیر» app (migrations/042_admin_push_tokens.sql), one row per
 * installed admin app. Same rules as nativePush.js: the token is the dedupe key, and one not refreshed
 * for FRESH_DAYS counts as gone.
 */

/** Tokens belong to the admin account (admin_accounts, migration 057), not to an app user: user_id stays empty. */
export async function saveToken(adminId, token) {
  const value = String(token || "").trim();
  if (!adminId || !value || value.length > 4096) return { ok: false, error: "توکن نامعتبر است." };
  const db = await getDb();
  await run(db, `
    INSERT INTO admin_push_tokens (admin_id, user_id, token)
    VALUES ($1, NULL, $2)
    ON CONFLICT (token) DO UPDATE SET admin_id = excluded.admin_id, user_id = NULL, last_seen_at = now()
  `, [Number(adminId), value]);
  return { ok: true };
}

export async function removeToken(adminId, token) {
  if (!adminId || !token) return;
  const db = await getDb();
  await run(db, "DELETE FROM admin_push_tokens WHERE admin_id = $1 AND token = $2", [Number(adminId), String(token)]);
}

export async function removeTokenById(id) {
  if (!id) return;
  const db = await getDb();
  await run(db, "DELETE FROM admin_push_tokens WHERE id = $1", [Number(id)]);
}

/** Fresh tokens of the admin accounts whose phone is in `phones` (the current FRFRO_ADMIN_PHONES), with each one's phone. */
export async function listFreshTokensForPhones(phones) {
  if (!phones?.length) return [];
  const db = await getDb();
  return all(db, `
    SELECT t.id, t.token, a.phone FROM admin_push_tokens t JOIN admin_accounts a ON a.id = t.admin_id
    WHERE a.phone = ANY($1::text[])
      AND t.last_seen_at > now() - make_interval(days => $2)
  `, [phones, FRESH_DAYS]).catch(() => []);
}
