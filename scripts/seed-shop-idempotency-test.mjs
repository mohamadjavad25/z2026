/**
 * Isolated shop-order idempotency test (LOCAL ONLY).
 *
 * Verifies POST /api/shop/orders dedupes a repeated (same idempotencyKey)
 * call — including two truly-parallel requests — instead of placing (and
 * stock-decrementing) the order twice, while a different key still creates
 * a genuinely separate order.
 *
 * Also runs a worker_threads + separate-DB-connection race (same pattern as
 * wallet test #7/#7d in seed-wallet-test.mjs): two Worker threads, each with
 * its OWN node:sqlite connection to the same file (set via ZIBABAN_DB_PATH
 * before importing repos/shops.js inside the worker), call createOrder()
 * directly with the SAME idempotencyKey at the same time. This is a strictly
 * stronger check than two parallel fetch() calls against one Next dev
 * server: it proves the BEGIN IMMEDIATE serialization in createOrder()
 * actually holds across genuinely independent connections/threads, not just
 * across concurrent requests handled by a single Node event loop.
 *
 * Uses a separate SQLite file (never data/zibaban.sqlite):
 *   data/zibaban-shop-idempotency-test.sqlite
 *
 * Usage:
 *   node scripts/seed-shop-idempotency-test.mjs
 *   node scripts/seed-shop-idempotency-test.mjs --cleanup
 *
 * Env:
 *   ZIBABAN_SHOP_IDEMPOTENCY_TEST_PORT  default 3012
 */
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-shop-idempotency-test.sqlite");
const PORT = Number(process.env.ZIBABAN_SHOP_IDEMPOTENCY_TEST_PORT || 3012);
const BASE = `http://127.0.0.1:${PORT}`;

const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");
const keepServer = args.has("--keep-server");

const report = [];
function step(title, ok, detail = "") {
  const line = `${ok ? "✓" : "✗"} ${title}${detail ? ` — ${detail}` : ""}`;
  report.push({ ok, title, detail, line });
  console.log(line);
}

function cleanupDbFiles() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const file = `${TEST_DB}${suffix}`;
    if (existsSync(file)) rmSync(file, { force: true });
  }
}

function parseCookie(res) {
  const raw = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  const joined = raw.join(",");
  const match = joined.match(/zibaban_session=([^;]+)/);
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
      // not up yet
    }
    await sleep(500);
  }
  return false;
}

function startTestServer() {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "-p", String(PORT)],
    {
      cwd: root,
      env: {
        ...process.env,
        ZIBABAN_DB_PATH: TEST_DB,
        NEXT_DIST_DIR: ".next-shop-idempotency-test",
        PORT: String(PORT)
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true
    }
  );
  const logPath = path.join(root, "data", "zibaban-shop-idempotency-test-server.log");
  const chunks = [];
  child.stdout.on("data", (buf) => chunks.push(buf));
  child.stderr.on("data", (buf) => chunks.push(buf));
  child.on("exit", () => {
    try {
      writeFileSync(logPath, Buffer.concat(chunks));
    } catch {
      // ignore
    }
  });
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  try {
    child.kill("SIGTERM");
  } catch {
    // ignore
  }
  await sleep(800);
  if (!child.killed) {
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
}

/**
 * Runs shops.createOrder() inside its own worker thread, with its own
 * node:sqlite connection to `dbPath` (set via ZIBABAN_DB_PATH before the
 * repo module is imported). Mirrors runWorkerWithdraw/runWorkerCredit in
 * seed-wallet-test.mjs — used to prove createOrder()'s idempotency dedupe
 * holds under genuine cross-connection concurrency, not just concurrent
 * fetches through one server process.
 */
function runWorkerCreateOrder({ dbPath, shopUserId, buyerUserId, buyerName, buyerPhone, productId, quantity, idempotencyKey }) {
  const workerSource = `
    import { parentPort, workerData } from "node:worker_threads";
    process.env.ZIBABAN_DB_PATH = workerData.dbPath;
    const shops = await import(${JSON.stringify(pathToFileURL(path.join(root, "app/lib/db/repos/shops.js")).href)});
    try {
      const order = shops.createOrder(workerData.shopUserId, {
        items: [{ productId: workerData.productId, quantity: workerData.quantity }],
        buyerUserId: workerData.buyerUserId,
        buyerName: workerData.buyerName || "",
        buyerPhone: workerData.buyerPhone || "",
        idempotencyKey: workerData.idempotencyKey || ""
      });
      parentPort.postMessage({ ok: true, order });
    } catch (error) {
      parentPort.postMessage({ ok: false, error: error?.code || "error", detail: String(error?.message || error) });
    }
  `;
  const tmp = path.join(root, "data", `shop-order-race-worker-${process.pid}-${Math.random().toString(16).slice(2)}.mjs`);
  writeFileSync(tmp, workerSource);
  return new Promise((resolve) => {
    const worker = new Worker(tmp, {
      workerData: { dbPath, shopUserId, buyerUserId, buyerName, buyerPhone, productId, quantity, idempotencyKey },
      type: "module"
    });
    worker.on("message", (msg) => {
      try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
      resolve(msg);
    });
    worker.on("error", (err) => {
      try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
      resolve({ ok: false, error: "worker_error", detail: String(err?.message || err) });
    });
  });
}

