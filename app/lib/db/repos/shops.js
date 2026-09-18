import { getDb, withTransaction } from "../connection.js";
import { countFollowers } from "./users.js";
import { storyFieldsFor } from "./stories.js";
import { getSettings } from "./userSettings.js";
import { listCategories } from "./shopCategories.js";
import { getActivePromoCard } from "./shopPromoCard.js";

/**
 * Full category name order for a shop: real created categories first (in
 * creation order), then any category string still sitting on a product but
 * never formally created (legacy data, or a category whose row was deleted
 * — the product must not silently vanish from every category-row view).
 */
function resolveCategoryOrder(shopUserId, products) {
  const stored = listCategories(shopUserId).map((row) => row.name);
  const known = new Set(stored);
  const fromProducts = [];
  for (const product of products) {
    const name = String(product.category || "").trim();
    if (name && !known.has(name)) {
      known.add(name);
      fromProducts.push(name);
    }
  }
  return [...stored, ...fromProducts];
}

export const SHOP_ORDER_STATUSES = ["جدید", "در حال آماده‌سازی", "ارسال شد", "تحویل شد", "لغو شده", "مرجوعی شد"];

/** Terminal statuses that already resolved the order's stock (nothing further can change it). */
const ORDER_STATUS_RESOLVED = new Set(["لغو شده", "مرجوعی شد"]);

/**
 * Status changes a shop owner may make from PATCH /api/shop/orders. Forward
 * progress (جدید → ... → تحویل شد), cancel from any non-final step, and a
 * single return step from تحویل شد — never both cancelled and returned, and
 * never a jump straight to "لغو شده"/"مرجوعی شد" from an already-resolved order.
 */
const ORDER_STATUS_TRANSITIONS = {
  "جدید": ["در حال آماده‌سازی", "لغو شده"],
  "در حال آماده‌سازی": ["ارسال شد", "لغو شده"],
  "ارسال شد": ["تحویل شد", "لغو شده"],
  "تحویل شد": ["مرجوعی شد"],
  "لغو شده": [],
  "مرجوعی شد": []
};

/**
 * Public directory: hides shops the owner has switched to "خصوصی" via
 * تنظیمات → ویترین عمومی فروشگاه. Not just cosmetic — createOrder() and the
 * single-shop route separately enforce the same flag server-side.
 */
export function listShops() {
  return getDb().prepare(`
    SELECT s.*, u.avatar, u.bio AS user_bio,
      (SELECT COUNT(*) FROM follows f WHERE f.target_user_id = s.user_id) AS followers,
      (SELECT AVG(rating) FROM reviews r WHERE r.target_user_id = s.user_id) AS avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.target_user_id = s.user_id) AS review_count,
      (SELECT COUNT(*) FROM shop_products p WHERE p.shop_user_id = s.user_id) AS product_count
    FROM shops s
    JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at DESC
  `).all().map(mapShop).filter((shop) => shop.isPublic);
}

export function getShop(userId) {
  const row = getDb().prepare(`
    SELECT s.*, u.avatar, u.bio AS user_bio,
      (SELECT COUNT(*) FROM follows f WHERE f.target_user_id = s.user_id) AS followers,
      (SELECT AVG(rating) FROM reviews r WHERE r.target_user_id = s.user_id) AS avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.target_user_id = s.user_id) AS review_count,
      (SELECT COUNT(*) FROM shop_products p WHERE p.shop_user_id = s.user_id) AS product_count
    FROM shops s JOIN users u ON u.id = s.user_id
    WHERE s.user_id = ?
  `).get(userId);
  if (!row) return null;
  const products = listProducts(userId);
  return {
    ...mapShop(row),
    ...(storyFieldsFor(userId) || {}),
    products,
    categories: resolveCategoryOrder(userId, products),
    reviews: listShopReviews(userId),
    promoCard: getActivePromoCard(userId)
  };
}

