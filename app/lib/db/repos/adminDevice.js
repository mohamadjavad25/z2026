import { createHash, randomBytes } from "node:crypto";
import { getDb, get, run } from "../connection.js";
import { isAdminPhone } from "../../admin.js";

/**
 * Read-only keys of the «فرفرو مدیر» app's wallpaper and "always on" notification
 * (migrations/047_admin_device_tokens.sql). One per admin: making a new one drops the old, so a lost phone is cut
 * off by turning the features on again from the new one. Only the hash is stored; the key itself goes to the phone once.
 */

const FRESH_DAYS = 30;
const TOUCH_EVERY_MS = 10 * 60 * 1000;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export async function issueToken(userId) {
  const token = randomBytes(32).toString("hex");
  const db = await getDb();
  await run(db, "DELETE FROM admin_device_tokens WHERE user_id = $1", [Number(userId)]);
  await run(db, "INSERT INTO admin_device_tokens (user_id, token_hash) VALUES ($1, $2)", [Number(userId), sha256(token)]);
  return token;
}

export async function revokeForUser(userId) {
  const db = await getDb();
  await run(db, "DELETE FROM admin_device_tokens WHERE user_id = $1", [Number(userId)]);
}

/** The admin a key belongs to, or null: unknown, unused for FRESH_DAYS, suspended, or no longer in FRFRO_ADMIN_PHONES. */
export async function resolveToken(token) {
  const value = String(token || "");
  if (!/^[0-9a-f]{64}$/.test(value)) return null;
  const db = await getDb();
  const hash = sha256(value);
  const row = await get(db, `
    SELECT t.user_id, t.last_seen_at, u.phone, u.suspended_at
    FROM admin_device_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = $1 AND t.last_seen_at > now() - make_interval(days => $2)
  `, [hash, FRESH_DAYS]);
  if (!row || row.suspended_at || !isAdminPhone(row.phone)) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > TOUCH_EVERY_MS) {
    await run(db, "UPDATE admin_device_tokens SET last_seen_at = now() WHERE token_hash = $1", [hash]);
  }
  return { id: row.user_id, phone: row.phone };
}
