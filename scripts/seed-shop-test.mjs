/**
 * Isolated shop seed + API smoke test (LOCAL ONLY).
 *
 * Uses a separate SQLite file (never data/zibaban.sqlite):
 *   data/zibaban-shop-test.sqlite
 *
 * Usage:
 *   node scripts/seed-shop-test.mjs           # seed, test, stop server, keep DB for inspection
 *   node scripts/seed-shop-test.mjs --cleanup # delete test DB (+ stop leftover server on PORT)
 *   node scripts/seed-shop-test.mjs --keep-server  # leave Next on PORT after tests
 *
 * Env:
 *   ZIBABAN_SHOP_TEST_PORT  default 3011
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal mirrors of app/features/shops/mappers (avoid Next path aliases in Node). */
function mapShopCard(shop) {
  if (!shop) return null;
  return {
    id: shop.id,
    name: shop.name || "",
    area: shop.area || "",
    category: shop.category || "ترکیبی",
    products: shop.productCount ? String(shop.productCount) : "۰"
  };
}

function mapShopProduct(product) {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name || "",
    category: product.category || "میکاپ",
    price: product.price || "",
    priceNum: Number(product.priceNum || 0),
    stock: Number(product.stock || 0),
    badge: product.badge || "",
    image: product.image || "",
    description: product.description || ""
  };
}
const TEST_DB = path.join(root, "data", "zibaban-shop-test.sqlite");
const PORT = Number(process.env.ZIBABAN_SHOP_TEST_PORT || 3011);
const BASE = `http://127.0.0.1:${PORT}`;
const PHONE = "09120001122";
const PASSWORD = "shop-test-pass";

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