function mapShop(row) {
  const reviewCount = Number(row.review_count || 0);
  const rating = reviewCount
    ? Number(row.avg_rating).toFixed(1)
    : (row.rating ? String(row.rating) : "");
  const followers = Number(row.followers || 0);
  const settings = getSettings(row.user_id);
  return {
    id: row.user_id,
    name: row.name,
    area: row.area,
    category: row.category,
    phone: row.phone,
    email: row.email,
    bio: row.bio || row.user_bio || "",
    avatar: row.avatar || "",
    rating,
    reviewCount,
    productCount: Number(row.product_count || 0),
    followers,
    followerCount: followers,
    hasStory: Boolean(storyFieldsFor(row.user_id)),
    isPublic: settings.publicPortfolio !== false,
    acceptingOrders: settings.shippingReady !== false
  };
}

const PRODUCT_SELECT = `
  SELECT sp.*,
    (SELECT COALESCE(SUM(quantity), 0) FROM shop_order_items WHERE product_id = sp.id) AS sold
  FROM shop_products sp
`;

export function listProducts(shopUserId) {
  return getDb().prepare(`
    ${PRODUCT_SELECT} WHERE sp.shop_user_id = ? ORDER BY sp.id DESC
  `).all(shopUserId).map(mapProduct);
}

function getProductRow(db, id) {
  return db.prepare(`${PRODUCT_SELECT} WHERE sp.id = ?`).get(id);
}

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    priceNum: row.price_num,
    stock: row.stock,
    badge: row.badge,
    image: row.image,
    description: row.description,
    featured: Boolean(row.featured),
    sold: Number(row.sold || 0)
  };
}

/**
 * Server-side idempotency for order creation: a client-supplied key lets a
 * retried/duplicated POST /api/shop/orders (network retry, a double-submit
 * that slips past the client busy-gate, two truly-parallel requests) return
 * the first order instead of placing — and stock-decrementing — a second
 * one. Must be read/written from inside the SAME withTransaction() as the
 * order itself: SQLite serializes writers via BEGIN IMMEDIATE, so a genuinely
 * concurrent duplicate blocks until the first transaction commits, then sees
 * the stored row here. Same pattern as wallet_idempotency_keys in wallet.js.
 */
function readIdempotentOrderResult(db, buyerUserId, key) {
  if (!buyerUserId || !key) return undefined;
  const row = db.prepare(
    "SELECT response_json FROM shop_order_idempotency_keys WHERE buyer_user_id = ? AND key = ?"
  ).get(buyerUserId, key);
  if (!row) return undefined;
  try {
    return JSON.parse(row.response_json);
  } catch {
    return undefined;
  }
}

function storeIdempotentOrderResult(db, buyerUserId, key, result) {
  if (!buyerUserId || !key) return;
  db.prepare(`
    INSERT INTO shop_order_idempotency_keys (buyer_user_id, key, response_json)
    VALUES (?, ?, ?)
    ON CONFLICT(buyer_user_id, key) DO NOTHING
  `).run(buyerUserId, key, JSON.stringify(result));
}

/** Appends one row to the stock audit trail — never mutated, only ever inserted. */
function recordStockMovement(db, { shopUserId, productId, productName, delta, reason, orderId = null, note = "" }) {
  if (!delta) return;
  db.prepare(`
    INSERT INTO shop_stock_movements (shop_user_id, product_id, product_name, delta, reason, order_id, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(shopUserId, productId ?? null, productName || "", delta, reason, orderId, note);
}

export function listStockMovements(shopUserId, { limit = 50 } = {}) {
  return getDb().prepare(`
    SELECT id, product_id AS productId, product_name AS productName, delta, reason,
      order_id AS orderId, note, created_at AS createdAt
    FROM shop_stock_movements
    WHERE shop_user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(shopUserId, Math.max(1, Math.min(200, Number(limit) || 50)));
}

export function addProduct(shopUserId, data) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO shop_products
      (shop_user_id, name, category, price, price_num, stock, badge, image, description, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    shopUserId,
    data.name || "",
    data.category || "",
    data.price || "",
    Number(data.priceNum || 0),
    Number(data.stock || 0),
    data.badge || "",
    data.image || "",
    data.description || "",
    data.featured ? 1 : 0
  );
  return mapProduct(getProductRow(db, Number(info.lastInsertRowid)));
}

