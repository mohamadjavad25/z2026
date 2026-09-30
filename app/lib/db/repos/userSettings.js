import { getDb, get, run } from "../connection.js";

/**
 * Defaults for every known toggle across roles. getSettings always returns
 * every key (merged with whatever's actually stored) so the frontend never
 * has to guess a fallback — and so a brand-new user still gets sane values
 * before ever saving anything.
 */
export const DEFAULT_SETTINGS = {
  publicPortfolio: true,
  reservationAlerts: true,
  orderAlerts: true,
  shippingReady: true,
  smartSuggestions: true,
  showPrices: true
};

const KNOWN_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

export async function getSettings(userId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, "SELECT settings FROM user_settings WHERE user_id = ?", [Number(userId)]);
  // settings is JSONB -- the `pg` driver already parses it into a plain JS
  // object, no manual JSON.parse needed (or possible: row.settings is an
  // object here, not a JSON string).
  const stored = row?.settings && typeof row.settings === "object" ? row.settings : {};
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** Merges `patch` (only known keys, coerced to boolean) into the stored settings and returns the full result. */
export async function saveSettings(userId, patch = {}) {
  const db = await getDb();
  const current = await getSettings(userId, db);
  const next = { ...current };
  for (const key of Object.keys(patch)) {
    if (KNOWN_KEYS.has(key)) {
      next[key] = Boolean(patch[key]);
    }
  }
  await run(db, `
    INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      settings = excluded.settings,
      updated_at = excluded.updated_at
  `, [Number(userId), JSON.stringify(next)]);
  return next;
}
