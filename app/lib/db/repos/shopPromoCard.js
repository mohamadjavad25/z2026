import { getDb, withTransaction } from "../connection.js";

function mapRow(row) {
  return {
    id: row.id,
    icon: row.icon_key,
    tone: row.tone,
    primary: row.primary_text,
    secondary: row.secondary_text,
    active: Boolean(row.is_active)
  };
}

/** Every saved card for a shop, in creation order. */
export function listPromoCards(shopUserId) {
  return getDb().prepare(`
    SELECT id, icon_key, tone, primary_text, secondary_text, is_active
    FROM shop_promo_cards WHERE shop_user_id = ? ORDER BY sort_order ASC, id ASC
  `).all(shopUserId).map(mapRow);
}

/** The one card currently shown on the dashboard/storefront, or null. */
export function getActivePromoCard(shopUserId) {
  const row = getDb().prepare(`
    SELECT id, icon_key, tone, primary_text, secondary_text, is_active
    FROM shop_promo_cards WHERE shop_user_id = ? AND is_active = 1
  `).get(shopUserId);
  return row ? mapRow(row) : null;
}

/** Adds a new card to the shop's library. Auto-activates it only if it's the shop's first card ever. */
export function createPromoCard(shopUserId, { icon, tone, primary, secondary }) {
  const iconKey = String(icon || "").trim();
  const toneKey = String(tone || "").trim();
  const primaryText = String(primary || "").trim();
  if (!iconKey) return { ok: false, error: "آیکن کارت لازم است." };
  if (!toneKey) return { ok: false, error: "رنگ کارت لازم است." };
  if (!primaryText) return { ok: false, error: "متن اصلی کارت لازم است." };
  const secondaryText = String(secondary || "").trim();

  const db = getDb();
  const existingCount = db.prepare(
    "SELECT COUNT(*) AS count FROM shop_promo_cards WHERE shop_user_id = ?"
  ).get(shopUserId).count;
  const nextOrder = db.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM shop_promo_cards WHERE shop_user_id = ?"
  ).get(shopUserId).next;
  const isActive = existingCount === 0 ? 1 : 0;

  const info = db.prepare(`
    INSERT INTO shop_promo_cards (shop_user_id, icon_key, tone, primary_text, secondary_text, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(shopUserId, iconKey, toneKey, primaryText, secondaryText, isActive, nextOrder);

  return {
    ok: true,
    card: { id: Number(info.lastInsertRowid), icon: iconKey, tone: toneKey, primary: primaryText, secondary: secondaryText, active: Boolean(isActive) }
  };
}

/** Makes one card the shop's active (shown) card, deactivating every other one. */
export function activatePromoCard(id, shopUserId) {
  const db = getDb();
  const card = db.prepare("SELECT id FROM shop_promo_cards WHERE id = ? AND shop_user_id = ?").get(id, shopUserId);
  if (!card) return { ok: false, error: "کارت پیدا نشد.", code: "NOT_FOUND" };
  return withTransaction(db, () => {
    db.prepare("UPDATE shop_promo_cards SET is_active = 0 WHERE shop_user_id = ?").run(shopUserId);
    db.prepare("UPDATE shop_promo_cards SET is_active = 1 WHERE id = ?").run(id);
    return { ok: true, cards: listPromoCards(shopUserId) };
  });
}

/** Deletes a card. If it was active, nothing else auto-activates — the owner picks the next one. */
export function deletePromoCard(id, shopUserId) {
  const db = getDb();
  const card = db.prepare("SELECT id FROM shop_promo_cards WHERE id = ? AND shop_user_id = ?").get(id, shopUserId);
  if (!card) return { ok: false, error: "کارت پیدا نشد.", code: "NOT_FOUND" };
  db.prepare("DELETE FROM shop_promo_cards WHERE id = ? AND shop_user_id = ?").run(id, shopUserId);
  return { ok: true };
}
