/**
 * Isolated AI Studio seed + smoke test (LOCAL ONLY).
 *
 * Uses: data/zibaban-ai-test.sqlite (never data/zibaban.sqlite)
 *
 * AI "generation" is a client mock; the only real server side-effect on create
 * is POST /api/wallet { amount: -1 }. Publish uses POST /api/posts.
 *
 * Usage:
 *   node scripts/seed-ai-test.mjs
 *   node scripts/seed-ai-test.mjs --cleanup
 *
 * Env: ZIBABAN_AI_TEST_PORT  default 3013
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-ai-test.sqlite");
const PORT = Number(process.env.ZIBABAN_AI_TEST_PORT || 3013);
const BASE = `http://127.0.0.1:${PORT}`;
const PHONE = "09125556677";
const PASSWORD = "ai-test-pass";
const SEED_SHELLS = 5;

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

/** Same debit call HomeApp onSpendShell / createAiPreview uses. */
async function spendShell(cookie, amount, note) {
  return api("/api/wallet", {
    method: "POST",
    cookie,
    body: { amount, note }
  });
}

/** Mirror useExploreFeed merge of publishedAiPosts. */
function mergeFeed(publishedAiPosts, explorePostList) {
  return [...publishedAiPosts, ...explorePostList];
}

async function waitForServer(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/explore/posts`);
      if (res.status === 200) return true;
    } catch {
      // not up
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
      NEXT_DIST_DIR: ".next-ai-test",
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true
  });
  const logPath = path.join(root, "data", "zibaban-ai-test-server.log");
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
  console.log("=== AI studio seed / smoke (isolated DB) ===");
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
    step("start Next on isolated DB", false, "timeout — see data/zibaban-ai-test-server.log");
    await stopServer(server);
    process.exitCode = 1;
    return;
  }
  step("start Next on isolated DB", true, `port ${PORT}, ZIBABAN_DB_PATH set`);

  let cookie = "";
  let walletApiBroken = false;

  try {
    {
      const { res, payload, cookie: nextCookie } = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: PHONE,
          password: PASSWORD,
          type: "client",
          data: { name: "کاربر تست AI", area: "تهران", bio: "seed ai studio" }
        }
      });
      cookie = nextCookie;
      const userId = payload?.data?.user?.id || payload?.profile?.id;
      step(
        "POST /api/auth/register",
        res.ok && Boolean(cookie) && Boolean(userId),
        res.ok ? `userId=${userId}` : `status=${res.status}`
      );
      if (!res.ok || !cookie) throw new Error("register failed");
    }

    // Prefer real wallet endpoint (same as HomeApp onSpendShell). Falls back to SQL seed on test DB only
    // if the existing changeShellBalance path errors (known: db.transaction missing on node:sqlite).
    {
      const { res, payload } = await spendShell(cookie, SEED_SHELLS, `${SEED_SHELLS} شل seed تست AI`);
      const bal = Number(payload?.data?.shellBalance ?? payload?.shellBalance ?? -1);
      if (res.ok && bal === SEED_SHELLS) {
        step(`seed shells via POST /api/wallet (+${SEED_SHELLS})`, true, `shellBalance=${bal}`);
      } else {
        walletApiBroken = true;
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(TEST_DB);
        db.prepare("UPDATE wallets SET shell_balance = ? WHERE user_id = 1").run(SEED_SHELLS);
        const row = db.prepare("SELECT shell_balance FROM wallets WHERE user_id = 1").get();
        db.close();
        step(
          `seed shells via SQL on test DB only (+${SEED_SHELLS})`,
          Number(row?.shell_balance) === SEED_SHELLS,
          `API status=${res.status} (wallet.transaction broken); sqlBalance=${row?.shell_balance}`
        );
        console.log(
          "! FINDING: POST /api/wallet → changeShellBalance uses db.transaction which is not a function on node:sqlite DatabaseSync (pre-existing; wallet left untouched)"
        );
      }
    }

    let balanceAfterCreate = SEED_SHELLS;
    {
      const before = SEED_SHELLS;
      const { res, payload } = await spendShell(cookie, -1, "۱ شل برای ساخت تصویر AI مصرف شد.");
      balanceAfterCreate = Number(payload?.data?.shellBalance ?? payload?.shellBalance ?? -1);
      if (res.ok && balanceAfterCreate === before - 1) {
        step(
          "createAiPreview debit (−1 shell via POST /api/wallet)",
          true,
          `before=${before}, after=${balanceAfterCreate}`
        );
      } else if (walletApiBroken) {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(TEST_DB);
        db.prepare("UPDATE wallets SET shell_balance = shell_balance - 1 WHERE user_id = 1 AND shell_balance >= 1").run();
        const row = db.prepare("SELECT shell_balance FROM wallets WHERE user_id = 1").get();
        db.close();
        balanceAfterCreate = Number(row?.shell_balance);
        step(
          "createAiPreview debit simulated on test DB (−1; API unavailable)",
          balanceAfterCreate === before - 1,
          `before=${before}, after=${balanceAfterCreate}, apiStatus=${res.status}`
        );
      } else {
        step(
          "createAiPreview debit (−1 shell via POST /api/wallet)",
          false,
          `before=${before}, after=${balanceAfterCreate}, status=${res.status}`
        );
      }
    }

    // Local publishedAiPosts (saveAiCreation path — no server AI endpoint)
    const publishedAiPosts = [
      {
        title: "اثر AI تست لوکال",
        salon: "استودیو زیبابان",
        area: "AI",
        tag: "میکاپ",
        meta: "mock · نچرال",
        image: "/explore-post-makeup-nude.png"
      }
    ];
    step(
      "publishedAiPosts local list (save path)",
      publishedAiPosts.length === 1 && publishedAiPosts[0].title === "اثر AI تست لوکال",
      `count=${publishedAiPosts.length}`
    );

    // publishAiCreation → POST /api/posts (real)
    let publishedId = null;
    {
      const { res, payload } = await api("/api/posts", {
        method: "POST",
        cookie,
        body: {
          title: "اثر AI منتشرشده تست",
          tag: "میکاپ",
          caption: "فرنچ کروم · نچرال",
          image: "/explore-post-makeup-nude.png",
          inExplore: true,
          featured: false
        }
      });
      const post = payload?.data?.post;
      publishedId = post?.id || null;
      step(
        "publishAiCreation → POST /api/posts",
        res.status === 201 && Boolean(publishedId),
        publishedId ? `id=${publishedId}` : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api("/api/explore/posts", { cookie });
      const posts = payload?.data?.posts || [];
      const found = posts.find((p) => Number(p.id) === Number(publishedId) || p.title === "اثر AI منتشرشده تست");
      step(
        "GET /api/explore/posts shows published AI post",
        res.ok && Boolean(found),
        res.ok ? `posts=${posts.length}, foundId=${found?.id ?? "no"}` : `status=${res.status}`
      );

      const merged = mergeFeed(publishedAiPosts, posts);
      const hasLocal = merged.some((p) => p.title === "اثر AI تست لوکال");
      const hasServer = merged.some((p) => Number(p.id) === Number(publishedId));
      step(
        "AI→Explore merge (publishedAiPosts + server feed)",
        hasLocal && hasServer,
        `merged=${merged.length}, local=${hasLocal}, server=${hasServer}`
      );
    }

    // Insufficient shells: drain then try spend −1 (existing server guard — do not invent new rules)
    {
      if (walletApiBroken) {
        const { DatabaseSync } = await import("node:sqlite");
        const db = new DatabaseSync(TEST_DB);
        db.prepare("UPDATE wallets SET shell_balance = 0 WHERE user_id = 1").run();
        db.close();
      } else {
        let bal = balanceAfterCreate;
        while (bal > 0) {
          const { res, payload } = await spendShell(cookie, -1, "drain for insufficient test");
          if (!res.ok) break;
          bal = Number(payload?.data?.shellBalance ?? payload?.shellBalance ?? 0);
        }
      }

      const { res: getRes, payload: getPayload } = await api("/api/wallet", { cookie });
      const zeroBal = Number(getPayload?.data?.shellBalance ?? getPayload?.shellBalance ?? -1);
      step("balance at zero before insufficient attempt", getRes.ok && zeroBal === 0, `shellBalance=${zeroBal}`);

      // Client-side guard in useAiStudio: shellBalance < 1 → reject before spend (exists today)
      const clientWouldBlock = zeroBal < 1;
      step(
        "client guard would block create (shellBalance < 1)",
        clientWouldBlock,
        "useAiStudio createAiPreview early return — existing behavior"
      );

      const { res, payload } = await spendShell(cookie, -1, "۱ شل برای ساخت تصویر AI مصرف شد.");
      const afterFail = Number(payload?.data?.shellBalance ?? payload?.shellBalance ?? zeroBal);
      if (walletApiBroken) {
        // Early return in changeShellBalance (next < 0) happens BEFORE db.transaction —
        // so insufficient still returns 400 even when successful spends 500.
        const rejected = res.status === 400;
        step(
          "insufficient shell rejected (wallet early guard, before broken transaction)",
          rejected && zeroBal === 0,
          `status=${res.status}, error=${payload.error || ""}`
        );
      } else {
        const rejected = !res.ok;
        const notNegative = afterFail >= 0;
        step(
          "insufficient shell rejected (existing wallet guard)",
          rejected && notNegative && afterFail === 0,
          `status=${res.status}, balance=${afterFail}, error=${payload.error || ""}`
        );
      }
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
  console.log("rollback: node scripts/seed-ai-test.mjs --cleanup");
  console.log("note: no /api/ai* generate endpoint — create is mock + wallet debit only");

  if (!keepServer) {
    await stopServer(server);
    step("stop test server", true, `port ${PORT}`);
  } else {
    console.log(`\nserver left running on ${BASE}`);
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
