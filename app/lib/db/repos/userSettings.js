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
  showPrices: true,
  // Artist booking controls (profile settings > رزرو و ظرفیت کاری).
  vacationMode: false,
  directBooking: true,
  autoConfirm: false,
  reminders: true
};

const KNOWN_KEYS = new Set(Object.keys(DEFAULT_SETTINGS));

export async function getSettings(userId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, "SELECT settings FROM user_settings WHERE user_id = $1", [Number(userId)]);
  // settings is JSONB -- the `pg` driver already parses it into a plain JS
  // object, no manual JSON.parse needed (or possible: row.settings is an
  // object here, not a JSON string).
  const stored = row?.settings && typeof row.settings === "object" ? row.settings : {};
  // Only the known toggles: the same JSON also holds private values (e.g. the
  // client's connect secret, see repos/connections.js) that must not reach the UI.
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of KNOWN_KEYS) {
    if (key in stored) settings[key] = stored[key];
  }
  return settings;
}

/** Merges `patch` (only known keys, coerced to boolean) into the stored settings and returns the full result.
 *  The merge happens inside SQL (jsonb ||) so two toggles saved at nearly the same time
 *  can't overwrite each other's keys with a stale read. */
export async function saveSettings(userId, patch = {}) {
  const db = await getDb();
  const clean = {};
  for (const key of Object.keys(patch)) {
    if (KNOWN_KEYS.has(key)) clean[key] = Boolean(patch[key]);
  }
  await run(db, `
    INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      settings = COALESCE(user_settings.settings, '{}'::jsonb) || excluded.settings,
      updated_at = excluded.updated_at
  `, [Number(userId), JSON.stringify(clean)]);
  return getSettings(userId, db);
}
