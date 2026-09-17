/**
 * Isolated artist-owner seed + smoke (LOCAL ONLY).
 *
 * Uses: data/zibaban-artist-owner-test.sqlite (never data/zibaban.sqlite)
 *
 * Covers:
 * - owner GET /api/artist/me after public POST /api/artist/bookings (DB sync)
 * - simulated onArtistBookingCreated callback (same artist session) → immediate list refresh
 * - epoch race: stale poll must not overwrite a fresher refresh
 *
 * Usage:
 *   node scripts/seed-artist-owner-test.mjs
 *   node scripts/seed-artist-owner-test.mjs --cleanup
 *
 * Env: ZIBABAN_ARTIST_OWNER_TEST_PORT  default 3017
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-artist-owner-test.sqlite");
const PORT = Number(process.env.ZIBABAN_ARTIST_OWNER_TEST_PORT || 3017);
const BASE = `http://127.0.0.1:${PORT}`;
const ARTIST_PHONE = "09132000001";
const CLIENT_PHONE = "09132000002";
const PASSWORD = "artist-owner-test";

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
      NEXT_DIST_DIR: ".next-artist-owner-test",
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true
  });
  const logPath = path.join(root, "data", "zibaban-artist-owner-test-server.log");
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
  try { child.kill("SIGTERM"); } catch { /* ignore */ }
  await sleep(700);
  if (!child.killed) {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
  }
}

/**
 * Mirrors useArtistWorkspace epoch + list apply rules (no React).
 * - refreshArtistWorkspace: bump epoch, then apply only if epoch still matches
 * - refreshArtistBookingsOnly (poll): capture epoch without bump; apply only if unchanged
 * - notifyArtistBookingCreated: if same artist, bump then full refresh
 */
function createArtistWorkspaceSim(fetchBookings) {
  let epoch = 0;
  let artistBookingList = [];
  const createdProfile = { type: "artist", id: null };

  async function refreshArtistWorkspace() {
    const myEpoch = ++epoch;
    const bookings = await fetchBookings();
    if (myEpoch === epoch) {
      artistBookingList = bookings;
    }
    return { myEpoch, applied: myEpoch === epoch, count: artistBookingList.length };
  }

  async function refreshArtistBookingsOnly() {
    const myEpoch = epoch;
    const bookings = await fetchBookings();
    if (myEpoch === epoch) {
      artistBookingList = bookings;
    }
    return { myEpoch, applied: myEpoch === epoch, count: artistBookingList.length };
  }

  async function notifyArtistBookingCreated(artistUserId) {
    if (createdProfile.type !== "artist") return { skipped: true };
    if (String(createdProfile.id) !== String(artistUserId)) return { skipped: true };
    epoch += 1;
    return refreshArtistWorkspace();
  }

  return {
    createdProfile,
    get epoch() { return epoch; },
    get artistBookingList() { return artistBookingList; },
    setArtistBookingList(list) { artistBookingList = list; },
    bumpEpoch() { epoch += 1; return epoch; },
    refreshArtistWorkspace,
    refreshArtistBookingsOnly,
    notifyArtistBookingCreated
  };
}