async function main() {
  console.log("=== shop order idempotency (isolated DB) ===");
  console.log(`TEST_DB: ${TEST_DB}`);
  console.log(`BASE:    ${BASE}`);
  console.log("");

  if (doCleanupOnly) {
    cleanupDbFiles();
    step("cleanup test DB files", true, TEST_DB);
    console.log("\nDone. Main DB data/zibaban.sqlite was not touched.");
    return;
  }

  cleanupDbFiles();
  step("prepare empty test DB path", true, "deleted previous test sqlite if any");

  const server = startTestServer();
  const up = await waitForServer();
  if (!up) {
    step("start Next on isolated DB", false, `timeout — see data/zibaban-shop-idempotency-test-server.log`);
    await stopServer(server);
    process.exitCode = 1;
    return;
  }
  step("start Next on isolated DB", true, `port ${PORT}, ZIBABAN_DB_PATH set`);

  try {
    // 1) Register shop owner + one product with stock=10
    const { cookie: shopCookie, payload: shopRegisterPayload } = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09120002211",
        password: "shop-idem-pass",
        type: "shop",
        data: { name: "فروشگاه ایدمپوتنسی تست", area: "ونک" }
      }
    });
    const shopId = shopRegisterPayload?.data?.user?.id || null;
    step("register shop owner", Boolean(shopCookie && shopId), `shopId=${shopId}`);

    const { res: productRes, payload: productPayload } = await api("/api/shop/me", {
      method: "POST",
      cookie: shopCookie,
      body: { name: "محصول تست ایدمپوتنسی", priceNum: 100000, stock: 10 }
    });
    const productId = productPayload?.data?.product?.id;
    step("create product (stock=10)", productRes.status === 201 && Boolean(productId), `productId=${productId}`);

    // 2) Register a buyer
    const { cookie: buyerCookie, payload: buyerRegisterPayload } = await api("/api/auth/register", {
      method: "POST",
      body: { phone: "09120002222", password: "buyer-idem-pass", type: "client", data: { name: "خریدار تست" } }
    });
    const buyerId = buyerRegisterPayload?.data?.user?.id || null;
    step("register buyer", Boolean(buyerCookie && buyerId), `buyerId=${buyerId}`);

    // 3) Two truly-parallel POSTs with the SAME idempotencyKey, qty=3 each
    const sameKey = randomUUID();
    const orderBody = (qty, key) => ({
      shopUserId: shopId,
      items: [{ productId, quantity: qty }],
      idempotencyKey: key
    });
    const [dupA, dupB] = await Promise.all([
      api("/api/shop/orders", { method: "POST", cookie: buyerCookie, body: orderBody(3, sameKey) }),
      api("/api/shop/orders", { method: "POST", cookie: buyerCookie, body: orderBody(3, sameKey) })
    ]);
    const idA = dupA.payload?.data?.order?.id;
    const idB = dupB.payload?.data?.order?.id;
    const statuses = [dupA.res.status, dupB.res.status].sort();
    step(
      "parallel duplicate POSTs (same key) return the SAME order",
      Boolean(idA) && idA === idB && statuses[0] === 200 && statuses[1] === 201,
      `idA=${idA} idB=${idB} statuses=${statuses.join(",")}`
    );

    const { payload: afterDup } = await api("/api/shop/me", { cookie: shopCookie });
    const productAfterDup = (afterDup?.data?.products || []).find((p) => p.id === productId);
    step(
      "stock decremented ONCE (10 - 3 = 7), not twice",
      Number(productAfterDup?.stock) === 7,
      `stock=${productAfterDup?.stock}`
    );

    // 4) A different idempotencyKey creates a genuinely separate order
    const { res: freshRes, payload: freshPayload } = await api("/api/shop/orders", {
      method: "POST",
      cookie: buyerCookie,
      body: orderBody(2, randomUUID())
    });
    const freshId = freshPayload?.data?.order?.id;
    step(
      "different idempotencyKey creates a new order",
      freshRes.status === 201 && Boolean(freshId) && freshId !== idA,
      `freshId=${freshId}`
    );

    const { payload: afterFresh } = await api("/api/shop/me", { cookie: shopCookie });
    const productAfterFresh = (afterFresh?.data?.products || []).find((p) => p.id === productId);
    step(
      "stock decremented again for the new order (7 - 2 = 5)",
      Number(productAfterFresh?.stock) === 5,
      `stock=${productAfterFresh?.stock}`
    );

    // 5) Real concurrency: two worker_threads, each with its OWN node:sqlite
    // connection to TEST_DB, call createOrder() directly (not through HTTP)
    // with the SAME idempotencyKey at the same time. This is what actually
    // exercises BEGIN IMMEDIATE writer-lock serialization across independent
    // connections — a Promise.all([fetch, fetch]) against one Next dev server
    // only proves the single Node event loop interleaves the two await
    // points; it doesn't prove the transaction boundary itself is race-safe
    // the way wallet test #7/#7d do for wallet.js.
    const raceDb = new DatabaseSync(TEST_DB);
    raceDb.prepare(`
      UPDATE shop_products SET stock = 20, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(productId);
    raceDb.close();

    const raceKey = `shop-order-race-${process.pid}-${Date.now()}`;
    const raceQty = 4;
    const [raceA, raceB] = await Promise.all([
      runWorkerCreateOrder({
        dbPath: TEST_DB, shopUserId: shopId, buyerUserId: buyerId,
        buyerName: "خریدار تست (race)", buyerPhone: "09120002222",
        productId, quantity: raceQty, idempotencyKey: raceKey
      }),
      runWorkerCreateOrder({
        dbPath: TEST_DB, shopUserId: shopId, buyerUserId: buyerId,
        buyerName: "خریدار تست (race)", buyerPhone: "09120002222",
        productId, quantity: raceQty, idempotencyKey: raceKey
      })
    ]);
    const raceIdA = raceA?.order?.id;
    const raceIdB = raceB?.order?.id;
    step(
      "5. worker_threads race (separate DB connections, SAME idempotencyKey) → both callers get the SAME order",
      Boolean(raceA?.ok) && Boolean(raceB?.ok) && Boolean(raceIdA) && raceIdA === raceIdB,
      `okA=${raceA?.ok} okB=${raceB?.ok} idA=${raceIdA} idB=${raceIdB} errA=${raceA?.error || ""} errB=${raceB?.error || ""}`
    );

    const raceCheckDb = new DatabaseSync(TEST_DB);
    const raceStock = Number(
      raceCheckDb.prepare("SELECT stock FROM shop_products WHERE id = ?").get(productId)?.stock ?? -1
    );
    const raceKeyRows = Number(
      raceCheckDb.prepare(
        "SELECT COUNT(*) AS n FROM shop_order_idempotency_keys WHERE buyer_user_id = ? AND key = ?"
      ).get(buyerId, raceKey)?.n || 0
    );
    const raceOrderRows = Number(
      raceCheckDb.prepare("SELECT COUNT(*) AS n FROM shop_orders WHERE id = ?").get(raceIdA)?.n || 0
    );
    raceCheckDb.close();
    step(
      "5b. stock decremented exactly once under real concurrency (20 - 4 = 16)",
      raceStock === 20 - raceQty,
      `stock=${raceStock} expected=${20 - raceQty}`
    );
    step(
      "5c. exactly one shop_order_idempotency_keys row and one shop_orders row for the race key",
      raceKeyRows === 1 && raceOrderRows === 1,
      `idemKeyRows=${raceKeyRows} orderRows=${raceOrderRows}`
    );
  } catch (error) {
    step("suite aborted", false, error.message || String(error));
    process.exitCode = 1;
  }

  console.log("\n--- summary ---");
  const failed = report.filter((r) => !r.ok).length;
  console.log(`passed=${report.length - failed} failed=${failed}`);
  console.log(`test DB file: ${TEST_DB}`);
  console.log("main DB untouched: data/zibaban.sqlite");
  console.log("rollback: node scripts/seed-shop-idempotency-test.mjs --cleanup");

  if (!keepServer) {
    await stopServer(server);
    step("stop test server", true, `port ${PORT}`);
  } else {
    console.log(`\nserver left running on ${BASE} (ZIBABAN_DB_PATH=${TEST_DB})`);
  }

  if (failed) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
