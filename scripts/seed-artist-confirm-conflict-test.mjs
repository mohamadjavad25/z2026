/**
 * QA probe (LOCAL ONLY): does confirming a DIRECT artist_bookings row run
 * ANY slot-conflict check, the way the salon approve path
 * (patchSalonBookingWithArtistSync -> updateSalonBookingInTx findOverlapConflict)
 * does? Suspicion from reading app/api/artist/me/route.js patchOwnArtistBooking
 * + app/lib/db/repos/artists.js updateArtistBookingRow: NO conflict check
 * anywhere in that path.
 *
 * Repro:
 *  1. Client A books artist for Saturday 10:00 -> fresh status (booking1).
 *  2. Backdate booking1 created_at, let the real sweep expire it (frees slot).
 *  3. Client B books the SAME now-free slot (booking2) -> succeeds.
 *  4. Artist PATCHes booking1 (the stale expired one) to confirmed status.
 *  5. Assert at most one ACTIVE booking exists for that slot afterward.
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-artist-confirm-conflict-test.sqlite");
const PORT = Number(process.env.ZIBABAN_ARTIST_CONFIRM_CONFLICT_TEST_PORT || 3041);
const BASE = "http://127.0.0.1:" + PORT;
const PASSWORD = "artist-confirm-conflict-test";
const BOOKING_DATE_FA = String.fromCharCode(1588,1606,1576,1607);
const TIME_LABEL = "\u06F1\u06F0:\u06F0\u06F0";

const report = [];
function step(title, ok, detail) {
  const line = (ok ? "PASS " : "FAIL ") + title + (detail ? " -- " + detail : "");
  report.push({ ok: ok, title: title, detail: detail, line: line });
  console.log(line);
}

function cleanupDbFiles() {
  const suffixes = ["", "-wal", "-shm", "-journal"];
  for (let i = 0; i < suffixes.length; i++) {
    const file = TEST_DB + suffixes[i];
    if (existsSync(file)) rmSync(file, { force: true });
  }
}

function parseCookie(res) {
  const raw = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : [res.headers.get("set-cookie")].filter(Boolean);
  const match = raw.join(",").match(/zibaban_session=([^;]+)/);
  return match ? match[1] : "";
}

async function apiCall(pathname, opts) {
  opts = opts || {};
  const method = opts.method || "GET";
  const body = opts.body;
  const cookie = opts.cookie;
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = "zibaban_session=" + cookie;
  const res = await fetch(BASE + pathname, {
    method: method,
    headers: headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await res.json().catch(function () { return {}; });
  return { res: res, payload: payload, cookie: parseCookie(res) || cookie || "" };
}

async function waitForServer(timeoutMs) {
  timeoutMs = timeoutMs || 90000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(BASE + "/api/salons");
      if (res.status === 200) return true;
    } catch (e) {}
    await sleep(500);
  }
  return false;
}

function startTestServer() {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    cwd: root,
    env: Object.assign({}, process.env, {
      ZIBABAN_DB_PATH: TEST_DB,
      NEXT_DIST_DIR: ".next-artist-confirm-conflict-test",
      PORT: String(PORT),
      ZIBABAN_BOOKING_EXPIRY_SWEEP_MS: "2000"
    }),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", function (b) { chunks.push(b); });
  child.stderr.on("data", function (b) { chunks.push(b); });
  child.on("exit", function () {
    try {
      writeFileSync(path.join(root, "data", "zibaban-artist-confirm-conflict-test-server.log"), Buffer.concat(chunks));
    } catch (e) {}
  });
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  try { child.kill("SIGTERM"); } catch (e) {}
  await sleep(700);
  if (!child.killed) {
    try { child.kill("SIGKILL"); } catch (e) {}
  }
}

async function register(opts) {
  return apiCall("/api/auth/register", {
    method: "POST",
    body: { phone: opts.phone, password: PASSWORD, type: opts.type, data: { name: opts.name, area: "\u062A\u0647\u0631\u0627\u0646" } }
  });
}

async function main() {
  console.log("=== seed-artist-confirm-conflict-test ===");
  console.log("DB: " + TEST_DB + " PORT: " + PORT);
  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) { process.exitCode = 1; return; }

    const artistReg = await register({ phone: "09150002201", type: "artist", name: "artist-conflict-test" });
    const artistCookie = artistReg.cookie;
    const artistUserId = (artistReg.payload && artistReg.payload.data && artistReg.payload.data.user && artistReg.payload.data.user.id)
      || (artistReg.payload && artistReg.payload.profile && artistReg.payload.profile.id);
    step("register independent artist", artistReg.res.ok && Boolean(artistUserId), "id=" + artistUserId);

    const clientA = await register({ phone: "09150002202", type: "client", name: "client-A" });
    const clientB = await register({ phone: "09150002203", type: "client", name: "client-B" });
    step("register client A", clientA.res.ok);
    step("register client B", clientB.res.ok);

    const book1 = await apiCall("/api/artist/bookings", {
      method: "POST",
      cookie: clientA.cookie,
      body: { artistUserId: artistUserId, service: "test-service", bookingDate: BOOKING_DATE_FA, time: TIME_LABEL, durationMinutes: 30 }
    });
    const booking1Id = book1.payload && book1.payload.data && book1.payload.data.booking && book1.payload.data.booking.id;
    step("client A booking1 created", book1.res.status === 201, "status=" + book1.res.status + " id=" + booking1Id + " body=" + JSON.stringify(book1.payload).slice(0, 200));

    {
      const raw = new DatabaseSync(TEST_DB);
      raw.exec("PRAGMA busy_timeout = 5000;");
      raw.prepare("UPDATE artist_bookings SET created_at = datetime('now', '-70 minutes') WHERE id = ?").run(booking1Id);
      raw.close();
    }
    let expiredStatus = null;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const check = new DatabaseSync(TEST_DB);
      const row = check.prepare("SELECT status FROM artist_bookings WHERE id = ?").get(booking1Id);
      check.close();
      expiredStatus = row && row.status;
      if (expiredStatus === "\u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647") break;
      await sleep(1000);
    }
    step("sweep auto-expired booking1", expiredStatus === "\u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647", "status=" + expiredStatus);

    const book2 = await apiCall("/api/artist/bookings", {
      method: "POST",
      cookie: clientB.cookie,
      body: { artistUserId: artistUserId, service: "test-service", bookingDate: BOOKING_DATE_FA, time: TIME_LABEL, durationMinutes: 30 }
    });
    const booking2Id = book2.payload && book2.payload.data && book2.payload.data.booking && book2.payload.data.booking.id;
    step("client B booking2 succeeds on the freed slot", book2.res.status === 201, "status=" + book2.res.status + " id=" + booking2Id + " body=" + JSON.stringify(book2.payload).slice(0, 200));

    const confirmStale = await apiCall("/api/artist/me", {
      method: "PATCH",
      cookie: artistCookie,
      body: { kind: "booking", id: booking1Id, status: "\u062A\u0627\u06CC\u06CC\u062F \u0634\u062F\u0647" }
    });
    step(
      "BUG CHECK: confirming already-EXPIRED booking1 while booking2 holds the same slot",
      true,
      "status=" + confirmStale.res.status + " resultingStatus=" + (confirmStale.payload && confirmStale.payload.data && confirmStale.payload.data.booking && confirmStale.payload.data.booking.status) + " body=" + JSON.stringify(confirmStale.payload).slice(0, 300)
    );

    const raw2 = new DatabaseSync(TEST_DB);
    const cancelWord = "\u0644\u063A\u0648";
    const cancelWord2 = "\u0644\u063A\u0648 \u0634\u062F\u0647";
    const expiredWord = "\u0645\u0646\u0642\u0636\u06CC \u0634\u062F\u0647";
    const activeRows = raw2.prepare(
      "SELECT id, status, booking_date, time FROM artist_bookings WHERE artist_user_id = ? AND time = ? AND status NOT IN (?, ?, ?, ?)"
    ).all(artistUserId, "10:00", cancelWord, cancelWord2, "cancelled", expiredWord);
    raw2.close();
    step(
      "double-booking check: at most 1 ACTIVE booking should exist for that slot after the confirm",
      activeRows.length <= 1,
      "activeRows=" + JSON.stringify(activeRows)
    );
  } catch (err) {
    step("unexpected error", false, String((err && err.stack) || err));
  } finally {
    await stopServer(child);
  }

  const passed = report.filter(function (r) { return r.ok; }).length;
  const total = report.length;
  console.log("\nARTIST CONFIRM CONFLICT TEST: " + passed + "/" + total + " passed");
  console.log("(The BUG CHECK and double-booking check lines are what matter here, not the pass count alone.)");
}

main().catch(function (err) {
  console.error(err);
  process.exitCode = 1;
});
