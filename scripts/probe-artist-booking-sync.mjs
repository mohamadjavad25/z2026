/**
 * Quick sync probe (LOCAL ONLY): public POST /api/artist/bookings → owner GET /api/artist/me bookings.
 * Uses isolated DB; not a full smoke suite.
 *
 *   node scripts/probe-artist-booking-sync.mjs
 *   node scripts/probe-artist-booking-sync.mjs --cleanup
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-artist-sync-probe.sqlite");
const PORT = Number(process.env.ZIBABAN_ARTIST_SYNC_PROBE_PORT || 3016);
const BASE = `http://127.0.0.1:${PORT}`;
const args = new Set(process.argv.slice(2));

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

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    try {
      const res = await fetch(`${BASE}/api/artists`);
      if (res.status === 200) return true;
    } catch {
      // wait
    }
    await sleep(400);
  }
  return false;
}

function startServer() {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    cwd: root,
    env: { ...process.env, ZIBABAN_DB_PATH: TEST_DB, NEXT_DIST_DIR: ".next-artist-sync-probe", PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  child.on("exit", () => {
    try {
      writeFileSync(path.join(root, "data", "zibaban-artist-sync-probe-server.log"), Buffer.concat(chunks));
    } catch {
      // ignore
    }
  });
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  try { child.kill("SIGTERM"); } catch { /* ignore */ }
  await sleep(600);
  if (!child.killed) {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
  }
}

async function main() {
  console.log("=== probe: public booking → owner GET /api/artist/me ===");
  if (args.has("--cleanup")) {
    cleanupDbFiles();
    console.log("cleaned", TEST_DB);
    return;
  }
  cleanupDbFiles();
  const server = startServer();
  if (!(await waitForServer())) {
    console.log("FAIL server timeout");
    await stopServer(server);
    process.exitCode = 1;
    return;
  }

  try {
    const artistReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09131110001",
        password: "probe-pass",
        type: "artist",
        data: { name: "آرتیست پروب", area: "تهران", service: "میکاپ" }
      }
    });
    const artistCookie = artistReg.cookie;
    const artistId = artistReg.payload?.data?.user?.id || artistReg.payload?.profile?.id;
    console.log("artist register", artistReg.res.ok, "id=", artistId);

    await api("/api/artist/me", {
      method: "POST",
      cookie: artistCookie,
      body: { name: "خدمت پروب", price: "۱۰۰", duration: "۶۰ دقیقه" }
    });

    const before = await api("/api/artist/me", { cookie: artistCookie });
    const beforeCount = (before.payload?.data?.bookings || []).length;
    console.log("owner bookings BEFORE public book:", beforeCount);

    const clientReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09131110002",
        password: "probe-pass",
        type: "client",
        data: { name: "مشتری پروب", area: "تهران" }
      }
    });
    const clientCookie = clientReg.cookie;

    const book = await api("/api/artist/bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        artistUserId: artistId,
        service: "خدمت پروب",
        bookingDate: "امروز",
        time: "۱۲:۰۰",
        durationMinutes: 60,
        clientName: "مشتری پروب",
        clientPhone: "09131110002"
      }
    });
    console.log("public POST /api/artist/bookings", book.res.status, book.payload?.data?.booking?.id || book.payload?.error);

    const after = await api("/api/artist/me", { cookie: artistCookie });
    const afterBookings = after.payload?.data?.bookings || [];
    const afterCount = afterBookings.length;
    const found = afterBookings.some((b) => b.time === "۱۲:۰۰" || String(b.time).includes("۱۲"));
    console.log("owner bookings AFTER public book:", afterCount, "foundSlot=", found);

    const uiSyncNote = [
      "DB/API: owner GET sees public booking immediately after write.",
      "UI: confirmPublicArtistBooking does NOT call setArtistBookingList/refreshArtistWorkspace;",
      "UI only picks it up via HomeApp 8s polling GET /api/artist/me (artistBookingsEpochRef)."
    ].join(" ");
    console.log("NOTE:", uiSyncNote);

    if (book.res.status === 201 && afterCount === beforeCount + 1 && found) {
      console.log("RESULT: API sync OK (shared artist_bookings table)");
    } else {
      console.log("RESULT: FAIL unexpected sync behavior");
      process.exitCode = 1;
    }
  } catch (error) {
    console.log("FAIL", error.message || error);
    process.exitCode = 1;
  }

  await stopServer(server);
  cleanupDbFiles();
  console.log("cleanup done");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
