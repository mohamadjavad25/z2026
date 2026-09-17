import { getDb } from "../connection.js";

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

export function getSettings(userId) {
  const row = getDb().prepare(
    "SELECT settings FROM user_settings WHERE user_id = ?"
  ).get(Number(userId));
  let stored = {};
  if (row?.settings) {
    try {
      stored = JSON.parse(row.settings) || {};
    } catch {
      stored = {};
    }
  }
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** Merges `patch` (only known keys, coerced to boolean) into the stored settings and returns the full result. */
export function saveSettings(userId, patch = {}) {
  const current = getSettings(userId);
  const next = { ...current };
  for (const key of Object.keys(patch)) {
    if (KNOWN_KEYS.has(key)) {
      next[key] = Boolean(patch[key]);
    }
  }
  getDb().prepare(`
    INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      settings = excluded.settings,
      updated_at = excluded.updated_at
  `).run(Number(userId), JSON.stringify(next));
  return next;
}
