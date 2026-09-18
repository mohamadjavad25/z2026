/**
 * Real-vs-fake shop order status flow + 1-hour auto-expiry sweep
 * verification (LOCAL ONLY). Mirrors seed-booking-expiry-test.mjs /
 * seed-artist-booking-expiry-test.mjs for style — same founder-approved
 * "1-hour unacknowledged window" policy extended from bookings to
 * shop_orders (see app/lib/bookingExpirySweep.js's module docstring,
 * source 3).
 *
 * Covers:
 *  1. A real order placed by a client (POST /api/shop/orders) starts as
 *     "جدید" and decrements product stock.
 *  2. Normal status progression still works untouched: PATCH { status: "در
 *     حال آماده‌سازی" } on a REAL "جدید" order (the real shop-side
 *     changeShopOrderStatus path) actually changes the row.
 *  3. Expiry sweep: a SEPARATE "جدید" order whose created_at is already >1h
 *     in the past (env-shrunk sweep interval so the test doesn't wait a real
 *     hour) gets auto-flipped to "منقضی شده" by the next sweep pass, its
 *     stock is restocked (same as an active cancel), and the client gets a
 *     real order-card chat notification about it.
 *  4. Ownership-of-transition guarantee: the shop's own real PATCH
 *     /api/shop/orders (updateOrderStatus, guarded by SHOP_ORDER_STATUSES)
 *     correctly REJECTS an attempt to set "منقضی شده" directly — only the
 *     background sweep may ever write that status.
 *
 * DB: data/zibaban-shop-order-expiry-test.sqlite
 *
 * Usage:
 *   node scripts/seed-shop-order-expiry-test.mjs
 *   node scripts/seed-shop-order-expiry-test.mjs --cleanup
 *
 * Env: ZIBABAN_SHOP_ORDER_EXPIRY_TEST_PORT  default 3040
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-shop-order-expiry-test.sqlite");
const PORT = Number(process.env.ZIBABAN_SHOP_ORDER_EXPIRY_TEST_PORT || 3040);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "shop-order-expiry-test";

const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");
const keepServer = args.has("--keep-server");
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

if (doCleanupOnly) {
  cleanupDbFiles();
  console.log("cleaned up");
  process.exit(0);
}

function parseCookie(res) {
  const raw = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  const match = raw.join(",").match(/zibaban_session=([^;]+)/);
  return match ? match[1] : "";
}

async function api(pathname, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = `zibaban_session=${cookie}`;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await res.json().catch(() => ({}));
  return { res, payload, cookie: parseCookie(res) || cookie || "" };
}

async function waitForServer(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/shops`);
      if (res.status === 200) return true;
    } catch {
      // wait
    }
    await sleep(500);
  }
  return false;
}

function startTestServer() {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    cwd: root,
    env: {
      ...process.env,
      ZIBABAN_DB_PATH: TEST_DB,
      NEXT_DIST_DIR: ".next-shop-order-expiry-test",
      PORT: String(PORT),
      // Shrink the sweep TICK interval so the test doesn't wait the real
      // 3-minute default — the 1-hour TIMEOUT itself is proven separately by
      // backdating created_at directly, not by shrinking the timeout too.
      ZIBABAN_BOOKING_EXPIRY_SWEEP_MS: "2000"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  child.on("exit", () => {
    try {
      writeFileSync(path.join(root, "data", "zibaban-shop-order-expiry-test-server.log"), Buffer.concat(chunks));
    } catch {
      // ignore
    }
  });
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  try { child.kill("SIGTERM"); } catch { /* ignore */ }
  await sleep(700);
  if (!child.killed) {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
  }
}

async function register({ phone, type, name }) {
  return api("/api/auth/register", {
    method: "POST",
    body: { phone, password: PASSWORD, type, data: { name, area: "تهران" } }
  });
}

async function findConversationWith(cookie, peerUserId) {
  const { payload } = await api("/api/conversations", { cookie });
  const list = payload?.data?.conversations || [];
  return list.find((c) => c.peer?.id === peerUserId) || null;
}

