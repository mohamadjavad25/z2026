/**
 * Real-vs-fake DIRECT artist-booking confirm/decline flow + 1-hour
 * auto-expiry sweep verification (LOCAL ONLY). Mirrors
 * seed-booking-expiry-test.mjs (the salon equivalent) for style;
 * bookingDate pinned to "شنبه" for the same real-date-flakiness reason.
 *
 * Covers:
 *  1. A real client "تازه" direct artist booking (POST /api/artist/bookings,
 *     no salon involved) shows up via GET /api/artist/me — the same real
 *     data source pendingArtistBookingRequests (useArtistWorkspace.js /
 *     HomeApp.jsx) is now derived from.
 *  2. Confirm: PATCH /api/artist/me { kind: "booking", status: "تایید شده" }
 *     on a REAL pending row (confirmArtistBookingRequest path) actually
 *     changes the row, and a stranger (not the owning artist) is rejected.
 *  3. Decline: PATCH /api/artist/me { kind: "booking", status: "لغو",
 *     action: "cancel" } (declineArtistBookingRequest path) actually
 *     cancels it.
 *  4. Expiry sweep: a "تازه" DIRECT row (source_salon_user_id IS NULL)
 *     whose created_at is already >1h in the past (env-shrunk sweep
 *     interval) gets auto-flipped to "منقضی شده" by the next sweep pass,
 *     the client gets a real artist-booking-card chat notification, and the
 *     freed slot is no longer reported in the artist's public bookedSlots.
 *  5. A SALON-linked artist_bookings mirror row is NOT double-swept by the
 *     new direct-artist sweep logic: it expires exactly once (via the
 *     salon-side sweep path), with exactly one chat notification, not two.
 *
 * DB: data/zibaban-artist-booking-expiry-test.sqlite
 *
 * Usage:
 *   node scripts/seed-artist-booking-expiry-test.mjs
 *   node scripts/seed-artist-booking-expiry-test.mjs --cleanup
 *
 * Env: ZIBABAN_ARTIST_BOOKING_EXPIRY_TEST_PORT  default 3039
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-artist-booking-expiry-test.sqlite");
const PORT = Number(process.env.ZIBABAN_ARTIST_BOOKING_EXPIRY_TEST_PORT || 3039);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "artist-booking-expiry-test";
const BOOKING_DATE = "شنبه"; // pinned — see header comment

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

if (doCleanupOnly) {
  cleanupDbFiles();
  console.log("cleaned up");
  process.exit(0);
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
      ZIBABAN_DB_PATH: TEST_DB,
      NEXT_DIST_DIR: ".next-artist-booking-expiry-test",
      PORT: String(PORT),
      // Shrink the sweep TICK interval so the test doesn't wait the real
      // 3-minute default — the 1-hour TIMEOUT itself is proven separately by
      // backdating created_at directly, not by shrinking the timeout too.
      ZIBABAN_BOOKING_EXPIRY_SWEEP_MS: "2000"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  child.on("exit", () => {
    try {
      writeFileSync(path.join(root, "data", "zibaban-artist-booking-expiry-test-server.log"), Buffer.concat(chunks));
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

async function register({ phone, type, name }) {
  return api("/api/auth/register", {
    method: "POST",
    body: { phone, password: PASSWORD, type, data: { name, area: "تهران" } }
  });
}

async function findConversationWith(cookie, peerUserId) {
  const { payload } = await api("/api/conversations", { cookie });
  const list = payload?.data?.conversations || [];
  return list.find((c) => c.peer?.id === peerUserId) || null;
}

function backdateCreatedAt(table, id, minutesAgo) {
  const raw = new DatabaseSync(TEST_DB);
  raw.exec("PRAGMA busy_timeout = 5000;");
  raw.prepare(`UPDATE ${table} SET created_at = datetime('now', ?) WHERE id = ?`).run(`-${minutesAgo} minutes`, id);
  raw.close();
}

function readStatus(table, id) {
  const raw = new DatabaseSync(TEST_DB);
  const row = raw.prepare(`SELECT status FROM ${table} WHERE id = ?`).get(id);
  raw.close();
  return row?.status;
}

async function main() {
  console.log("=== seed-artist-booking-expiry-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) {
      process.exitCode = 1;
      return;
    }

    const artistReg = await register({ phone: "09150001101", type: "artist", name: "آرتیست انقضا تست" });
    const artistCookie = artistReg.cookie;
    const artistUserId = artistReg.payload?.data?.user?.id || artistReg.payload?.profile?.id;
    step("register independent artist", artistReg.res.ok && Boolean(artistUserId), `id=${artistUserId}`);

    const clientReg = await register({ phone: "09150001102", type: "client", name: "مشتری انقضا تست" });
    const clientCookie = clientReg.cookie;
    const clientUserId = clientReg.payload?.data?.user?.id || clientReg.payload?.profile?.id;
    step("register client", clientReg.res.ok && Boolean(clientUserId), `id=${clientUserId}`);

    // ── 1+2. Real pending direct booking + real confirm path ───────────────
    console.log("\n--- 1+2. real pending direct booking + confirm ---");
    const bookA = await api("/api/artist/bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        artistUserId, service: "خدمت تست", bookingDate: BOOKING_DATE,
        time: "۱۰:۰۰", durationMinutes: 30
      }
    });
    step("client direct booking A created as تازه (default status)", bookA.res.status === 201, `status=${bookA.res.status} body=${JSON.stringify(bookA.payload).slice(0, 200)}`);
    const bookingAId = bookA.payload?.data?.booking?.id;

    const artistMeView = await api("/api/artist/me", { cookie: artistCookie });
    const pendingRows = (artistMeView.payload?.data?.bookings || []).filter((b) => b.status === "تازه");
    step(
      "artist's real GET /api/artist/me shows the pending request (real data, not mock)",
      pendingRows.some((b) => Number(b.id) === Number(bookingAId)),
      `pendingCount=${pendingRows.length}`
    );

    const strangerReg = await register({ phone: "09150001103", type: "artist", name: "آرتیست غریبه" });
    const strangerConfirm = await api("/api/artist/me", {
      method: "PATCH",
      cookie: strangerReg.cookie,
      body: { kind: "booking", id: bookingAId, status: "تایید شده" }
    });
    step(
      "ownership check: a different artist cannot confirm someone else's booking",
      strangerConfirm.res.status === 404,
      `status=${strangerConfirm.res.status}`
    );

    const confirm = await api("/api/artist/me", {
      method: "PATCH",
      cookie: artistCookie,
      body: { kind: "booking", id: bookingAId, status: "تایید شده" }
    });
    step(
      "confirm: PATCH kind=booking status=تایید شده succeeds and sticks",
      confirm.res.status === 200 && confirm.payload?.data?.booking?.status === "تایید شده",
      `status=${confirm.res.status} booking.status=${confirm.payload?.data?.booking?.status}`
    );

    // ── 3. Real decline path ────────────────────────────────────────────────
    console.log("\n--- 3. real decline path ---");
    const bookB = await api("/api/artist/bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        artistUserId, service: "خدمت تست", bookingDate: BOOKING_DATE,
        time: "۱۱:۰۰", durationMinutes: 30
      }
    });
    step("client direct booking B created as تازه", bookB.res.status === 201, `status=${bookB.res.status}`);
    const bookingBId = bookB.payload?.data?.booking?.id;

    const decline = await api("/api/artist/me", {
      method: "PATCH",
      cookie: artistCookie,
      body: { kind: "booking", id: bookingBId, status: "لغو", action: "cancel" }
    });
    step(
      "decline: PATCH kind=booking status=لغو/action=cancel succeeds and sticks",
      decline.res.status === 200 && decline.payload?.data?.booking?.status === "لغو",
      `status=${decline.res.status} booking.status=${decline.payload?.data?.booking?.status}`
    );

    // ── 4. Expiry sweep (direct booking) ────────────────────────────────────
    console.log("\n--- 4. expiry sweep (direct booking) ---");
    const bookC = await api("/api/artist/bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        artistUserId, service: "خدمت تست", bookingDate: BOOKING_DATE,
        time: "۱۲:۰۰", durationMinutes: 30
      }
    });
    step("client direct booking C created as تازه", bookC.res.status === 201, `status=${bookC.res.status}`);
    const bookingCId = bookC.payload?.data?.booking?.id;

    backdateCreatedAt("artist_bookings", bookingCId, 70);

    // Before expiry: public artist profile should still report ۱۲:۰۰ as booked.
    const beforeExpiry = await api(`/api/artists/${artistUserId}`, { cookie: clientCookie });
    const slotBusyBefore = (beforeExpiry.payload?.data?.artist?.bookedSlots || []).some((s) => s.time === "12:00");
    step("before sweep: pending slot ۱۲:۰۰ still reported booked", slotBusyBefore, `slots=${JSON.stringify(beforeExpiry.payload?.data?.artist?.bookedSlots)}`);

    let expiredStatus = null;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      expiredStatus = readStatus("artist_bookings", bookingCId);
      if (expiredStatus === "منقضی شده") break;
      await sleep(1000);
    }
    step("sweep auto-expires the stale تازه direct row to منقضی شده", expiredStatus === "منقضی شده", `status=${expiredStatus}`);

    const afterExpiry = await api(`/api/artists/${artistUserId}`, { cookie: clientCookie });
    const slotBusyAfter = (afterExpiry.payload?.data?.artist?.bookedSlots || []).some((s) => s.time === "12:00");
    step("after sweep: expired slot ۱۲:۰۰ is freed (no longer booked)", !slotBusyAfter, `slots=${JSON.stringify(afterExpiry.payload?.data?.artist?.bookedSlots)}`);

    const directConvo = await findConversationWith(clientCookie, artistUserId);
    step("client<->artist conversation exists", Boolean(directConvo));
    if (directConvo) {
      const { payload } = await api(`/api/conversations/${directConvo.id}/messages`, { cookie: clientCookie });
      const msgs = payload?.data?.messages || [];
      const expiryCard = msgs.find((m) => m.attachmentType === "artist-booking" && Number(m.booking?.id) === Number(bookingCId) && m.booking?.status === "منقضی شده");
      step("client got a real artist-booking-card chat notification with status منقضی شده", Boolean(expiryCard), JSON.stringify(expiryCard));
    }

    // ── 5. Salon-linked mirror is NOT double-swept ──────────────────────────
    console.log("\n--- 5. salon-linked artist_bookings mirror not double-swept ---");
    const salonReg = await register({ phone: "09150001104", type: "salon", name: "سالن انقضا تست" });
    const salonCookie = salonReg.cookie;
    const salonUserId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    step("register salon", salonReg.res.ok && Boolean(salonUserId), `id=${salonUserId}`);

    const linkedArtistReg = await register({ phone: "09150001105", type: "artist", name: "آرتیست پیوندی تست" });
    const linkedArtistCookie = linkedArtistReg.cookie;
    const linkedArtistUserId = linkedArtistReg.payload?.data?.user?.id || linkedArtistReg.payload?.profile?.id;
    step("register linked artist", linkedArtistReg.res.ok && Boolean(linkedArtistUserId), `id=${linkedArtistUserId}`);

    await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "خدمت پیوندی", price: "500000", duration: "۳۰ دقیقه" }
    });
    const staffRes = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: { artistUserId: linkedArtistUserId, name: "آرتیست پیوندی تست", role: "خدمت پیوندی" }
    });
    step("linked staff created", staffRes.res.status === 201, `status=${staffRes.res.status}`);

    const salonClientReg = await register({ phone: "09150001106", type: "client", name: "مشتری سالن پیوندی" });
    const salonClientCookie = salonClientReg.cookie;
    const salonClientUserId = salonClientReg.payload?.data?.user?.id || salonClientReg.payload?.profile?.id;

    const linkedBooking = await api("/api/salon-bookings", {
      method: "POST",
      cookie: salonClientCookie,
      body: {
        salonUserId, service: "خدمت پیوندی", staff: "آرتیست پیوندی تست", bookingDate: BOOKING_DATE,
        time: "۱۳:۰۰", durationMinutes: 30, status: "درخواست"
      }
    });
    step("client books salon with linked staff", linkedBooking.res.status === 201, `status=${linkedBooking.res.status} body=${JSON.stringify(linkedBooking.payload).slice(0, 300)}`);
    const salonBookingId = linkedBooking.payload?.booking?.id;
    const mirrorArtistBookingId = linkedBooking.payload?.artistBooking?.id;
    step("linked artist_bookings mirror row was created", Boolean(mirrorArtistBookingId), `mirrorId=${mirrorArtistBookingId}`);

    // Only the salon row's created_at needs backdating — the salon sweep
    // path keys off salon_bookings.created_at, not the mirror's.
    backdateCreatedAt("salon_bookings", salonBookingId, 70);

    let salonExpiredStatus = null;
    let mirrorExpiredStatus = null;
    const deadline2 = Date.now() + 20_000;
    while (Date.now() < deadline2) {
      salonExpiredStatus = readStatus("salon_bookings", salonBookingId);
      mirrorExpiredStatus = mirrorArtistBookingId ? readStatus("artist_bookings", mirrorArtistBookingId) : null;
      if (salonExpiredStatus === "منقضی شده" && mirrorExpiredStatus === "منقضی شده") break;
      await sleep(1000);
    }
    step("salon row expired to منقضی شده", salonExpiredStatus === "منقضی شده", `status=${salonExpiredStatus}`);
    step("linked artist_bookings mirror expired exactly via the salon-side sync (منقضی شده)", mirrorExpiredStatus === "منقضی شده", `status=${mirrorExpiredStatus}`);

    // Give the direct-artist sweep pass(es) a couple more ticks to prove it
    // does NOT touch this salon-linked mirror a second time.
    await sleep(4000);
    const stillOnce = readStatus("artist_bookings", mirrorArtistBookingId);
    step("mirror status unchanged by further sweep ticks (not re-processed)", stillOnce === "منقضی شده", `status=${stillOnce}`);

    const linkedConvo = await findConversationWith(salonClientCookie, salonUserId);
    let salonExpiryCardCount = 0;
    if (linkedConvo) {
      const { payload } = await api(`/api/conversations/${linkedConvo.id}/messages`, { cookie: salonClientCookie });
      const msgs = payload?.data?.messages || [];
      // Distinguish the SWEEP's own expiry notification (always sent as the
      // salon owner — see notifyClientOfExpiry) from the unrelated creation-time
      // card POST /api/salon-bookings already sends (sent as the booking client,
      // both cards legitimately re-render the SAME live "منقضی شده" status once
      // expired via enrichBookingCards — that's expected, not a double-sweep bug).
      // What this guards against is the sweep itself calling notifyClientOfExpiry
      // more than once for the same row.
      salonExpiryCardCount = msgs.filter((m) => (
        m.attachmentType === "salon-booking"
        && Number(m.booking?.id) === Number(salonBookingId)
        && Number(m.senderUserId) === Number(salonUserId)
      )).length;
    }
    step("exactly one sweep-sent salon expiry notification (no duplicate sweep firing)", salonExpiryCardCount === 1, `count=${salonExpiryCardCount}`);

    // The mirror row's own artist_user_id is linkedArtistUserId; the direct
    // artist sweep must NOT have separately messaged the salon client via an
    // "artist-booking" card for this same mirror row (that would be the
    // double-processing bug this test guards against).
    const directArtistConvo = await findConversationWith(salonClientCookie, linkedArtistUserId);
    let artistCardCount = 0;
    if (directArtistConvo) {
      const { payload } = await api(`/api/conversations/${directArtistConvo.id}/messages`, { cookie: salonClientCookie });
      const msgs = payload?.data?.messages || [];
      artistCardCount = msgs.filter((m) => m.attachmentType === "artist-booking" && Number(m.booking?.id) === Number(mirrorArtistBookingId)).length;
    }
    step("no separate artist-booking expiry card for the salon-linked mirror (no double notification)", artistCardCount === 0, `count=${artistCardCount}`);
  } catch (err) {
    step("unexpected error", false, String(err?.stack || err));
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nARTIST BOOKING EXPIRY TEST: ${passed}/${total} passed`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
