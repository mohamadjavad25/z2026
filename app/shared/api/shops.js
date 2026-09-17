import { apiFetch, apiJson } from "./client";

/** GET /api/shops → { data: { shops }, shops } */
export async function getShops() {
  return apiJson("/api/shops");
}

/** GET /api/shops/:id → { data: { shop } } */
export async function getShop(id) {
  return apiJson(`/api/shops/${id}`);
}

/** GET /api/shop/me → { data: { products, orders } } (shop role required) */
export async function getShopMe() {
  return apiJson("/api/shop/me");
}

/** POST /api/shop/me → create product → { data: { product } } */
export async function createShopProduct(body) {
  return apiFetch("/api/shop/me", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** PATCH /api/shop/me → update product → { data: { product } } */
export async function updateShopProduct(body) {
  return apiFetch("/api/shop/me", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/** DELETE /api/shop/me → { data: { ok: true } } */
export async function deleteShopProduct(id) {
  return apiFetch("/api/shop/me", {
    method: "DELETE",
    body: JSON.stringify({ id })
  });
}

/**
 * POST /api/shop/orders → { data: { order } }
 * Body: { shopUserId|shopId, items?, total?, totalNum?, idempotencyKey?, ... }
 * Rejects when item quantity exceeds product stock. Pass a fresh
 * idempotencyKey (e.g. crypto.randomUUID()) per checkout attempt so a
 * retried/duplicated call returns the original order instead of placing a
 * second one.
 */
export async function createShopOrder(body) {
  return apiFetch("/api/shop/orders", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/**
 * PATCH /api/shop/orders → { data: { order } } (shop role required, ownership-checked)
 * Body: { id, status } — status must be one of SHOP_ORDER_STATUSES.
 */
export async function updateShopOrderStatus(id, status) {
  return apiFetch("/api/shop/orders", {
    method: "PATCH",
    body: JSON.stringify({ id, status })
  });
}

/** GET /api/shop/categories → { data: { categories } } (shop role required) */
export async function getShopCategories() {
  return apiJson("/api/shop/categories");
}

/** POST /api/shop/categories → { data: { category } } */
export async function createShopCategory(name) {
  return apiFetch("/api/shop/categories", {
    method: "POST",
    body: JSON.stringify({ name })
  });
}

/** PATCH /api/shop/categories → { data: { category } } — rename */
export async function renameShopCategory(id, name) {
  return apiFetch("/api/shop/categories", {
    method: "PATCH",
    body: JSON.stringify({ id, name })
  });
}

/** PATCH /api/shop/categories → { data: { categories } } — one-step reorder */
export async function moveShopCategory(id, direction) {
  return apiFetch("/api/shop/categories", {
    method: "PATCH",
    body: JSON.stringify({ id, direction })
  });
}

/** DELETE /api/shop/categories → { data: { ok: true } } (fails with 409 if the category still has products) */
export async function deleteShopCategory(id) {
  return apiFetch("/api/shop/categories", {
    method: "DELETE",
    body: JSON.stringify({ id })
  });
}

/** GET /api/shop/promo-card → { data: { cards } } — the shop's whole card library (shop role required) */
export async function getShopPromoCards() {
  return apiJson("/api/shop/promo-card");
}

/** POST /api/shop/promo-card → { data: { card } } — adds a new card to the library */
export async function createShopPromoCard(body) {
  return apiFetch("/api/shop/promo-card", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** PATCH /api/shop/promo-card → { data: { cards } } — makes one card the shop's active (shown) card */
export async function activateShopPromoCard(id) {
  return apiFetch("/api/shop/promo-card", {
    method: "PATCH",
    body: JSON.stringify({ id, active: true })
  });
}

/** DELETE /api/shop/promo-card → { data: { ok: true } } */
export async function deleteShopPromoCard(id) {
  return apiFetch("/api/shop/promo-card", {
    method: "DELETE",
    body: JSON.stringify({ id })
  });
}