async function main() {
  console.log("=== seed-artist-owner-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleanup done");
    return;
  }

  cleanupDbFiles();
  const server = startTestServer();
  if (!(await waitForServer())) {
    step("server ready", false, "timeout");
    await stopServer(server);
    process.exitCode = 1;
    return;
  }
  step("server ready", true, `:${PORT}`);

  try {
    const artistReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: ARTIST_PHONE,
        password: PASSWORD,
        type: "artist",
        data: { name: "آرتیست Owner تست", area: "تهران", service: "میکاپ" }
      }
    });
    const artistCookie = artistReg.cookie;
    const artistId = artistReg.payload?.data?.user?.id || artistReg.payload?.profile?.id;
    step("register artist", artistReg.res.ok && Boolean(artistId), `id=${artistId}`);

    const svc = await api("/api/artist/me", {
      method: "POST",
      cookie: artistCookie,
      body: { name: "میکاپ تست", price: "۲۰۰", duration: "۶۰ دقیقه" }
    });
    step("create artist service", svc.res.status === 201 || svc.res.ok);

    const meBefore = await api("/api/artist/me", { cookie: artistCookie });
    const beforeCount = (meBefore.payload?.data?.bookings || []).length;
    step("owner workspace empty-ish", meBefore.res.ok, `bookings=${beforeCount}`);

    const clientReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: CLIENT_PHONE,
        password: PASSWORD,
        type: "client",
        data: { name: "مشتری Owner تست", area: "تهران" }
      }
    });
    const clientCookie = clientReg.cookie;
    step("register client", clientReg.res.ok, `cookie=${Boolean(clientCookie)}`);

    const book = await api("/api/artist/bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        artistUserId: artistId,
        service: "میکاپ تست",
        bookingDate: "امروز",
        time: "۱۵:۰۰",
        durationMinutes: 60,
        clientName: "مشتری Owner تست",
        clientPhone: CLIENT_PHONE
      }
    });
    step(
      "public POST /api/artist/bookings",
      book.res.status === 201,
      `status=${book.res.status} id=${book.payload?.data?.booking?.id || "?"}`
    );

    const meAfter = await api("/api/artist/me", { cookie: artistCookie });
    const afterBookings = meAfter.payload?.data?.bookings || [];
    const found = afterBookings.some((b) => String(b.time || "").includes("۱۵"));
    step(
      "owner GET sees public booking (DB)",
      meAfter.res.ok && afterBookings.length === beforeCount + 1 && found,
      `count=${afterBookings.length} foundSlot=${found}`
    );

    // --- Simulate React owner session + callback (no poll wait) ---
    const sim = createArtistWorkspaceSim(async () => {
      const me = await api("/api/artist/me", { cookie: artistCookie });
      return me.payload?.data?.bookings || [];
    });
    sim.createdProfile.id = artistId;
    sim.setArtistBookingList([]);

    const cb = await sim.notifyArtistBookingCreated(artistId);
    step(
      "callback notifyArtistBookingCreated refreshes list immediately",
      !cb.skipped && cb.applied && sim.artistBookingList.length >= 1,
      `count=${sim.artistBookingList.length} epoch=${sim.epoch}`
    );

    const skipped = await sim.notifyArtistBookingCreated(999999);
    step(
      "callback no-op for other artistUserId",
      Boolean(skipped.skipped),
      "skipped"
    );

    // --- Race: stale poll must not clobber fresher refresh ---
    const race = createArtistWorkspaceSim(async () => {
      const me = await api("/api/artist/me", { cookie: artistCookie });
      return me.payload?.data?.bookings || [];
    });
    race.createdProfile.id = artistId;
    race.setArtistBookingList([]);

    // Capture a "stale" poll epoch while list is still empty, delay apply
    const staleEpoch = race.epoch; // 0
    const staleBookingsSnapshot = []; // pretend poll started before public write was visible
    // Public booking already in DB; start refresh (bumps epoch) like callback/manual tab refresh
    const refreshResult = await race.refreshArtistWorkspace();
    // Stale poll tries to apply empty list with old epoch
    if (staleEpoch === race.epoch) {
      race.setArtistBookingList(staleBookingsSnapshot);
    }
    const raceOk = race.artistBookingList.length >= afterBookings.length
      && race.artistBookingList.length >= 1
      && refreshResult.applied;
    step(
      "epoch race: stale poll discarded; final list not older than reality",
      raceOk,
      `final=${race.artistBookingList.length} expected>=${afterBookings.length} epoch=${race.epoch}`
    );

    // Extra race: overlapping refresh — older in-flight must not win
    const race2 = createArtistWorkspaceSim(async () => {
      const me = await api("/api/artist/me", { cookie: artistCookie });
      return me.payload?.data?.bookings || [];
    });
    race2.createdProfile.id = artistId;
    race2.setArtistBookingList([{ id: "stale-local", time: "۰۰:۰۰" }]);

    const firstEpoch = race2.bumpEpoch(); // simulate refresh A start (capture epoch)
    // refresh B starts and finishes first
    const b = await race2.refreshArtistWorkspace();
    // refresh A finishes late with fewer bookings — must not apply
    const lateBookings = [{ id: "late-stale" }];
    if (firstEpoch === race2.epoch) {
      race2.setArtistBookingList(lateBookings);
    }
    const overlapOk = race2.artistBookingList.length >= 1
      && !race2.artistBookingList.some((x) => x.id === "late-stale")
      && b.applied;
    step(
      "epoch race: overlapping refresh — older response discarded",
      overlapOk,
      `finalIds=${race2.artistBookingList.map((x) => x.id).join(",")}`
    );

    // Owner booking path still works
    const ownerBook = await api("/api/artist/me", {
      method: "POST",
      cookie: artistCookie,
      body: {
        kind: "booking",
        client: "رزرو Owner",
        phone: "09120000000",
        service: "میکاپ تست",
        time: "۱۷:۰۰",
        date: "امروز",
        status: "تایید"
      }
    });
    step(
      "owner POST kind:booking",
      ownerBook.res.status === 201 || ownerBook.res.ok,
      `status=${ownerBook.res.status}`
    );

    const meFinal = await api("/api/artist/me", { cookie: artistCookie });
    const finalCount = (meFinal.payload?.data?.bookings || []).length;
    step(
      "final owner bookings >= 2",
      finalCount >= 2,
      `count=${finalCount}`
    );
  } catch (error) {
    step("unexpected error", false, error.message || String(error));
    process.exitCode = 1;
  }

  const failed = report.filter((r) => !r.ok);
  console.log("---");
  console.log(failed.length ? `FAILED ${failed.length}/${report.length}` : `ALL PASSED ${report.length}/${report.length}`);

  if (!keepServer) {
    await stopServer(server);
    cleanupDbFiles();
    console.log("cleanup done (--cleanup equivalent after run)");
  } else {
    console.log("server kept on", BASE);
  }

  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
