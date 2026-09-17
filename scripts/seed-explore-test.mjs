/**
 * Isolated explore/posts seed + API smoke test (LOCAL ONLY).
 *
 * Uses a separate SQLite file (never data/zibaban.sqlite):
 *   data/zibaban-explore-test.sqlite
 *
 * Usage:
 *   node scripts/seed-explore-test.mjs
 *   node scripts/seed-explore-test.mjs --cleanup
 *   node scripts/seed-explore-test.mjs --keep-server
 *
 * Env:
 *   ZIBABAN_EXPLORE_TEST_PORT  default 3012
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-explore-test.sqlite");
const PORT = Number(process.env.ZIBABAN_EXPLORE_TEST_PORT || 3012);
const BASE = `http://127.0.0.1:${PORT}`;
const PHONE = "09123334455";
const PASSWORD = "explore-test-pass";

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

/** Mirror useExploreFeed visibleExplorePosts merge (AI + server). */
function mergeVisibleExplorePosts(publishedAiPosts, explorePostList, exploreCategory = "همه") {
  const all = [...publishedAiPosts, ...explorePostList];
  if (exploreCategory === "همه") return all;
  return all.filter((post) => post.tag === exploreCategory);
}

async function waitForServer(timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/explore/posts`);
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
        NEXT_DIST_DIR: ".next-explore-test",
        PORT: String(PORT)
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true
    }
  );
  const logPath = path.join(root, "data", "zibaban-explore-test-server.log");
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
  console.log("=== explore seed / smoke (isolated DB) ===");
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
    step("start Next on isolated DB", false, "timeout — see data/zibaban-explore-test-server.log");
    await stopServer(server);
    process.exitCode = 1;
    return;
  }
  step("start Next on isolated DB", true, `port ${PORT}, ZIBABAN_DB_PATH set`);

  let cookie = "";
  let userId = null;
  const createdPosts = [];

  try {
    {
      const { res, payload, cookie: nextCookie } = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: PHONE,
          password: PASSWORD,
          type: "artist",
          data: {
            name: "آرتیست تست اکسپلور",
            area: "سعادت‌آباد",
            service: "میکاپ",
            bio: "seed موقت explore"
          }
        }
      });
      cookie = nextCookie;
      userId = payload?.data?.user?.id || payload?.profile?.id || null;
      step(
        "POST /api/auth/register (type=artist)",
        res.ok && Boolean(cookie) && Boolean(userId),
        res.ok ? `userId=${userId}, cookie=yes` : `status=${res.status} ${payload.error || ""}`
      );
      if (!res.ok || !cookie) throw new Error("register failed");
    }

    const postsSpec = [
      {
        title: "بالیاژ تست ۱",
        tag: "مو",
        caption: "seed explore post 1",
        image: "/explore-post-hair-balayage.png",
        inExplore: true,
        featured: true
      },
      {
        title: "میکاپ نود تست",
        tag: "میکاپ",
        caption: "seed explore post 2",
        image: "/explore-post-makeup-nude.png",
        inExplore: true,
        featured: false
      },
      {
        title: "فرنچ ناخن تست",
        tag: "ناخن",
        caption: "seed explore post 3",
        image: "/ad-rose-velvet.png",
        inExplore: true,
        featured: false
      }
    ];

    for (const body of postsSpec) {
      const { res, payload } = await api("/api/posts", {
        method: "POST",
        body,
        cookie
      });
      const post = payload?.data?.post;
      const ok = res.status === 201 && post?.id;
      step(
        `POST /api/posts create «${body.title}»`,
        ok,
        ok ? `id=${post.id}` : `status=${res.status} ${payload.error || ""}`
      );
      if (ok) createdPosts.push(post);
    }
    if (createdPosts.length < 2) throw new Error("not enough posts created");

    const target = createdPosts[0];

    {
      const { res, payload } = await api("/api/explore/posts", { cookie });
      const posts = payload?.data?.posts || [];
      const savedTitles = payload?.data?.savedTitles || [];
      const ok = res.ok && posts.length >= createdPosts.length;
      step(
        "GET /api/explore/posts",
        ok,
        res.ok
          ? `posts=${posts.length}, savedTitles=${savedTitles.length}`
          : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api(`/api/posts/${target.id}/view`, { method: "POST" });
      const post = payload?.data?.post;
      const ok = res.ok && post && Number(post.views || post.viewsCount || 0) >= 0;
      step(
        "POST /api/posts/:id/view",
        ok,
        ok ? `id=${target.id}, views=${post.views ?? post.viewsCount ?? "?"}` : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api(`/api/posts/${target.id}/save`, { method: "POST", cookie });
      const saved = payload?.data?.saved;
      const ok = res.ok && saved === true;
      step(
        "POST /api/posts/:id/save",
        ok,
        ok ? `saved=${saved}` : `status=${res.status} ${JSON.stringify(payload).slice(0, 100)}`
      );
    }

    {
      const { res, payload } = await api(`/api/posts/${target.id}/rate`, {
        method: "POST",
        cookie,
        body: { rating: 5 }
      });
      const post = payload?.data?.post;
      const ok = res.ok && post;
      step(
        "POST /api/posts/:id/rate",
        ok,
        ok ? `id=${post.id}, rating=${post.rating || post.ratingAvg || "?"}` : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api("/api/explore/posts", { cookie });
      const posts = payload?.data?.posts || [];
      const savedTitles = (payload?.data?.savedTitles || []).map(String);
      const ratings = payload?.data?.ratings || {};
      const hasSaved = savedTitles.includes(String(target.id));
      const hasRating = Number(ratings[String(target.id)] || ratings[target.title] || 0) === 5;
      const ok = res.ok && hasSaved && hasRating;
      step(
        "GET /api/explore/posts reflects save+rate",
        ok,
        `saved=${hasSaved}, rating5=${hasRating}, posts=${posts.length}`
      );
    }

    {
      const publishedAiPosts = [
        {
          title: "اثر AI ماک",
          salon: "استودیو تست",
          area: "AI",
          tag: "میکاپ",
          meta: "mock publishedAiPosts",
          image: "/story-glow-serum.png"
        }
      ];
      const explorePostList = createdPosts.map((p) => ({
        id: p.id,
        title: p.title,
        tag: p.tag,
        salon: p.salon || p.ownerName || ""
      }));
      const mergedAll = mergeVisibleExplorePosts(publishedAiPosts, explorePostList, "همه");
      const mergedMakeup = mergeVisibleExplorePosts(publishedAiPosts, explorePostList, "میکاپ");
      const ok = mergedAll.length === publishedAiPosts.length + explorePostList.length
        && mergedMakeup.some((p) => p.title === "اثر AI ماک")
        && mergedMakeup.some((p) => p.title === "میکاپ نود تست");
      step(
        "publishedAiPosts merge (useExploreFeed-equivalent)",
        ok,
        `all=${mergedAll.length}, makeup=${mergedMakeup.length}, titles=${mergedMakeup.map((p) => p.title).join(" | ")}`
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
  console.log("rollback: node scripts/seed-explore-test.mjs --cleanup");

  if (!keepServer) {
    await stopServer(server);
    step("stop test server", true, `port ${PORT}`);
  } else {
    console.log(`\nserver left running on ${BASE} (ZIBABAN_DB_PATH=${TEST_DB})`);
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