/** Mirror useShopWorkspace.addToShopCart (local cart — no API). */
function addToShopCart(cart, selectedShop, product) {
  if (!selectedShop) return cart;
  const existing = cart.find((item) => item.id === product.id && item.shopName === selectedShop.name);
  if (existing) {
    return cart.map((item) => (
      item.id === product.id && item.shopName === selectedShop.name
        ? { ...item, qty: item.qty + 1 }
        : item
    ));
  }
  return [...cart, {
    id: product.id,
    product,
    qty: 1,
    priceNum: product.priceNum,
    shopName: selectedShop.name
  }];
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
  const nextBin = path.join(
    root,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next"
  );
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "-p", String(PORT)],
    {
      cwd: root,
      env: {
        ...process.env,
        ZIBABAN_DB_PATH: TEST_DB,
        NEXT_DIST_DIR: ".next-shop-test",
        PORT: String(PORT)
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true
    }
  );
  const logPath = path.join(root, "data", "zibaban-shop-test-server.log");
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
  console.log("=== shop seed / smoke (isolated DB) ===");
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
    step("start Next on isolated DB", false, `timeout — see data/zibaban-shop-test-server.log`);
    await stopServer(server);
    process.exitCode = 1;
    return;
  }
  step("start Next on isolated DB", true, `port ${PORT}, ZIBABAN_DB_PATH set`);

  let cookie = "";
  let shopId = null;

  try {
    // 1) Register shop owner via real API
    {
      const { res, payload, cookie: nextCookie } = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: PHONE,
          password: PASSWORD,
          type: "shop",
          data: {
            name: "فروشگاه تست زیبابان",
            area: "ونک",
            service: "مراقبت پوست",
            bio: "seed موقت برای تست شاپ"
          }
        }
      });
      cookie = nextCookie;
      shopId = payload?.data?.user?.id || payload?.profile?.id || null;
      step(
        "POST /api/auth/register (type=shop)",
        res.ok && Boolean(cookie) && Boolean(shopId),
        res.ok ? `userId=${shopId}, cookie=yes` : `status=${res.status} ${payload.error || ""}`
      );
      if (!res.ok || !cookie) throw new Error("register failed");
    }

    // 2) createShopProduct via real POST /api/shop/me (same as shared/api)
    const productsSpec = [
      {
        name: "سرم ویتامین C تست",
        category: "مراقبت پوست",
        price: "۱٬۲۵۰٬۰۰۰",
        priceNum: 1250000,
        stock: 12,
        badge: "جدید",
        image: "/ad-rose-velvet.png",
        description: "محصول seed شماره ۱"
      },
      {
        name: "کرم ضدآفتاب تست",
        category: "مراقبت پوست",
        price: "۸۹۰٬۰۰۰",
        priceNum: 890000,
        stock: 8,
        badge: "پرفروش",
        image: "/story-glow-serum.png",
        description: "محصول seed شماره ۲"
      },
      {
        name: "بالم لب تست",
        category: "میکاپ",
        price: "۳۲۰٬۰۰۰",
        priceNum: 320000,
        stock: 20,
        badge: "ترند",
        image: "/explore-post-makeup-nude.png",
        description: "محصول seed شماره ۳"
      }
    ];

    const createdProducts = [];
    for (const body of productsSpec) {
      const { res, payload } = await api("/api/shop/me", {
        method: "POST",
        body,
        cookie
      });
      const product = payload?.data?.product;
      const ok = res.status === 201 && product?.id;
      step(
        `POST /api/shop/me create «${body.name}»`,
        ok,
        ok ? `id=${product.id}` : `status=${res.status} ${payload.error || JSON.stringify(payload).slice(0, 120)}`
      );
      if (ok) createdProducts.push(product);
    }
    if (createdProducts.length < 2) throw new Error("not enough products created");

    // 3) GET /api/shops
    {
      const { res, payload } = await api("/api/shops");
      const shops = payload?.data?.shops || payload?.shops || [];
      const found = shops.find((s) => Number(s.id) === Number(shopId) || s.name === "فروشگاه تست زیبابان");
      step(
        "GET /api/shops shows seeded shop",
        res.ok && Boolean(found),
        res.ok ? `shops=${shops.length}, foundId=${found?.id ?? "no"}` : `status=${res.status}`
      );
    }

    // 4) GET /api/shops/:id
    let detailProducts = [];
    {
      const { res, payload } = await api(`/api/shops/${shopId}`);
      const shop = payload?.data?.shop;
      detailProducts = (shop?.products || []).map(mapShopProduct).filter(Boolean);
      step(
        "GET /api/shops/:id details + products",
        res.ok && shop && detailProducts.length >= 2,
        res.ok
          ? `name=${shop?.name}, products=${detailProducts.length}`
          : `status=${res.status} ${payload.error || ""}`
      );
    }

    // 5) Cart simulation (hook state logic — local/mock, no order API)
    {
      const selectedShop = mapShopCard({
        id: shopId,
        name: "فروشگاه تست زیبابان",
        area: "ونک",
        category: "مراقبت پوست",
        productCount: detailProducts.length
      });
      let cart = [];
      const first = detailProducts[0];
      const second = detailProducts[1] || detailProducts[0];
      cart = addToShopCart(cart, selectedShop, first);
      cart = addToShopCart(cart, selectedShop, first);
      cart = addToShopCart(cart, selectedShop, second);
      const qty = cart.reduce((sum, item) => sum + item.qty, 0);
      const lines = cart.length;
      const ok = lines >= 1 && qty >= 3;
      step(
        "cart add (useShopWorkspace-equivalent local state)",
        ok,
        `lines=${lines}, qty=${qty}, names=${cart.map((c) => `${c.product.name}×${c.qty}`).join(" | ")}`
      );
    }

    // 6) GET /api/shop/me as owner
    {
      const { res, payload } = await api("/api/shop/me", { cookie });
      const products = payload?.data?.products || [];
      const ok = res.ok && products.length >= createdProducts.length;
      step(
        "GET /api/shop/me (owner session)",
        ok,
        res.ok
          ? `products=${products.length}, orders=${(payload?.data?.orders || []).length}`
          : `status=${res.status} ${payload.error || ""}`
      );
    }
  } catch (error) {
    step("suite aborted", false, error.message || String(error));
    process.exitCode = 1;
  }

  console.log("\n--- summary ---");
  const failed = report.filter((r) => !r.ok).length;
  console.log(`passed=${report.length - failed} failed=${failed}`);
  console.log(`test DB file: ${TEST_DB}`);
  console.log("main DB untouched: data/zibaban.sqlite");
  console.log("rollback: node scripts/seed-shop-test.mjs --cleanup");

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
