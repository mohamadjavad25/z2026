/**
 * Isolated shop-order idempotency test (LOCAL ONLY).
 *
 * Verifies POST /api/shop/orders dedupes a repeated (same idempotencyKey)
 * call — including two truly-parallel requests — instead of placing (and
 * stock-decrementing) the order twice, while a different key still creates
 * a genuinely separate order.
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
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
    const { cookie: buyerCookie } = await api("/api/auth/register", {
      method: "POST",
      body: { phone: "09120002222", password: "buyer-idem-pass", type: "client", data: { name: "خریدار تست" } }
    });
    step("register buyer", Boolean(buyerCookie));

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