export function updateProduct(id, shopUserId, data) {
  const db = getDb();
  return withTransaction(db, () => {
    const current = db.prepare("SELECT * FROM shop_products WHERE id = ? AND shop_user_id = ?").get(id, shopUserId);
    if (!current) return null;
    const nextStock = data.stock ?? current.stock;
    const nextName = data.name ?? current.name;
    db.prepare(`
      UPDATE shop_products SET
        name = ?, category = ?, price = ?, price_num = ?, stock = ?, badge = ?, image = ?, description = ?,
        featured = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND shop_user_id = ?
    `).run(
      nextName,
      data.category ?? current.category,
      data.price ?? current.price,
      data.priceNum ?? current.price_num,
      nextStock,
      data.badge ?? current.badge,
      data.image ?? current.image,
      data.description ?? current.description,
      data.featured != null ? (data.featured ? 1 : 0) : current.featured,
      id,
      shopUserId
    );
    // Only an owner-driven change in the number itself is a "manual" stock
    // movement — sales/cancels/returns go through their own reasons above,
    // never through this generic product-edit path.
    const delta = Number(nextStock) - Number(current.stock);
    recordStockMovement(db, { shopUserId, productId: id, productName: nextName, delta, reason: "manual_adjust" });
    return mapProduct(getProductRow(db, id));
  });
}

/**
 * Refuses to delete a product still tied to an unresolved order (جدید / در
 * حال آماده‌سازی / ارسال شد) — deleting it would strand that order's stock
 * with no product row left to ever restock. Throws {code:"has_active_orders"}.
 * Any remaining stock is written off as a final audit-trail entry.
 */
export function deleteProduct(id, shopUserId) {
  const db = getDb();
  return withTransaction(db, () => {
    const product = db.prepare("SELECT * FROM shop_products WHERE id = ? AND shop_user_id = ?").get(id, shopUserId);
    if (!product) return false;

    const activeOrder = db.prepare(`
      SELECT o.id FROM shop_order_items i
      JOIN shop_orders o ON o.id = i.order_id
      WHERE i.product_id = ? AND o.status NOT IN ('لغو شده', 'مرجوعی شد', 'تحویل شد')
      LIMIT 1
    `).get(id);
    if (activeOrder) {
      const err = new Error("has_active_orders");
      err.code = "has_active_orders";
      throw err;
    }

    const info = db.prepare("DELETE FROM shop_products WHERE id = ? AND shop_user_id = ?").run(id, shopUserId);
    if (!info.changes) return false;
    if (Number(product.stock) > 0) {
      recordStockMovement(db, {
        shopUserId,
        productId: null,
        productName: product.name,
        delta: -Number(product.stock),
        reason: "product_deleted"
      });
    }
    return true;
  });
}

