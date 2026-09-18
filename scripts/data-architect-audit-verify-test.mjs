/**
 * Verification for the data-layer fixes from the full-team audit pass
 * (2026-09-18). Direct DB/repo-level checks, no HTTP server needed since
 * none of these touch route logic.
 *
 * Covers:
 *  1. Fresh install (schema_version 0 -> applySchema-only path) gets
 *     idx_salon_bookings_day — previously only created by the v12 migration
 *     step, which a brand-new DB never runs.
 *  2. deleteProduct() no longer refuses to delete a product whose only
 *     order history is an auto-expired ("منقضی شده") order — that status is
 *     resolved (already restocked via expire_restock) same as
 *     cancel/return, so it must not count as "active".
 *  3. The public "sold" count (PRODUCT_SELECT) excludes cancelled/returned/
 *     expired order quantities, matching the just-fixed shop revenue logic
 *     (ShopInsightsPanel/ShopProductsOverview).
 *
 * DB: data/zibaban-data-architect-audit-verify-test.sqlite
 *
 * Usage:
 *   node scripts/data-architect-audit-verify-test.mjs
 *   node scripts/data-architect-audit-verify-test.mjs --cleanup
 */
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-data-architect-audit-verify-test.sqlite");

const args = new Set(process.argv.slice(2));
const report = [];

function step(title, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${title}${detail ? ` — ${detail}` : ""}`;
  report.push({ ok, title, detail, line });
  console.log(line);
}

function cleanupDbFiles() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${TEST_DB}${suffix}`;
    if (existsSync(file)) rmSync(file, { force: true });
  }
}

if (args.has("--cleanup")) {
  cleanupDbFiles();
  console.log("cleaned up");
  process.exit(0);
}

cleanupDbFiles();

async function main() {
  // --- Check 1: fresh install gets idx_salon_bookings_day ------------------
  {
    const { ensureSchemaVersion } = await import("../app/lib/db/migrations.js");
    const fresh = new DatabaseSync(":memory:");
    fresh.exec("PRAGMA foreign_keys = ON;");
    ensureSchemaVersion(fresh); // current === 0 path -> applySchema only, no migration steps
    const idx = fresh.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_salon_bookings_day'
    `).get();
    step("fresh install creates idx_salon_bookings_day", Boolean(idx));
    fresh.close();
  }

  // --- Checks 2 & 3: repo-level, against an isolated file DB ---------------
  process.env.ZIBABAN_DB_PATH = TEST_DB;
  const { getDb } = await import("../app/lib/db/connection.js");
  const shops = await import("../app/lib/db/repos/shops.js");
  const db = getDb();

  function makeUser(type, phone, name) {
    const info = db.prepare(`
      INSERT INTO users (phone, password_hash, type, name) VALUES (?, 'x', ?, ?)
    `).run(phone, type, name);
    return Number(info.lastInsertRowid);
  }

  const shopUserId = makeUser("shop", "09120000001", "فروشگاه تست");
  const buyerUserId = makeUser("client", "09120000002", "مشتری تست");

  const product = shops.addProduct(shopUserId, {
    name: "محصول تست", category: "تست", price: "۱۰۰,۰۰۰", priceNum: 100000, stock: 50
  });

  // Order A: will be marked "منقضی شده" directly (mirrors expireStaleOrder's
  // end state without needing the sweep/HTTP layer).
  const orderAId = Number(db.prepare(`
    INSERT INTO shop_orders (shop_user_id, buyer_user_id, buyer_name, buyer_phone, status, total, total_num)
    VALUES (?, ?, 'مشتری تست', '09120000002', 'جدید', '۲۰۰,۰۰۰', 200000)
  `).run(shopUserId, buyerUserId).lastInsertRowid);
  db.prepare(`
    INSERT INTO shop_order_items (order_id, product_id, name, quantity, price, price_num)
    VALUES (?, ?, 'محصول تست', 2, '۲۰۰,۰۰۰', 200000)
  `).run(orderAId, product.id);
  db.prepare(`UPDATE shop_orders SET status = 'منقضی شده' WHERE id = ?`).run(orderAId);

  // Order B: a real delivered order — should count toward "sold" and must
  // NOT block deletion (it's also resolved/terminal).
  const orderBId = Number(db.prepare(`
    INSERT INTO shop_orders (shop_user_id, buyer_user_id, buyer_name, buyer_phone, status, total, total_num)
    VALUES (?, ?, 'مشتری تست', '09120000002', 'تحویل شد', '۳۰۰,۰۰۰', 300000)
  `).run(shopUserId, buyerUserId).lastInsertRowid);
  db.prepare(`
    INSERT INTO shop_order_items (order_id, product_id, name, quantity, price, price_num)
    VALUES (?, ?, 'محصول تست', 3, '۳۰۰,۰۰۰', 300000)
  `).run(orderBId, product.id);

  // Order C: still genuinely active ("جدید") — SHOULD block deletion.
  const productForActive = shops.addProduct(shopUserId, {
    name: "محصول فعال", category: "تست", price: "۱۰۰,۰۰۰", priceNum: 100000, stock: 10
  });
  const orderCId = Number(db.prepare(`
    INSERT INTO shop_orders (shop_user_id, buyer_user_id, buyer_name, buyer_phone, status, total, total_num)
    VALUES (?, ?, 'مشتری تست', '09120000002', 'جدید', '۱۰۰,۰۰۰', 100000)
  `).run(shopUserId, buyerUserId).lastInsertRowid);
  db.prepare(`
    INSERT INTO shop_order_items (order_id, product_id, name, quantity, price, price_num)
    VALUES (?, ?, 'محصول فعال', 1, '۱۰۰,۰۰۰', 100000)
  `).run(orderCId, productForActive.id);

  // Check 3: "sold" excludes the expired order's 2 units, counts the
  // delivered order's 3 units -> sold === 3, not 5.
  const listed = shops.listProducts(shopUserId).find((p) => p.id === product.id);
  step(
    "sold count excludes expired-order quantity, counts delivered-order quantity",
    listed?.sold === 3,
    `sold=${listed?.sold}`
  );

  // Check 2a: product whose only orders are expired+delivered (both
  // resolved/terminal) CAN now be deleted.
  let deletedOk = false;
  let deleteError = null;
  try {
    deletedOk = shops.deleteProduct(product.id, shopUserId);
  } catch (error) {
    deleteError = error;
  }
  step(
    "deleteProduct succeeds when only orders are resolved (expired + delivered)",
    deletedOk === true && !deleteError,
    deleteError ? `threw ${deleteError.code || deleteError.message}` : `deleted=${deletedOk}`
  );

  // Check 2b: product with a genuinely active ("جدید") order is still
  // correctly refused (regression guard on the fix).
  let blockedCorrectly = false;
  try {
    shops.deleteProduct(productForActive.id, shopUserId);
  } catch (error) {
    blockedCorrectly = error?.code === "has_active_orders";
  }
  step(
    "deleteProduct still refuses a product with a genuinely active order",
    blockedCorrectly
  );

  const failed = report.filter((r) => !r.ok);
  console.log(`\n${report.length - failed.length}/${report.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
// Not cleaning up automatically: node:sqlite (WAL mode) holds the file open
// for the life of this process, and Windows refuses to delete an
// open/locked file. Run with --cleanup afterwards (or just re-run — the
// script starts by wiping any leftover file itself).
