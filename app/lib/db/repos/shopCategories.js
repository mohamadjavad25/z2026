import { getDb, withTransaction } from "../connection.js";

/** Row order — this drives the row order on the dashboard and public storefront. */
export function listCategories(shopUserId) {
  return getDb().prepare(`
    SELECT id, name FROM shop_categories WHERE shop_user_id = ? ORDER BY sort_order ASC, id ASC
  `).all(shopUserId);
}

export function createCategory(shopUserId, name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return { ok: false, error: "نام دسته لازم است." };
  const db = getDb();
  const existing = db.prepare(
    "SELECT id, name FROM shop_categories WHERE shop_user_id = ? AND name = ?"
  ).get(shopUserId, trimmed);
  if (existing) return { ok: false, error: "این دسته از قبل وجود دارد.", category: existing };
  const nextOrder = db.prepare(
    "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM shop_categories WHERE shop_user_id = ?"
  ).get(shopUserId).next;
  const info = db.prepare(
    "INSERT INTO shop_categories (shop_user_id, name, sort_order) VALUES (?, ?, ?)"
  ).run(shopUserId, trimmed, nextOrder);
  return { ok: true, category: { id: Number(info.lastInsertRowid), name: trimmed } };
}

/** Renames a category and cascades the new name onto every product still carrying the old one. */
export function renameCategory(id, shopUserId, name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return { ok: false, error: "نام دسته لازم است." };
  const db = getDb();
  const current = db.prepare(
    "SELECT id, name FROM shop_categories WHERE id = ? AND shop_user_id = ?"
  ).get(id, shopUserId);
  if (!current) return { ok: false, error: "دسته پیدا نشد.", code: "NOT_FOUND" };
  if (current.name === trimmed) return { ok: true, category: current };
  const conflict = db.prepare(
    "SELECT id FROM shop_categories WHERE shop_user_id = ? AND name = ? AND id != ?"
  ).get(shopUserId, trimmed, id);
  if (conflict) return { ok: false, error: "دسته‌ای با این نام از قبل وجود دارد.", code: "DUPLICATE" };

  return withTransaction(db, () => {
    db.prepare("UPDATE shop_categories SET name = ? WHERE id = ? AND shop_user_id = ?").run(trimmed, id, shopUserId);
    db.prepare("UPDATE shop_products SET category = ?, updated_at = CURRENT_TIMESTAMP WHERE shop_user_id = ? AND category = ?")
      .run(trimmed, shopUserId, current.name);
    return { ok: true, category: { id, name: trimmed } };
  });
}

/** One-step reorder (swaps sort_order with the neighbor in that direction). */
export function moveCategory(id, shopUserId, direction) {
  const db = getDb();
  const ordered = listCategories(shopUserId);
  const index = ordered.findIndex((category) => category.id === id);
  if (index === -1) return { ok: false, error: "دسته پیدا نشد.", code: "NOT_FOUND" };
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) {
    return { ok: false, error: "جابه‌جایی ممکن نیست.", code: "EDGE" };
  }
  const rows = db.prepare(
    "SELECT id, sort_order FROM shop_categories WHERE shop_user_id = ? AND id IN (?, ?)"
  ).all(shopUserId, ordered[index].id, ordered[targetIndex].id);
  const a = rows.find((row) => row.id === ordered[index].id);
  const b = rows.find((row) => row.id === ordered[targetIndex].id);
  return withTransaction(db, () => {
    db.prepare("UPDATE shop_categories SET sort_order = ? WHERE id = ?").run(b.sort_order, a.id);
    db.prepare("UPDATE shop_categories SET sort_order = ? WHERE id = ?").run(a.sort_order, b.id);
    return { ok: true, categories: listCategories(shopUserId) };
  });
}

/** Refuses to delete a category that still has products — the owner must move or remove them first. */
export function deleteCategory(id, shopUserId) {
  const db = getDb();
  const category = db.prepare(
    "SELECT id, name FROM shop_categories WHERE id = ? AND shop_user_id = ?"
  ).get(id, shopUserId);
  if (!category) return { ok: false, error: "دسته پیدا نشد.", code: "NOT_FOUND" };
  const productCount = db.prepare(
    "SELECT COUNT(*) AS count FROM shop_products WHERE shop_user_id = ? AND category = ?"
  ).get(shopUserId, category.name).count;
  if (productCount > 0) {
    return {
      ok: false,
      error: `این دسته ${productCount} محصول دارد؛ اول محصولاتش را جابه‌جا یا حذف کن.`,
      code: "HAS_PRODUCTS",
      count: productCount
    };
  }
  db.prepare("DELETE FROM shop_categories WHERE id = ? AND shop_user_id = ?").run(id, shopUserId);
  return { ok: true };
}