export function listOrders(shopUserId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.*, i.id AS item_id, i.product_id AS item_product_id, i.name AS item_name,
      i.quantity AS item_quantity, i.price AS item_price, i.price_num AS item_price_num
    FROM shop_orders o
    LEFT JOIN shop_order_items i ON i.order_id = o.id
    WHERE o.shop_user_id = ?
    ORDER BY o.id DESC, i.id ASC
  `).all(shopUserId);

  const ordersById = new Map();
  for (const row of rows) {
    let order = ordersById.get(row.id);
    if (!order) {
      order = {
        id: row.id,
        shop_user_id: row.shop_user_id,
        buyer_user_id: row.buyer_user_id,
        buyer_name: row.buyer_name,
        buyer_phone: row.buyer_phone,
        status: row.status,
        total: row.total,
        total_num: row.total_num,
        created_at: row.created_at,
        updated_at: row.updated_at,
        items: []
      };
      ordersById.set(row.id, order);
    }
    if (row.item_id != null) {
      order.items.push({
        id: row.item_id,
        orderId: row.id,
        productId: row.item_product_id,
        name: row.item_name,
        quantity: row.item_quantity,
        price: row.item_price,
        priceNum: row.item_price_num
      });
    }
  }
  return Array.from(ordersById.values());
}

/**
 * Creates an order with server-trusted pricing: each item's price/priceNum is
 * re-read from shop_products (never from the client payload), the total is
 * recomputed from those, and stock is decremented atomically. Throws
 * {code: "invalid_item"} or {code: "insufficient_stock", productName} on
 * failure — the whole order is rolled back.
 *
 * `data.idempotencyKey` (scoped to `data.buyerUserId`) dedupes a retried call:
 * a repeat with the same key returns the original order (tagged `replayed:
 * true`, stripped by the caller) instead of creating and decrementing stock
 * for a second one.
 */
export function createOrder(shopUserId, data) {
  const db = getDb();
  const items = Array.isArray(data.items) ? data.items : [];
  const buyerUserId = data.buyerUserId || null;
  const idempotencyKey = String(data.idempotencyKey || "").trim();

  return withTransaction(db, () => {
    const existing = readIdempotentOrderResult(db, buyerUserId, idempotencyKey);
    if (existing) return { ...existing, replayed: true };

    const resolvedItems = items.map((item) => {
      const productId = Number(item.productId || item.id);
      const rawQuantity = Number(item.quantity);
      const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.floor(rawQuantity) : 1;
      if (!productId) {
        const error = new Error("invalid_item");
        error.code = "invalid_item";
        throw error;
      }
      const product = db.prepare(
        "SELECT id, name, price, price_num, stock FROM shop_products WHERE id = ? AND shop_user_id = ?"
      ).get(productId, shopUserId);
      if (!product) {
        const error = new Error("invalid_item");
        error.code = "invalid_item";
        throw error;
      }
      const decrement = db.prepare(`
        UPDATE shop_products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND shop_user_id = ? AND stock >= ?
      `).run(quantity, productId, shopUserId, quantity);
      if (!decrement.changes) {
        const error = new Error("insufficient_stock");
        error.code = "insufficient_stock";
        error.productName = product.name;
        throw error;
      }
      return {
        productId,
        name: product.name,
        quantity,
        price: product.price,
        priceNum: Number(product.price_num || 0)
      };
    });

    const totalNum = resolvedItems.reduce((sum, item) => sum + item.priceNum * item.quantity, 0);

    const info = db.prepare(`
      INSERT INTO shop_orders
        (shop_user_id, buyer_user_id, buyer_name, buyer_phone, status, total, total_num)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      shopUserId,
      data.buyerUserId || null,
      data.buyerName || "",
      data.buyerPhone || "",
      "جدید",
      totalNum.toLocaleString("en-US"),
      totalNum
    );
    const orderId = Number(info.lastInsertRowid);
    const insertItem = db.prepare(`
      INSERT INTO shop_order_items (order_id, product_id, name, quantity, price, price_num)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    resolvedItems.forEach((item) => {
      insertItem.run(orderId, item.productId, item.name, item.quantity, item.price, item.priceNum);
      recordStockMovement(db, {
        shopUserId,
        productId: item.productId,
        productName: item.name,
        delta: -item.quantity,
        reason: "sale",
        orderId
      });
    });

    const result = {
      ...db.prepare("SELECT * FROM shop_orders WHERE id = ?").get(orderId),
      items: resolvedItems
    };
    storeIdempotentOrderResult(db, buyerUserId, idempotencyKey, result);
    return result;
  });
}

/**
 * Moves an order to a new status, following ORDER_STATUS_TRANSITIONS. A move
 * into "لغو شده" or "مرجوعی شد" restocks every line item back onto its
 * product atomically, in the same transaction as the status change — stock
 * a sale took out always comes back through the same door it left by.
 * Throws {code: "invalid_transition"}; returns null if the order isn't found.
 */
export function updateOrderStatus(id, shopUserId, status) {
  if (!SHOP_ORDER_STATUSES.includes(status)) return null;
  const db = getDb();
  return withTransaction(db, () => {
    const current = db.prepare("SELECT * FROM shop_orders WHERE id = ? AND shop_user_id = ?").get(id, shopUserId);
    if (!current) return null;

    const allowed = ORDER_STATUS_TRANSITIONS[current.status] || [];
    if (current.status !== status && !allowed.includes(status)) {
      const err = new Error("invalid_transition");
      err.code = "invalid_transition";
      throw err;
    }

    const info = db.prepare(`
      UPDATE shop_orders SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND shop_user_id = ?
    `).run(status, id, shopUserId);
    if (!info.changes) return null;

    const items = db.prepare(`
      SELECT id, order_id AS orderId, product_id AS productId, name, quantity, price, price_num AS priceNum
      FROM shop_order_items WHERE order_id = ? ORDER BY id ASC
    `).all(id);

    // current.status !== status is already guaranteed distinct by the
    // transition check above (a status can't transition to itself), so this
    // only ever fires once per order — no double-restock on a repeated call.
    if (ORDER_STATUS_RESOLVED.has(status) && current.status !== status) {
      const reason = status === "لغو شده" ? "cancel_restock" : "return_restock";
      items.forEach((item) => {
        if (!item.productId) return;
        db.prepare(`
          UPDATE shop_products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND shop_user_id = ?
        `).run(item.quantity, item.productId, shopUserId);
        recordStockMovement(db, {
          shopUserId,
          productId: item.productId,
          productName: item.name,
          delta: item.quantity,
          reason,
          orderId: id
        });
      });
    }

    const order = db.prepare("SELECT * FROM shop_orders WHERE id = ?").get(id);
    return { ...order, items };
  });
}

/**
 * A client's own purchase history across every shop — same row/item shape as
 * listOrders() (shop-owner side), plus the shop's name/avatar so a client
 * view can label each order and link back to "خرید دوباره" without a second
 * round-trip. Scoped to buyer_user_id only — never exposes another buyer's
 * orders, and never overlaps with listOrders()'s shop-owner scoping.
 */
export function listOrdersByBuyer(buyerUserId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.*, s.name AS shop_name, u.avatar AS shop_avatar,
      i.id AS item_id, i.product_id AS item_product_id, i.name AS item_name,
      i.quantity AS item_quantity, i.price AS item_price, i.price_num AS item_price_num
    FROM shop_orders o
    LEFT JOIN shops s ON s.user_id = o.shop_user_id
    LEFT JOIN users u ON u.id = s.user_id
    LEFT JOIN shop_order_items i ON i.order_id = o.id
    WHERE o.buyer_user_id = ?
    ORDER BY o.id DESC, i.id ASC
  `).all(buyerUserId);

  const ordersById = new Map();
  for (const row of rows) {
    let order = ordersById.get(row.id);
    if (!order) {
      order = {
        id: row.id,
        shop_user_id: row.shop_user_id,
        shop_name: row.shop_name,
        shop_avatar: row.shop_avatar || "",
        buyer_user_id: row.buyer_user_id,
        buyer_name: row.buyer_name,
        buyer_phone: row.buyer_phone,
        status: row.status,
        total: row.total,
        total_num: row.total_num,
        created_at: row.created_at,
        updated_at: row.updated_at,
        items: []
      };
      ordersById.set(row.id, order);
    }
    if (row.item_id != null) {
      order.items.push({
        id: row.item_id,
        orderId: row.id,
        productId: row.item_product_id,
        name: row.item_name,
        quantity: row.item_quantity,
        price: row.item_price,
        priceNum: row.item_price_num
      });
    }
  }
  return Array.from(ordersById.values());
}

/** Full order snapshot (with each item's current product image, for an order-card chat bubble). Live status — callers should re-fetch, never cache. */
export function getOrderById(orderId) {
  const db = getDb();
  const order = db.prepare("SELECT * FROM shop_orders WHERE id = ?").get(orderId);
  if (!order) return null;
  const items = db.prepare(`
    SELECT i.id, i.order_id AS orderId, i.product_id AS productId, i.name, i.quantity,
      i.price, i.price_num AS priceNum, p.image AS image
    FROM shop_order_items i
    LEFT JOIN shop_products p ON p.id = i.product_id
    WHERE i.order_id = ?
    ORDER BY i.id ASC
  `).all(orderId);
  return {
    id: order.id,
    shopUserId: order.shop_user_id,
    buyerUserId: order.buyer_user_id,
    status: order.status,
    total: order.total,
    totalNum: order.total_num,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items: items.map((item) => ({ ...item, image: item.image || "" }))
  };
}

function listShopReviews(shopUserId) {
  return getDb().prepare(`
    SELECT id, author_name AS name, rating, text, service, created_at
    FROM reviews WHERE target_user_id = ? ORDER BY id DESC LIMIT 50
  `).all(shopUserId);
}
