/**
 * Isolated wallet financial-safety suite (LOCAL ONLY).
 *
 * Uses: data/zibaban-wallet-test.sqlite (never data/zibaban.sqlite)
 *
 * Covers:
 * 2. Race: 10 concurrent withdraws via worker_threads + separate DB connections
 * 3. Overdraw race: two concurrent withdraws (different keys) that overdraw together → one wins
 * 4. demo_credit blocked when NODE_ENV=production
 * 5. feePercent from body ignored (server constant used)
 * 6. Withdraw stays pending (not auto-paid); admin confirm_withdraw → paid
 * 7. Idempotency key: two concurrent demo_credit / withdraw calls with the SAME
 *    idempotencyKey apply the balance change exactly once (second call returns
 *    the stored first result instead of re-executing)
 * 8. --cleanup
 *
 * Usage:
 *   node scripts/seed-wallet-test.mjs
 *   node scripts/seed-wallet-test.mjs --cleanup
 *
 * Env:
 *   ZIBABAN_WALLET_TEST_PORT   default 3027
 *   ZIBABAN_WALLET_ADMIN_TOKEN default wallet-admin-test-token
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-wallet-test.sqlite");
const PORT = Number(process.env.ZIBABAN_WALLET_TEST_PORT || 3027);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "wallet-test-pass1";
const ADMIN_TOKEN = process.env.ZIBABAN_WALLET_ADMIN_TOKEN || "wallet-admin-test-token";
const PHONE = "09001112233";

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

async function api(pathname, { method = "GET", body, cookie, headers: extraHeaders } = {}) {
  const headers = { "Content-Type": "application/json", ...(extraHeaders || {}) };
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
      NODE_ENV: "development",
      ZIBABAN_DB_PATH: TEST_DB,
      ZIBABAN_WALLET_ADMIN_TOKEN: ADMIN_TOKEN,
      NEXT_DIST_DIR: ".next-wallet-test",
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
      writeFileSync(path.join(root, "data", "zibaban-wallet-test-server.log"), Buffer.concat(chunks));
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

function runWorkerWithdraw({ dbPath, userId, amount, idempotencyKey = "" }) {
  const workerSource = `
    import { parentPort, workerData } from "node:worker_threads";
    process.env.ZIBABAN_DB_PATH = workerData.dbPath;
    const wallet = await import(${JSON.stringify(pathToFileURL(path.join(root, "app/lib/db/repos/wallet.js")).href)});
    const result = wallet.requestWithdraw(workerData.userId, workerData.amount, "race-test", workerData.idempotencyKey || "");
    parentPort.postMessage(result);
  `;
  const tmp = path.join(root, "data", `wallet-race-worker-${process.pid}-${Math.random().toString(16).slice(2)}.mjs`);
  writeFileSync(tmp, workerSource);
  return new Promise((resolve) => {
    const worker = new Worker(tmp, {
      workerData: { dbPath, userId, amount, idempotencyKey },
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

/** Same pattern as runWorkerWithdraw, but for creditCash (the top-up path) — used
 *  to prove same-key concurrent demo_credit calls only apply the net amount once. */
