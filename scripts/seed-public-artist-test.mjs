/**
 * Isolated public-artist seed + smoke test (LOCAL ONLY).
 *
 * Uses: data/zibaban-public-artist-test.sqlite (never data/zibaban.sqlite)
 *
 * Usage:
 *   node scripts/seed-public-artist-test.mjs
 *   node scripts/seed-public-artist-test.mjs --cleanup
 *
 * Env: ZIBABAN_PUBLIC_ARTIST_TEST_PORT  default 3015
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-public-artist-test.sqlite");
const PORT = Number(process.env.ZIBABAN_PUBLIC_ARTIST_TEST_PORT || 3015);
const BASE = `http://127.0.0.1:${PORT}`;
const ARTIST_PHONE = "09130000001";
const CLIENT_PHONE = "09130000002";
const PASSWORD = "public-artist-test";

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
      const res = await fetch(`${BASE}/api/artists`);
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
      NEXT_DIST_DIR: ".next-public-artist-test",
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true
  });
  const logPath = path.join(root, "data", "zibaban-public-artist-test-server.log");
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
  console.log("=== public-artist seed / smoke (isolated DB) ===");
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
    step("start Next on isolated DB", false, "timeout — see data/zibaban-public-artist-test-server.log");
    await stopServer(server);
    process.exitCode = 1;
    return;
  }
  step("start Next on isolated DB", true, `port ${PORT}, ZIBABAN_DB_PATH set`);

  let artistCookie = "";
  let clientCookie = "";
  let artistUserId = null;

  try {
    {
      const { res, payload, cookie } = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: ARTIST_PHONE,
          password: PASSWORD,
          type: "artist",
          data: {
            name: "آرتیست تست عمومی",
            area: "جردن",
            service: "میکاپ",
            bio: "seed public-artist"
          }
        }
      });
      artistCookie = cookie;
      artistUserId = payload?.data?.user?.id || payload?.profile?.id || null;
      step(
        "POST /api/auth/register (artist)",
        res.ok && Boolean(artistCookie) && Boolean(artistUserId),
        res.ok ? `artistUserId=${artistUserId}` : `status=${res.status}`
      );
      if (!res.ok) throw new Error("artist register failed");
    }

    {
      const { res, payload } = await api("/api/artist/me", {
        method: "POST",
        cookie: artistCookie,
        body: {
          name: "میکاپ نود تست",
          price: "۲٬۵۰۰٬۰۰۰",
          duration: "۶۰ دقیقه",
          hint: "seed service"
        }
      });
      const service = payload?.data?.service;
      step(
        "POST /api/artist/me create service",
        res.status === 201 && Boolean(service?.id || service?.name),
        service ? `name=${service.name}` : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api("/api/posts", {
        method: "POST",
        cookie: artistCookie,
        body: {
          title: "نمونه‌کار تست عمومی",
          tag: "میکاپ",
          caption: "portfolio seed",
          image: "/explore-post-makeup-nude.png",
          inExplore: true,
          featured: true
        }
      });
      const post = payload?.data?.post;
      step(
        "POST /api/posts portfolio",
        res.status === 201 && Boolean(post?.id),
        post ? `id=${post.id}` : `status=${res.status}`
      );
    }

    {
      const { res, payload, cookie } = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: CLIENT_PHONE,
          password: PASSWORD,
          type: "client",
          data: { name: "مشتری تست آرتیست", area: "تهران" }
        }
      });
      clientCookie = cookie;
      const clientId = payload?.data?.user?.id || payload?.profile?.id;
      step(
        "POST /api/auth/register (client)",
        res.ok && Boolean(clientCookie) && Boolean(clientId),
        res.ok ? `clientId=${clientId}` : `status=${res.status}`
      );
      if (!res.ok) throw new Error("client register failed");
    }

    {
      const { res, payload } = await api("/api/artists");
      const artists = payload?.data?.artists || [];
      const found = artists.find((a) => Number(a.id) === Number(artistUserId) || a.name === "آرتیست تست عمومی");
      step(
        "GET /api/artists",
        res.ok && Boolean(found),
        res.ok ? `artists=${artists.length}, foundId=${found?.id ?? "no"}` : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api(`/api/artists/${artistUserId}`, { cookie: clientCookie });
      const artist = payload?.data?.artist;
      const posts = artist?.posts || [];
      const services = artist?.services || [];
      step(
        "GET /api/artists/:id details",
        res.ok && artist && (posts.length >= 1 || services.length >= 1),
        res.ok
          ? `name=${artist?.name}, posts=${posts.length}, services=${services.length}`
          : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api("/api/reviews", {
        method: "POST",
        cookie: clientCookie,
        body: {
          targetUserId: artistUserId,
          rating: 5,
          text: "عالی بود",
          service: "میکاپ نود تست"
        }
      });
      step(
        "POST /api/reviews",
        res.ok && Boolean(payload?.data?.review || payload?.review),
        res.ok ? `rating=${payload?.data?.rating || payload?.data?.review?.rating || "?"}` : `status=${res.status} ${payload.error || ""}`
      );
    }

    {
      const { res, payload } = await api("/api/follows", {
        method: "POST",
        cookie: clientCookie,
        body: { targetUserId: artistUserId }
      });
      const following = payload?.data?.following;
      step(
        "POST /api/follows",
        res.ok,
        res.ok
          ? `following=${following}, followerCount=${payload?.data?.followerCount ?? "?"}`
          : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api("/api/artist/bookings", {
        method: "POST",
        cookie: clientCookie,
        body: {
          artistUserId,
          service: "میکاپ نود تست",
          bookingDate: "امروز",
          time: "۱۱:۰۰",
          durationMinutes: 60,
          clientName: "مشتری تست آرتیست",
          clientPhone: CLIENT_PHONE
        }
      });
      const booking = payload?.data?.booking;
      if (res.status === 201 && booking) {
        step(
          "POST /api/artist/bookings (public/client path)",
          true,
          `id=${booking.id}, date=${booking.booking_date}, time=${booking.time}`
        );
      } else {
        step(
          "POST /api/artist/bookings (public/client path)",
          false,
          `FINDING: status=${res.status} code=${payload.code || ""} error=${payload.error || JSON.stringify(payload).slice(0, 120)}`
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
  console.log("rollback: node scripts/seed-public-artist-test.mjs --cleanup");

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
