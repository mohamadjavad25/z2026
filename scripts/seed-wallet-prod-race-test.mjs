/**
 * Wallet complementary hard-close tests (LOCAL ONLY).
 *
 * 1) Production smoke: next build + next start + demo_credit → 403
 * 2) Multi-process race: 2× next start on different ports, same isolated DB,
 *    concurrent requestWithdraw (10× 100k on 500k balance)
 *
 * DB: data/zibaban-wallet-prod-race-test.sqlite (never zibaban.sqlite)
 * Dist: .next-wallet-prod-test
 *
 * Usage:
 *   node scripts/seed-wallet-prod-race-test.mjs
 *   node scripts/seed-wallet-prod-race-test.mjs --cleanup
 *   node scripts/seed-wallet-prod-race-test.mjs --skip-build   # reuse existing build
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-wallet-prod-race-test.sqlite");
const DIST = ".next-wallet-prod-test";
const PORT_A = Number(process.env.ZIBABAN_WALLET_PROD_PORT_A || 3031);
const PORT_B = Number(process.env.ZIBABAN_WALLET_PROD_PORT_B || 3032);
const PASSWORD = "wallet-prod-race-pass1";
const PHONE = "09003334455";
const ADMIN_TOKEN = process.env.ZIBABAN_WALLET_ADMIN_TOKEN || "wallet-admin-test-token";

const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");
const skipBuild = args.has("--skip-build");
const report = [];
const children = [];

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

async function api(base, pathname, { method = "GET", body, cookie } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = `zibaban_session=${cookie}`;
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await res.json().catch(() => ({}));
  return { res, payload, cookie: parseCookie(res) || cookie || "" };
}

async function waitForServer(base, timeoutMs = 120_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/salons`);
      if (res.status === 200 || res.status === 401 || res.status === 403) return true;
      // Some builds may 404 until ready; keep waiting on connection refused only
      if (res.status > 0) return true;
    } catch {
      // wait
    }
    await sleep(600);
  }
  return false;
}

function startProdServer(port, logName) {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      ZIBABAN_DB_PATH: TEST_DB,
      ZIBABAN_WALLET_ADMIN_TOKEN: ADMIN_TOKEN,
      NEXT_DIST_DIR: DIST,
      PORT: String(port)
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  child.on("exit", () => {
    try {
      writeFileSync(path.join(root, "data", logName), Buffer.concat(chunks));
    } catch {
      // ignore
    }
  });
  children.push(child);
  return child;
}

async function stopAll() {
  for (const child of children) {
    if (!child || child.killed) continue;
    try { child.kill("SIGTERM"); } catch { /* ignore */ }
  }
  await sleep(900);
  for (const child of children) {
    if (!child || child.killed) continue;
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
  }
  children.length = 0;
}