async function main() {
  console.log("=== seed-shop-order-expiry-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) {
      process.exitCode = 1;
      return;
    }

    const shopReg = await register({ phone: "09140001201", type: "shop", name: "فروشگاه انقضا تست" });
    const shopCookie = shopReg.cookie;
    const shopUserId = shopReg.payload?.data?.user?.id || shopReg.payload?.profile?.id;
    step("register shop", shopReg.res.ok && Boolean(shopUserId), `id=${shopUserId}`);

    const clientReg = await register({ phone: "09140001202", type: "client", name: "مشتری انقضا تست" });
    const clientCookie = clientReg.cookie;
    const clientUserId = clientReg.payload?.data?.user?.id || clientReg.payload?.profile?.id;
    step("register client", clientReg.res.ok && Boolean(clientUserId), `id=${clientUserId}`);

    const productA = await api("/api/shop/me", {
      method: "POST",
      cookie: shopCookie,
      body: { name: "محصول تست A", category: "تست", price: "100,000", priceNum: 100000, stock: 10 }
    });
    step("shop product A created", productA.res.status === 201, `status=${productA.res.status}`);
    const productAId = productA.payload?.data?.product?.id;

    const productB = await api("/api/shop/me", {
      method: "POST",
      cookie: shopCookie,
      body: { name: "محصول تست B", category: "تست", price: "50,000", priceNum: 50000, stock: 10 }
    });
    step("shop product B created", productB.res.status === 201, `status=${productB.res.status}`);
    const productBId = productB.payload?.data?.product?.id;

    // ── 1+2. Real order + normal status progression ─────────────────────
    console.log("\n--- 1+2. real order + normal progression ---");
    const orderA = await api("/api/shop/orders", {
      method: "POST",
      cookie: clientCookie,
      body: { shopUserId, items: [{ productId: productAId, quantity: 2 }] }
    });
    step("client order A created as جدید", orderA.res.status === 201 && orderA.payload?.data?.order?.status === "جدید", `status=${orderA.res.status} body=${JSON.stringify(orderA.payload).slice(0, 200)}`);
    const orderAId = orderA.payload?.data?.order?.id;

    const stockAfterOrder = await api(`/api/shops/${shopUserId}`, { cookie: clientCookie });
    const productAAfterOrder = (stockAfterOrder.payload?.data?.shop?.products || []).find((p) => p.id === productAId);
    step("product A stock decremented by order quantity", productAAfterOrder?.stock === 8, `stock=${productAAfterOrder?.stock}`);

    const progress = await api("/api/shop/orders", {
      method: "PATCH",
      cookie: shopCookie,
      body: { id: orderAId, status: "در حال آماده‌سازی" }
    });
    step(
      "normal progression: PATCH status=در حال آماده‌سازی succeeds and sticks (untouched by this session's change)",
      progress.res.status === 200 && progress.payload?.data?.order?.status === "در حال آماده‌سازی",
      `status=${progress.res.status} order.status=${progress.payload?.data?.order?.status}`
    );

    // ── 3. Expiry sweep ──────────────────────────────────────────────────
    console.log("\n--- 3. expiry sweep ---");
    const orderB = await api("/api/shop/orders", {
      method: "POST",
      cookie: clientCookie,
      body: { shopUserId, items: [{ productId: productBId, quantity: 3 }] }
    });
    step("client order B created as جدید", orderB.res.status === 201, `status=${orderB.res.status}`);
    const orderBId = orderB.payload?.data?.order?.id;

    // Backdate created_at directly (>1h in the past) instead of shrinking the
    // real timeout — proves the 1-hour THRESHOLD itself, not just the sweep
    // mechanics. WAL-safe: dev server also has the file open, but SQLite
    // handles single-writer-at-a-time fine for one UPDATE.
    {
      const raw = new DatabaseSync(TEST_DB);
      raw.exec("PRAGMA busy_timeout = 5000;");
      raw.prepare("UPDATE shop_orders SET created_at = datetime('now', '-70 minutes') WHERE id = ?").run(orderBId);
      raw.close();
    }

    // Poll for the sweep (ticking every 2s per ZIBABAN_BOOKING_EXPIRY_SWEEP_MS
    // above) to flip order B to منقضی شده.
    let expiredStatus = null;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const check = new DatabaseSync(TEST_DB);
      const row = check.prepare("SELECT status FROM shop_orders WHERE id = ?").get(orderBId);
      check.close();
      expiredStatus = row?.status;
      if (expiredStatus === "منقضی شده") break;
      await sleep(1000);
    }
    step("sweep auto-expires the stale جدید order to منقضی شده", expiredStatus === "منقضی شده", `status=${expiredStatus}`);

    // Stock restocked, same as an active shop cancel would do.
    const stockAfterExpiry = await api(`/api/shops/${shopUserId}`, { cookie: clientCookie });
    const productBAfterExpiry = (stockAfterExpiry.payload?.data?.shop?.products || []).find((p) => p.id === productBId);
    step("product B stock restocked after auto-expiry (same as an active cancel)", productBAfterExpiry?.stock === 10, `stock=${productBAfterExpiry?.stock}`);

    // Real chat notification: an order card referencing orderB, showing the
    // live (expired) status, must exist in the client<->shop conversation.
    const convo = await findConversationWith(clientCookie, shopUserId);
    step("client<->shop conversation exists", Boolean(convo));
    if (convo) {
      const { payload } = await api(`/api/conversations/${convo.id}/messages`, { cookie: clientCookie });
      const msgs = payload?.data?.messages || [];
      const expiryCard = msgs.find((m) => m.attachmentType === "order" && Number(m.order?.id) === Number(orderBId) && m.order?.status === "منقضی شده");
      step("client got a real order-card chat notification with status منقضی شده", Boolean(expiryCard), JSON.stringify(expiryCard));
    }

    // ── 4. Ownership-of-transition guarantee ────────────────────────────
    console.log("\n--- 4. shop cannot set منقضی شده directly via PATCH ---");
    const orderC = await api("/api/shop/orders", {
      method: "POST",
      cookie: clientCookie,
      body: { shopUserId, items: [{ productId: productAId, quantity: 1 }] }
    });
    const orderCId = orderC.payload?.data?.order?.id;
    const directAttempt = await api("/api/shop/orders", {
      method: "PATCH",
      cookie: shopCookie,
      body: { id: orderCId, status: "منقضی شده" }
    });
    step(
      "public PATCH /api/shop/orders rejects شop setting منقضی شده directly (400, same guard as any other invalid status)",
      directAttempt.res.status === 400,
      `status=${directAttempt.res.status} body=${JSON.stringify(directAttempt.payload)}`
    );
  } catch (err) {
    step("unexpected error", false, String(err?.stack || err));
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nSHOP ORDER EXPIRY TEST: ${passed}/${total} passed`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
