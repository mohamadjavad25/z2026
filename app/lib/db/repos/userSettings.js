import { getDb, all, get, run } from "../connection.js";

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
  reminders: true,
  // «یادآوری وقتش شده» for clients (owner's decision of 2026-10-25: on by default).
  dueReminders: true,
  // The role's tutorial slides are still to be seen: set once by sign-up, cleared when they end. Accounts made
  // before the tutorial existed never had it, so they never get it uninvited (Settings › «آموزش فرفرو» replays it).
  tutorialPending: false
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

/**
 * «نمایش قیمت‌ها» off (owner's decision of 2026-11-01): nobody but the provider sees a price of theirs. The price
 * comes out as "" (the column's "no price") and `priceHidden` tells the page to leave the spot empty, with no
 * «قیمت توافقی» in its place. Bookings still read the real menu on the server.
 */
/** Whether this salon's or artist's public page opens for a visitor (the switch in Settings). */
export async function hasPublicPage(userId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, "SELECT settings FROM user_settings WHERE user_id = $1", [Number(userId)]);
  return row?.settings?.publicPortfolio !== false;
}

/** The salons and artists with a page search engines may list: not suspended, not set to private. Ids only, for the sitemap. */
export async function listPublicProviderPages(runner = null) {
  const db = runner || (await getDb());
  return all(db, `
    SELECT u.id, u.type FROM users u LEFT JOIN user_settings s ON s.user_id = u.id
    WHERE u.type IN ('salon', 'artist') AND u.suspended_at IS NULL AND COALESCE(s.settings->>'publicPortfolio', 'true') <> 'false'
    ORDER BY u.id DESC
  `);
}

export function hidesPrices(settings) {
  return settings?.showPrices === false;
}

/** The services as a client sees them when the provider hides prices; as they are otherwise. */
export function shownServices(services, hide) {
  const list = Array.isArray(services) ? services : [];
  return hide ? list.map((service) => ({ ...service, price: "", priceHidden: true })) : list;
}

/** Of these provider ids, the ones whose prices are hidden (one query). */
export async function idsHidingPrices(ids, runner = null) {
  const wanted = [...new Set((ids || []).map(Number).filter(Boolean))];
  if (!wanted.length) return new Set();
  const db = runner || (await getDb());
  const rows = await all(db, "SELECT user_id FROM user_settings WHERE user_id = ANY($1) AND settings->>'showPrices' = 'false'", [wanted]);
  return new Set(rows.map((row) => Number(row.user_id)));
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