function runBuild() {
  return new Promise((resolve) => {
    const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
    console.log(`Building with NEXT_DIST_DIR=${DIST} …`);
    const child = spawn(process.execPath, [nextBin, "build"], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_DIST_DIR: DIST,
        // Build should not touch main DB; point at isolated path anyway.
        ZIBABAN_DB_PATH: TEST_DB
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const chunks = [];
    child.stdout.on("data", (b) => {
      chunks.push(b);
      process.stdout.write(b);
    });
    child.stderr.on("data", (b) => {
      chunks.push(b);
      process.stderr.write(b);
    });
    child.on("exit", (code) => {
      try {
        writeFileSync(path.join(root, "data", "zibaban-wallet-prod-build.log"), Buffer.concat(chunks));
      } catch {
        // ignore
      }
      resolve(code === 0);
    });
  });
}

function readAvailable(userId) {
  const db = new DatabaseSync(TEST_DB);
  try {
    db.exec("PRAGMA busy_timeout = 5000;");
    const row = db.prepare("SELECT available_balance FROM wallets WHERE user_id = ?").get(userId);
    return Number(row?.available_balance || 0);
  } finally {
    db.close();
  }
}

function setAvailable(userId, amount) {
  const db = new DatabaseSync(TEST_DB);
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    db.prepare(`
      UPDATE wallets
      SET available_balance = ?, pending_balance = 0, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(amount, userId);
  } finally {
    db.close();
  }
}

async function main() {
  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("Cleaned wallet prod/race test DB files.");
    return;
  }

  cleanupDbFiles();
  let failed = false;

  try {
    // ---------- Build ----------
    if (!skipBuild) {
      const built = await runBuild();
      step("next build (production, isolated dist)", built, DIST);
      if (!built) throw new Error("next build failed");
    } else {
      step("skip build", existsSync(path.join(root, DIST)), DIST);
      if (!existsSync(path.join(root, DIST))) throw new Error("no build and --skip-build set");
    }

    // ---------- 1) Production demo_credit smoke ----------
    const baseA = `http://127.0.0.1:${PORT_A}`;
    startProdServer(PORT_A, "zibaban-wallet-prod-a.log");
    const upA = await waitForServer(baseA);
    step("prod server A up", upA, baseA);
    if (!upA) throw new Error("prod server A failed");

    const reg = await api(baseA, "/api/auth/register", {
      method: "POST",
      body: {
        type: "shop",
        phone: PHONE,
        password: PASSWORD,
        data: {
          name: "Wallet Prod Race Shop",
          area: "تهران",
          service: "مراقبت پوست",
          email: "wallet-prod@test.local"
        }
      }
    });
    let cookie = reg.cookie;
    step("register on prod A", reg.res.status === 200 || reg.res.status === 201, `status=${reg.res.status}`);
    if (!cookie) {
      const login = await api(baseA, "/api/auth/login", {
        method: "POST",
        body: { phone: PHONE, password: PASSWORD }
      });
      cookie = login.cookie;
      step("login fallback", Boolean(cookie), `status=${login.res.status}`);
    }

    const me = await api(baseA, "/api/auth/me", { cookie });
    const userId = me.payload?.user?.id || me.payload?.data?.user?.id || me.payload?.profile?.id;
    step("user id", Boolean(userId), `userId=${userId}`);

    const demo = await api(baseA, "/api/wallet", {
      method: "POST",
      cookie,
      body: { kind: "demo_credit", amount: 100_000, asPending: false, feePercent: 90 }
    });
    step(
      "1. PRODUCTION demo_credit → 403",
      demo.res.status === 403,
      `status=${demo.res.status} error=${demo.payload.error || ""}`
    );

    // Bank for race setup (allowed in production for shop)
    const bank = await api(baseA, "/api/wallet", {
      method: "POST",
      cookie,
      body: {
        kind: "bank",
        sheba: "IR120170000000123456789001",
        holderName: "تست پروداکشن"
      }
    });
    step("bank save on prod", bank.res.status === 200, `status=${bank.res.status}`);

    // Seed balance via SQL (demo_credit blocked in prod — intentional)
    setAvailable(userId, 500_000);
    step("SQL seed available=500000", readAvailable(userId) === 500_000, `available=${readAvailable(userId)}`);

    // ---------- 2) Multi-process race ----------
    const baseB = `http://127.0.0.1:${PORT_B}`;
    startProdServer(PORT_B, "zibaban-wallet-prod-b.log");
    const upB = await waitForServer(baseB);
    step("prod server B up (same DB)", upB, baseB);
    if (!upB) throw new Error("prod server B failed");

    // Sanity: session cookie from A works on B (shared DB sessions)
    const meB = await api(baseB, "/api/auth/me", { cookie });
    step(
      "session shared across processes",
      meB.res.status === 200,
      `status=${meB.res.status}`
    );

    const withdrawAmount = 100_000;
    const jobs = [];
    for (let i = 0; i < 5; i += 1) {
      jobs.push(
        api(baseA, "/api/wallet", {
          method: "POST",
          cookie,
          body: { kind: "withdraw", amount: withdrawAmount, note: `mp-A-${i}` }
        })
      );
      jobs.push(
        api(baseB, "/api/wallet", {
          method: "POST",
          cookie,
          body: { kind: "withdraw", amount: withdrawAmount, note: `mp-B-${i}` }
        })
      );
    }

    const results = await Promise.all(jobs);
    const ok = results.filter((r) => r.res.status === 200).length;
    const fail = results.filter((r) => r.res.status !== 200).length;
    const insufficient = results.filter(
      (r) => r.res.status === 400 && String(r.payload.error || "").includes("موجودی")
    ).length;
    const fromA = results.filter((_, i) => i % 2 === 0);
    const fromB = results.filter((_, i) => i % 2 === 1);
    const okA = fromA.filter((r) => r.res.status === 200).length;
    const okB = fromB.filter((r) => r.res.status === 200).length;
    const finalAvailable = readAvailable(userId);

    step(
      "2. multi-process race: exactly 5 of 10 succeed",
      ok === 5 && fail === 5 && finalAvailable === 0 && finalAvailable >= 0,
      `ok=${ok} fail=${fail} insufficient≈${insufficient} okA=${okA} okB=${okB} finalAvailable=${finalAvailable}`
    );
    step(
      "2b. multi-process final balance never negative",
      finalAvailable >= 0,
      `finalAvailable=${finalAvailable}`
    );

    const matchesWorkerRace = ok === 5 && fail === 5 && finalAvailable === 0;
    step(
      "2c. matches prior worker_threads race outcome (5/5/0)",
      matchesWorkerRace,
      matchesWorkerRace
        ? "same correct outcome under true cross-process parallelism"
        : `DIFFERENT from worker race — investigate (ok=${ok} fail=${fail} bal=${finalAvailable})`
    );

    // Extra: overdraw pair across processes
    setAvailable(userId, 150_000);
    const pair = await Promise.all([
      api(baseA, "/api/wallet", {
        method: "POST",
        cookie,
        body: { kind: "withdraw", amount: 100_000, note: "pair-A" }
      }),
      api(baseB, "/api/wallet", {
        method: "POST",
        cookie,
        body: { kind: "withdraw", amount: 100_000, note: "pair-B" }
      })
    ]);
    const pairOk = pair.filter((r) => r.res.status === 200).length;
    const pairFail = pair.filter((r) => r.res.status !== 200).length;
    const pairBal = readAvailable(userId);
    step(
      "2d. cross-process overdraw pair → exactly 1 ok",
      pairOk === 1 && pairFail === 1 && pairBal === 50_000,
      `ok=${pairOk} fail=${pairFail} finalAvailable=${pairBal}`
    );

  } catch (error) {
    failed = true;
    step("fatal", false, String(error?.stack || error));
  } finally {
    await stopAll();
    const allOk = report.every((r) => r.ok) && !failed;
    const summary = report.map((r) => r.line).join("\n");
    writeFileSync(
      path.join(root, "data", "zibaban-wallet-prod-race-report.txt"),
      `${summary}\n\nALL_OK=${allOk}\n`
    );
    console.log(`\nALL_OK=${allOk}`);

    cleanupDbFiles();
    step("cleanup isolated DB", true, TEST_DB);
    // rewrite report after cleanup step
    writeFileSync(
      path.join(root, "data", "zibaban-wallet-prod-race-report.txt"),
      `${report.map((r) => r.line).join("\n")}\n\nALL_OK=${report.every((r) => r.ok) && !failed}\n`
    );

    process.exit(report.every((r) => r.ok) && !failed ? 0 : 1);
  }
}

main();
