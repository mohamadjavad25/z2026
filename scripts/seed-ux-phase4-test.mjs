/**
 * UX phase 4 (M2–M13) — LOCAL ONLY.
 *
 * DB: data/zibaban-ux-phase4-test.sqlite
 *
 * Covers:
 * - M7: follow fail → rollback + error toast (client mirror + live API)
 * - M8: real shop order row in DB + stock fail path
 * - M13: auth busy gate (double submit → one run)
 * - Structural: M2/M5/M6/M9/M10/M11/M12 empty+CSS markers
 *
 * Usage:
 *   node scripts/seed-ux-phase4-test.mjs
 *   node scripts/seed-ux-phase4-test.mjs --cleanup
 *
 * Env: ZIBABAN_UX_PHASE4_TEST_PORT  default 3038
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-ux-phase4-test.sqlite");
const PORT = Number(process.env.ZIBABAN_UX_PHASE4_TEST_PORT || 3038);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "ux-phase4-test";

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

function read(rel) {
  return readFileSync(path.join(root, rel), "utf8");
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
  return { res, payload, cookie: parseCookie(res) || cookie || "", ok: res.ok, status: res.status };
}

async function waitForServer(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/salons`);
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
      NEXT_DIST_DIR: ".next-ux-phase4-test",
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  child.on("exit", () => {
    try {
      writeFileSync(path.join(root, "data", "zibaban-ux-phase4-test-server.log"), Buffer.concat(chunks));
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

async function main() {
  console.log("=== seed-ux-phase4-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  if (doCleanupOnly) {
    cleanupDbFiles();
    for (const f of [
      path.join(root, "data", "zibaban-ux-phase4-test-report.json"),
      path.join(root, "data", "zibaban-ux-phase4-test-server.log")
    ]) {
      if (existsSync(f)) rmSync(f, { force: true });
    }
    console.log("cleaned ux-phase4 test db/report");
    return;
  }

  const { notifyFromResponse } = await import(
    pathToFileURL(path.join(root, "app", "shared", "lib", "apiNotify.js")).href
  );
  const { createBusyGate } = await import(
    pathToFileURL(path.join(root, "app", "shared", "lib", "busyGate.js")).href
  );

  // --- structural ---
  console.log("\n--- structural M2/M5/M6/M9–M12 ---");
  {
    const ownerChat = read("app/features/profile/OwnerChatSheet.jsx");
    step("M2 OwnerChatSheet inbox empty", ownerChat.includes("هنوز گفتگویی نیست") && ownerChat.includes("chatInboxEmpty"));
    step("M2 OwnerChatSheet thread empty", ownerChat.includes("گفتگو را شروع کن") && ownerChat.includes("chatThreadEmpty"));
    const chatPage = read("app/features/shell/ChatPage.jsx");
    step("M2 ChatPage inbox empty", chatPage.includes("هنوز گفتگویی نیست") && chatPage.includes("chatInboxEmpty"));
    step("M2 ChatPage thread empty", chatPage.includes("هنوز پیامی در این گفتگو نیست") && chatPage.includes("chatThreadEmpty"));
  }
  {
    const clientCss = read("app/styles/features/client.css");
    step("M5 client.css has @media 760", /@media\s*\(\s*max-width:\s*760px\s*\)/.test(clientCss));
    step("M5 clientBookingMore ≥44 on mobile", /clientBookingMore[\s\S]{0,120}min-height:\s*44px/.test(clientCss));
  }
  {
    const scheduleCss = read("app/styles/features/schedule.css");
    const mobileBlock = scheduleCss.match(/@media\s*\(\s*max-width:\s*760px\s*\)\s*\{[\s\S]*$/)?.[0] || "";
    step("M6 requestActions mobile ≥44", /\.requestActions button\{[\s\S]*?min-height:\s*44px/.test(mobileBlock));
    step("M6 no shrink to 26px", !/min-height:\s*26px/.test(mobileBlock));
  }
  {
    const services = read("app/features/artist/PublicArtistServicesPanel.jsx");
    step("M9 public services empty", services.includes("هنوز خدمتی ثبت نشده") && services.includes("artistPublicServiceEmpty"));
  }
  {
    const artistCss = read("app/styles/features/artist.css");
    step(
      "M10 collab form stacks",
      artistCss.includes("@media (max-width: 760px)")
        && /artistCollabForm[\s\S]{0,80}grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(artistCss)
    );
    step(
      "M10 mini grid collapses",
      /artistCollabMiniGrid[\s\S]{0,80}grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(artistCss)
    );
  }
  {
    const shopsCss = read("app/styles/features/shops.css");
    step(
      "M11 insights/form → 1 col",
      shopsCss.includes("@media (max-width: 720px)")
        && shopsCss.includes(".shopProductFormRow")
        && /shopInsightsGrid[\s\S]{0,120}minmax\(0,\s*1fr\)/.test(shopsCss)
    );
  }
  {
    const walletPage = read("app/features/wallet/WalletPage.jsx");
    const walletCss = read("app/styles/features/wallet.css");
    step("M12 wallet empty state", walletPage.includes("walletEmptyState") && walletPage.includes("هنوز تراکنشی ثبت نشده"));
    step("M12 quick amounts ≥44", /\.walletQuickAmounts button\{[\s\S]*?min-height:\s*44px/.test(walletCss));
  }
  {
    const authSession = read("app/features/auth/useAuthSession.js");
    const authForms = read("app/features/auth/AuthGateForms.jsx");
    step("M13 authBusy in session", authSession.includes("authBusy") && authSession.includes("authBusyRef"));
    step("M13 submit disabled when busy", authForms.includes("disabled={authBusy}") && authForms.includes("authBusy"));
  }
  {
    const shopHook = read("app/features/shops/useShopWorkspace.js");
    step("M8 submitShopOrder calls createShopOrder", shopHook.includes("createShopOrder") && !shopHook.includes("LOCAL/MOCK: does not call POST /api/shop/orders"));
    step("M7 follow uses notifyFromResponse", read("app/features/salons/useSalonDirectory.js").includes("notifyFromResponse"));
  }

  // --- M7 unit rollback ---
  console.log("\n--- M7 follow rollback unit ---");
  {
    const toasts = [];
    const notify = (msg) => toasts.push(msg);
    let followed = ["10"];
    const followKey = "10";
    const previousFollowed = followed.includes(followKey);
    followed = previousFollowed
      ? followed.filter((item) => item !== followKey)
      : [...followed, followKey];
    step("M7 optimistic unfollow applied", !followed.includes(followKey));

    const fail = { ok: false, payload: { error: "ورود لازم است." } };
    if (!notifyFromResponse(notify, fail, { failure: "ذخیره فالو انجام نشد؛ دوباره امتحان کن." })) {
      followed = previousFollowed
        ? (followed.includes(followKey) ? followed : [...followed, followKey])
        : followed.filter((item) => item !== followKey);
    }
    step("M7 rollback restores follow", followed.includes(followKey), `followed=${JSON.stringify(followed)}`);
    step("M7 error toast shown", toasts[0] === "ورود لازم است.", `toasts=${JSON.stringify(toasts)}`);
  }

  // --- M13 busy unit ---
  console.log("\n--- M13 auth busy unit ---");
  {
    const gate = createBusyGate();
    let runs = 0;
    const slowLogin = () => new Promise((resolve) => {
      runs += 1;
      setTimeout(resolve, 60);
    });
    const [a, b] = await Promise.all([gate.run(slowLogin), gate.run(slowLogin)]);
    step("M13 parallel login → one run", a.ok && b.skipped && runs === 1, `runs=${runs}`);
    step("M13 busy cleared", gate.isBusy() === false);
  }

  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) {
      process.exitCode = 1;
      return;
    }

    // M7 live: invalid salon id while authed
    console.log("\n--- M7 live follow fail ---");
    const clientReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09136004101",
        password: PASSWORD,
        type: "client",
        data: { name: "مشتری فاز۴", area: "تهران" }
      }
    });
    const clientCookie = clientReg.cookie;
    step("register client", clientReg.ok && Boolean(clientCookie));

    const followFail = await api("/api/salon-follow", {
      method: "POST",
      cookie: clientCookie,
      body: { salonUserId: 0, follow: true }
    });
    step(
      "M7 live invalid salon → error payload",
      !followFail.ok && Boolean(followFail.payload?.error),
      followFail.payload?.error || `status=${followFail.status}`
    );

    // Mirror client: fail → toast + rollback
    {
      const toasts = [];
      let followed = [];
      const followKey = "999999";
      const previous = followed.includes(followKey);
      followed = [...followed, followKey];
      const rolled = notifyFromResponse((m) => toasts.push(m), followFail, {
        failure: "ذخیره فالو انجام نشد؛ دوباره امتحان کن."
      });
      if (!rolled) {
        followed = previous ? followed : followed.filter((x) => x !== followKey);
      }
      step("M7 live result drives rollback", !followed.includes(followKey) && toasts.length === 1);
    }

    // M8 real order
    console.log("\n--- M8 shop order ---");
    const shopReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09136004102",
        password: PASSWORD,
        type: "shop",
        data: { name: "فروشگاه فاز۴", area: "ونک", service: "مراقبت پوست" }
      }
    });
    const shopCookie = shopReg.cookie;
    const shopId = shopReg.payload?.data?.user?.id || shopReg.payload?.profile?.id;
    step("register shop", shopReg.ok && Boolean(shopId), `id=${shopId}`);

    const product = await api("/api/shop/me", {
      method: "POST",
      cookie: shopCookie,
      body: {
        name: "سرم فاز۴",
        category: "مراقبت پوست",
        price: "۵۰۰٬۰۰۰",
        priceNum: 500000,
        stock: 2,
        badge: "جدید",
        image: "/ad-rose-velvet.png",
        description: "phase4 product"
      }
    });
    const productId = product.payload?.data?.product?.id;
    step("create product stock=2", product.ok && Boolean(productId), `id=${productId}`);

    const orderOk = await api("/api/shop/orders", {
      method: "POST",
      cookie: clientCookie,
      body: {
        shopUserId: shopId,
        items: [{ productId, name: "سرم فاز۴", quantity: 1, price: "۵۰۰٬۰۰۰", priceNum: 500000 }],
        total: "۵۰۰٬۰۰۰",
        totalNum: 500000,
        buyerName: "مشتری فاز۴"
      }
    });
    const orderId = orderOk.payload?.data?.order?.id;
    step("M8 order created", orderOk.ok && Boolean(orderId), `orderId=${orderId} status=${orderOk.status}`);

    const shopMe = await api("/api/shop/me", { cookie: shopCookie });
    const orders = shopMe.payload?.data?.orders || [];
    step(
      "M8 order row visible to shop",
      orders.some((row) => Number(row.id) === Number(orderId)),
      `orders=${orders.length}`
    );

    const stockFail = await api("/api/shop/orders", {
      method: "POST",
      cookie: clientCookie,
      body: {
        shopUserId: shopId,
        items: [{ productId, name: "سرم فاز۴", quantity: 99, price: "۵۰۰٬۰۰۰", priceNum: 500000 }],
        total: "۴۹٬۵۰۰٬۰۰۰",
        totalNum: 49500000
      }
    });
    step(
      "M8 stock fail returns error",
      !stockFail.ok && String(stockFail.payload?.error || "").includes("موجودی"),
      stockFail.payload?.error || `status=${stockFail.status}`
    );

    const invalidShop = await api("/api/shop/orders", {
      method: "POST",
      cookie: clientCookie,
      body: { shopUserId: 0, items: [] }
    });
    step("M8 invalid shop fail", !invalidShop.ok, invalidShop.payload?.error || "");

    // M13 live: double login with busy gate wrapper
    console.log("\n--- M13 live login busy ---");
    let loginHits = 0;
    const gate = createBusyGate();
    const doLogin = () => gate.run(async () => {
      loginHits += 1;
      return api("/api/auth/login", {
        method: "POST",
        body: { phone: "09136004101", password: PASSWORD }
      });
    });
    const [first, second] = await Promise.all([doLogin(), doLogin()]);
    step("M13 double login → one API hit", loginHits === 1 && first.ok && second.skipped, `hits=${loginHits}`);
    step("M13 login succeeded once", first.value?.ok === true);
  } catch (error) {
    step("unexpected abort", false, String(error?.message || error));
    process.exitCode = 1;
  } finally {
    if (!keepServer) {
      await stopServer(child);
      cleanupDbFiles();
      console.log("cleanup done");
    }
  }

  const failed = report.filter((item) => !item.ok);
  writeFileSync(
    path.join(root, "data", "zibaban-ux-phase4-test-report.json"),
    JSON.stringify({
      at: new Date().toISOString(),
      passed: report.length - failed.length,
      failed: failed.length,
      total: report.length,
      lines: report.map((item) => item.line)
    }, null, 2)
  );

  console.log("");
  console.log(`Summary: ${report.length - failed.length}/${report.length} passed`);
  if (failed.length) {
    console.log("Failed:");
    for (const item of failed) console.log(`  - ${item.title}${item.detail ? `: ${item.detail}` : ""}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