function runWorkerCredit({ dbPath, userId, amount, idempotencyKey = "" }) {
  const workerSource = `
    import { parentPort, workerData } from "node:worker_threads";
    process.env.ZIBABAN_DB_PATH = workerData.dbPath;
    const wallet = await import(${JSON.stringify(pathToFileURL(path.join(root, "app/lib/db/repos/wallet.js")).href)});
    const result = wallet.creditCash(workerData.userId, {
      amount: workerData.amount,
      asPending: false,
      type: "demo_credit",
      note: "idempotency-test",
      idempotencyKey: workerData.idempotencyKey || ""
    });
    parentPort.postMessage(result);
  `;
  const tmp = path.join(root, "data", `wallet-idem-worker-${process.pid}-${Math.random().toString(16).slice(2)}.mjs`);
  writeFileSync(tmp, workerSource);
  return new Promise((resolve) => {
    const worker = new Worker(tmp, {
      workerData: { dbPath, userId, amount, idempotencyKey },
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

async function testProductionDemoGuard() {
  const childSource = `
    process.env.NODE_ENV = "production";
    const { isDemoCreditBlocked } = await import(${JSON.stringify(pathToFileURL(path.join(root, "app/lib/wallet-guards.js")).href)});
    const blocked = isDemoCreditBlocked() === true;
    // Mirror route behavior: blocked → would return 403
    console.log(JSON.stringify({ blocked, status: blocked ? 403 : 200 }));
  `;
  const tmp = path.join(root, "data", `wallet-prod-guard-${process.pid}.mjs`);
  writeFileSync(tmp, childSource);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tmp], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "production",
        ZIBABAN_DB_PATH: TEST_DB
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (b) => { out += b.toString(); });
    child.stderr.on("data", (b) => { err += b.toString(); });
    child.on("exit", () => {
      try { rmSync(tmp, { force: true }); } catch { /* ignore */ }
      try {
        const parsed = JSON.parse(out.trim().split("\n").filter(Boolean).pop() || "{}");
        resolve({ parsed, err });
      } catch {
        resolve({ parsed: { blocked: false }, err: err || out });
      }
    });
  });
}

async function main() {
  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("Cleaned wallet test DB files.");
    return;
  }

  cleanupDbFiles();
  const server = startTestServer();
  let failed = false;

  try {
    const up = await waitForServer();
    step("server up", up, BASE);
    if (!up) throw new Error("server failed to start");

    // --- Register shop user ---
    const reg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: PHONE,
        password: PASSWORD,
        type: "shop",
        name: "Wallet Test Shop",
        area: "تهران"
      }
    });
    let cookie = reg.cookie;
    step("register shop", reg.res.status === 200 || reg.res.status === 201, `status=${reg.res.status}`);
    if (!cookie) {
      const login = await api("/api/auth/login", {
        method: "POST",
        body: { phone: PHONE, password: PASSWORD }
      });
      cookie = login.cookie;
      step("login fallback", Boolean(cookie), `status=${login.res.status}`);
    }

    const me = await api("/api/auth/me", { cookie });
    const userId = me.payload?.user?.id || me.payload?.data?.user?.id || me.payload?.id;
    step("resolve user id", Boolean(userId), `userId=${userId}`);

    // --- Bank + demo credit ---
    const bank = await api("/api/wallet", {
      method: "POST",
      cookie,
      body: {
        kind: "bank",
        sheba: "IR120170000000123456789001",
        holderName: "تست کیف پول"
      }
    });
    step("bank save", bank.res.status === 200, `status=${bank.res.status}`);

    // Fee test: pass absurd feePercent from body — must be ignored (server 10%).
    const creditGross = 1_000_000;
    const expectedFee = Math.floor((creditGross * 10) / 100);
    const expectedNet = creditGross - expectedFee;
    const credit = await api("/api/wallet", {
      method: "POST",
      cookie,
      body: {
        kind: "demo_credit",
        amount: creditGross,
        asPending: false,
        feePercent: 90
      }
    });
    const gotNet = credit.payload.net ?? credit.payload.data?.net;
    const gotFee = credit.payload.fee ?? credit.payload.data?.fee;
    const gotFeePercent = credit.payload.feePercent ?? credit.payload.data?.feePercent;
    const availableAfterCredit =
      credit.payload.availableBalance ?? credit.payload.data?.availableBalance;
    step(
      "5. feePercent from body ignored (server 10%)",
      credit.res.status === 200
        && gotFee === expectedFee
        && gotNet === expectedNet
        && gotFeePercent === 10
        && availableAfterCredit === expectedNet,
      `fee=${gotFee} net=${gotNet} feePercent=${gotFeePercent} available=${availableAfterCredit}`
    );

    // --- 6) Withdraw → pending ---
    const withdrawAmount = 100_000;
    const wd = await api("/api/wallet", {
      method: "POST",
      cookie,
      body: { kind: "withdraw", amount: withdrawAmount, note: "pending-check" }
    });
    const wdStatus = wd.payload.status
      || wd.payload.data?.status
      || wd.payload.withdrawals?.[0]?.status
      || wd.payload.data?.withdrawals?.[0]?.status;
    const wdId = wd.payload.withdrawalId ?? wd.payload.data?.withdrawalId;
    step(
      "6. withdraw is pending (not paid)",
      wd.res.status === 200 && wdStatus === "pending" && Boolean(wdId),
      `status=${wd.res.status} withdrawStatus=${wdStatus} id=${wdId}`
    );

    const confirmBad = await api("/api/wallet", {
      method: "POST",
      cookie,
      body: { kind: "confirm_withdraw", withdrawalId: wdId }
    });
    step(
      "6b. confirm without admin token → 403/503",
      confirmBad.res.status === 403 || confirmBad.res.status === 503,
      `status=${confirmBad.res.status}`
    );

    const confirmOk = await api("/api/wallet", {
      method: "POST",
      cookie,
      headers: { "x-wallet-admin-token": ADMIN_TOKEN },
      body: { kind: "confirm_withdraw", withdrawalId: wdId }
    });
    const paidStatus = confirmOk.payload.withdrawals?.find((w) => w.id === wdId)?.status
      || confirmOk.payload.data?.withdrawals?.find((w) => w.id === wdId)?.status;
    step(
      "6c. admin confirm_withdraw → paid",
      confirmOk.res.status === 200 && paidStatus === "paid",
      `status=${confirmOk.res.status} paidStatus=${paidStatus}`
    );

    // --- 4) demo_credit production guard ---
    const routePath = path.join(root, "app", "api", "wallet", "route.js");
    const routeSource = readFileSync(routePath, "utf8");
    const hasGuard = routeSource.includes("isDemoCreditBlocked")
      && routeSource.includes("demo_credit")
      && routeSource.includes("403");
    const prodChild = await testProductionDemoGuard();
    step(
      "4. demo_credit blocked in production (isDemoCreditBlocked → 403)",
      hasGuard && prodChild.parsed?.blocked === true && prodChild.parsed?.status === 403,
      `hasGuard=${hasGuard} status=${prodChild.parsed?.status} blocked=${prodChild.parsed?.blocked} err=${prodChild.err || ""}`
    );

    // Live HTTP still allows demo in development:
    const demoDev = await api("/api/wallet", {
      method: "POST",
      cookie,
      body: { kind: "demo_credit", amount: 100_000, asPending: false }
    });
    step(
      "4b. demo_credit allowed in development server",
      demoDev.res.status === 200,
      `status=${demoDev.res.status}`
    );

    // --- Reset available for race via direct SQL credit ---
    process.env.ZIBABAN_DB_PATH = TEST_DB;
    // Fresh import path: use worker-less direct connection for setup
    const { DatabaseSync } = await import("node:sqlite");
    const setupDb = new DatabaseSync(TEST_DB);
    setupDb.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    // Balance for race: exactly 5 * 100_000 = 500_000 available
    setupDb.prepare(`
      UPDATE wallets SET available_balance = ?, pending_balance = 0, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(500_000, userId);
    const bal = setupDb.prepare("SELECT available_balance FROM wallets WHERE user_id = ?").get(userId);
    setupDb.close();
    step("race setup balance=500000", Number(bal?.available_balance) === 500_000, `available=${bal?.available_balance}`);

    // --- 2) Race: 10 concurrent withdraws of 100k ---
    const raceAmount = 100_000;
    const raceJobs = Array.from({ length: 10 }, () =>
      runWorkerWithdraw({ dbPath: TEST_DB, userId, amount: raceAmount })
    );
    const raceResults = await Promise.all(raceJobs);
    const raceOk = raceResults.filter((r) => r?.ok).length;
    const raceFail = raceResults.filter((r) => !r?.ok).length;
    const raceInsufficient = raceResults.filter((r) => r?.error === "insufficient").length;

    const verifyDb = new DatabaseSync(TEST_DB);
    const finalBal = verifyDb.prepare("SELECT available_balance FROM wallets WHERE user_id = ?").get(userId);
    const finalAvailable = Number(finalBal?.available_balance || 0);
    verifyDb.close();

    step(
      "2. race 10 concurrent withdraws → exactly 5 ok",
      raceOk === 5 && raceFail === 5 && finalAvailable === 0 && finalAvailable >= 0,
      `ok=${raceOk} fail=${raceFail} insufficient=${raceInsufficient} finalAvailable=${finalAvailable}`
    );
    step(
      "2b. final balance never negative",
      finalAvailable >= 0,
      `finalAvailable=${finalAvailable}`
    );

    // --- 3) Idempotency / overdraw pair ---
    const pairDb = new DatabaseSync(TEST_DB);
    pairDb.prepare(`
      UPDATE wallets SET available_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
    `).run(150_000, userId);
    pairDb.close();

    const pair = await Promise.all([
      runWorkerWithdraw({ dbPath: TEST_DB, userId, amount: 100_000 }),
      runWorkerWithdraw({ dbPath: TEST_DB, userId, amount: 100_000 })
    ]);
    const pairOk = pair.filter((r) => r?.ok).length;
    const pairFail = pair.filter((r) => !r?.ok).length;
    const pairCheck = new DatabaseSync(TEST_DB);
    const pairBal = Number(
      pairCheck.prepare("SELECT available_balance FROM wallets WHERE user_id = ?").get(userId)
        ?.available_balance || 0
    );
    pairCheck.close();
    step(
      "3. two concurrent overdrawing withdraws (different keys) → exactly 1 ok",
      pairOk === 1 && pairFail === 1 && pairBal === 50_000,
      `ok=${pairOk} fail=${pairFail} finalAvailable=${pairBal}`
    );

    // --- 7) Idempotency: SAME key, two truly-concurrent demo_credit calls ---
    // This is the KNOWN_ISSUES.md "wallet is not idempotent against parallel
    // requests" scenario: e.g. two open tabs, or a network retry, both firing
    // POST /api/wallet {kind:"demo_credit", idempotencyKey:"same-uuid"} at once.
    // Expected: only ONE of them actually credits the wallet; the other reads
    // back the first call's stored result from wallet_idempotency_keys inside
    // the same withTransaction (BEGIN IMMEDIATE serializes them), so the net
    // amount is applied exactly once regardless of which one "wins" the race.
    const creditIdemDb = new DatabaseSync(TEST_DB);
    const creditIdemStart = 0;
    creditIdemDb.prepare(`
      UPDATE wallets SET available_balance = ?, pending_balance = 0, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(creditIdemStart, userId);
    creditIdemDb.close();

    const sameKey = `idem-credit-${process.pid}-${Date.now()}`;
    const creditAmount = 200_000;
    const expectedCreditFee = Math.floor((creditAmount * 10) / 100);
    const expectedCreditNet = creditAmount - expectedCreditFee;
    const creditPair = await Promise.all([
      runWorkerCredit({ dbPath: TEST_DB, userId, amount: creditAmount, idempotencyKey: sameKey }),
      runWorkerCredit({ dbPath: TEST_DB, userId, amount: creditAmount, idempotencyKey: sameKey })
    ]);
    const creditPairOk = creditPair.filter((r) => r?.ok).length;
    const creditPairNets = creditPair.map((r) => r?.net);
    const creditIdemCheck = new DatabaseSync(TEST_DB);
    const creditIdemBal = Number(
      creditIdemCheck.prepare("SELECT available_balance FROM wallets WHERE user_id = ?").get(userId)
        ?.available_balance || 0
    );
    const idemKeyRows = creditIdemCheck.prepare(
      "SELECT COUNT(*) AS n FROM wallet_idempotency_keys WHERE user_id = ? AND kind = 'demo_credit' AND key = ?"
    ).get(userId, sameKey);
    creditIdemCheck.close();
    step(
      "7. two concurrent demo_credit with SAME idempotencyKey → net applied exactly once",
      creditPairOk === 2
        && creditPairNets[0] === expectedCreditNet
        && creditPairNets[1] === expectedCreditNet
        && creditIdemBal === expectedCreditNet
        && Number(idemKeyRows?.n || 0) === 1,
      `ok=${creditPairOk} nets=${JSON.stringify(creditPairNets)} finalAvailable=${creditIdemBal} expectedNet=${expectedCreditNet} idemRows=${idemKeyRows?.n}`
    );

    // Same key, called sequentially (not just concurrently) must also be a no-op
    // the second time — proves the dedupe isn't just an artifact of lock contention.
    const sequentialRepeat = await api("/api/wallet", {
      method: "POST",
      cookie,
      body: { kind: "demo_credit", amount: creditAmount, asPending: false, idempotencyKey: sameKey }
    });
    const repeatAvailable = sequentialRepeat.payload.availableBalance ?? sequentialRepeat.payload.data?.availableBalance;
    step(
      "7b. replaying the same idempotencyKey via HTTP afterwards → still no double-credit",
      sequentialRepeat.res.status === 200 && repeatAvailable === expectedCreditNet,
      `status=${sequentialRepeat.res.status} available=${repeatAvailable} expected=${expectedCreditNet}`
    );

    // --- 7c) Idempotency also covers withdraw (same key, concurrent) ---
    const withdrawIdemDb = new DatabaseSync(TEST_DB);
    withdrawIdemDb.prepare(`
      UPDATE wallets SET available_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?
    `).run(300_000, userId);
    withdrawIdemDb.close();

    const withdrawSameKey = `idem-withdraw-${process.pid}-${Date.now()}`;
    const withdrawIdemPair = await Promise.all([
      runWorkerWithdraw({ dbPath: TEST_DB, userId, amount: 100_000, idempotencyKey: withdrawSameKey }),
      runWorkerWithdraw({ dbPath: TEST_DB, userId, amount: 100_000, idempotencyKey: withdrawSameKey })
    ]);
    const withdrawIdemOk = withdrawIdemPair.filter((r) => r?.ok).length;
    const withdrawIdemIds = withdrawIdemPair.map((r) => r?.withdrawalId).filter((v) => v != null);
    const withdrawIdemCheck = new DatabaseSync(TEST_DB);
    const withdrawIdemBal = Number(
      withdrawIdemCheck.prepare("SELECT available_balance FROM wallets WHERE user_id = ?").get(userId)
        ?.available_balance || 0
    );
    const withdrawIdemKeyRows = Number(
      withdrawIdemCheck.prepare(
        "SELECT COUNT(*) AS n FROM wallet_idempotency_keys WHERE user_id = ? AND kind = 'withdraw' AND key = ?"
      ).get(userId, withdrawSameKey)?.n || 0
    );
    withdrawIdemCheck.close();
    step(
      "7d. two concurrent withdraws with SAME idempotencyKey → deducted exactly once, one stored idempotency row",
      withdrawIdemOk === 2
        && withdrawIdemIds[0] === withdrawIdemIds[1]
        && withdrawIdemBal === 200_000
        && withdrawIdemKeyRows === 1,
      `ok=${withdrawIdemOk} ids=${JSON.stringify(withdrawIdemIds)} finalAvailable=${withdrawIdemBal} idemKeyRows=${withdrawIdemKeyRows}`
    );

    // WAL mode check
    const walDb = new DatabaseSync(TEST_DB);
    const mode = walDb.prepare("PRAGMA journal_mode;").get();
    walDb.close();
    const journalMode = String(mode?.journal_mode || mode?.Journal_mode || Object.values(mode || {})[0] || "").toLowerCase();
    step("WAL mode active", journalMode === "wal", `journal_mode=${journalMode}`);

  } catch (error) {
    failed = true;
    step("fatal", false, String(error?.stack || error));
  } finally {
    if (!keepServer) await stopServer(server);
    const allOk = report.every((r) => r.ok) && !failed;
    const summary = report.map((r) => r.line).join("\n");
    writeFileSync(path.join(root, "data", "zibaban-wallet-test-report.txt"), summary + `\n\nALL_OK=${allOk}\n`);
    console.log(`\nALL_OK=${allOk}`);
    if (!keepServer) {
      // leave DB for inspection unless --cleanup passed as second run
    }
    process.exit(allOk ? 0 : 1);
  }
}

main();
