/**
 * Real-vs-fake salon reservation-request flow + 1-hour auto-expiry sweep
 * verification (LOCAL ONLY). Mirrors seed-salon-conflict-fix-test.mjs /
 * seed-booking-card-test.mjs for style; bookingDate pinned to "شنبه" per
 * this session's real-date-flakiness fix (defaultHours makes Friday closed
 * and Thursday close early — Saturday is always 10:00-20:00).
 *
 * Covers:
 *  1. A real client "درخواست" booking shows up via GET /api/salon-bookings
 *     (the same real data source useSalonWorkspace's reservationRequestList
 *     is now derived from — no more empty fake mock list).
 *  2. Approve: PATCH { status: "تایید شده" } on a REAL pending row (the
 *     salon-side approveReservationRequest path) actually changes the row.
 *  3. Decline: PATCH { status: "لغو", action: "cancel" } (the same cancel
 *     path patchSalonAppointment/useScheduleBookingMenu already use) on a
 *     REAL pending row actually cancels it.
 *  4. Expiry sweep: a "درخواست" row whose created_at is already >1h in the
 *     past (env-shrunk sweep interval so the test doesn't wait a real hour)
 *     gets auto-flipped to "منقضی شده" by the next sweep pass, the client
 *     gets a real booking-card chat notification about it, and the freed
 *     slot is no longer reported as unavailable to other clients.
 *
 * DB: data/zibaban-booking-expiry-test.sqlite
 *
 * Usage:
 *   node scripts/seed-booking-expiry-test.mjs
 *   node scripts/seed-booking-expiry-test.mjs --cleanup
 *
 * Env: ZIBABAN_BOOKING_EXPIRY_TEST_PORT  default 3038
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-booking-expiry-test.sqlite");
const PORT = Number(process.env.ZIBABAN_BOOKING_EXPIRY_TEST_PORT || 3038);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "booking-expiry-test";
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
      NEXT_DIST_DIR: ".next-booking-expiry-test",
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
      writeFileSync(path.join(root, "data", "zibaban-booking-expiry-test-server.log"), Buffer.concat(chunks));
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

async function main() {
  console.log("=== seed-booking-expiry-test ===");
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

    const salonReg = await register({ phone: "09140001101", type: "salon", name: "سالن انقضا تست" });
    const salonCookie = salonReg.cookie;
    const salonUserId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    step("register salon", salonReg.res.ok && Boolean(salonUserId), `id=${salonUserId}`);

    const clientReg = await register({ phone: "09140001102", type: "client", name: "مشتری انقضا تست" });
    const clientCookie = clientReg.cookie;
    const clientUserId = clientReg.payload?.data?.user?.id || clientReg.payload?.profile?.id;
    step("register client", clientReg.res.ok && Boolean(clientUserId), `id=${clientUserId}`);

    await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "خدمت تست", price: "500000", duration: "۳۰ دقیقه" }
    });

    // ── 1+2. Real pending request shows up + real approve path ─────────────
    console.log("\n--- 1+2. real pending request + approve ---");
    const bookA = await api("/api/salon-bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        salonUserId, service: "خدمت تست", bookingDate: BOOKING_DATE,
        time: "۱۰:۰۰", durationMinutes: 30, status: "درخواست"
      }
    });
    step("client booking A created as درخواست", bookA.res.status === 201, `status=${bookA.res.status} body=${JSON.stringify(bookA.payload).slice(0, 200)}`);
    const bookingAId = bookA.payload?.booking?.id;

    const salonView = await api("/api/salon-bookings", { cookie: salonCookie });
    const pendingRows = (salonView.payload?.bookings || []).filter((b) => b.status === "درخواست");
    step(
      "salon's real GET /api/salon-bookings shows the pending request (real data, not fake mock)",
      pendingRows.some((b) => Number(b.id) === Number(bookingAId)),
      `pendingCount=${pendingRows.length}`
    );

    const approve = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: bookingAId, status: "تایید شده" }
    });
    step(
      "approve: PATCH status=تایید شده succeeds and sticks",
      approve.res.status === 200 && approve.payload?.booking?.status === "تایید شده",
      `status=${approve.res.status} booking.status=${approve.payload?.booking?.status}`
    );

    // ── 3. Real decline path (same cancel mechanism as owner schedule cancel) ──
    console.log("\n--- 3. real decline path ---");
    const bookB = await api("/api/salon-bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        salonUserId, service: "خدمت تست", bookingDate: BOOKING_DATE,
        time: "۱۱:۰۰", durationMinutes: 30, status: "درخواست"
      }
    });
    step("client booking B created as درخواست", bookB.res.status === 201, `status=${bookB.res.status}`);
    const bookingBId = bookB.payload?.booking?.id;

    const decline = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: bookingBId, status: "لغو", action: "cancel" }
    });
    step(
      "decline: PATCH status=لغو/action=cancel succeeds and sticks",
      decline.res.status === 200 && decline.payload?.booking?.status === "لغو",
      `status=${decline.res.status} booking.status=${decline.payload?.booking?.status}`
    );

    // ── 4. Expiry sweep ──────────────────────────────────────────────────
    console.log("\n--- 4. expiry sweep ---");
    const bookC = await api("/api/salon-bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        salonUserId, service: "خدمت تست", bookingDate: BOOKING_DATE,
        time: "۱۲:۰۰", durationMinutes: 30, status: "درخواست"
      }
    });
    step("client booking C created as درخواست", bookC.res.status === 201, `status=${bookC.res.status}`);
    const bookingCId = bookC.payload?.booking?.id;

    // Backdate created_at directly (>1h in the past) instead of shrinking the
    // real timeout — proves the 1-hour THRESHOLD itself, not just the sweep
    // mechanics. WAL-safe: dev server also has the file open, but SQLite
    // handles single-writer-at-a-time fine for one UPDATE.
    {
      const raw = new DatabaseSync(TEST_DB);
      raw.exec("PRAGMA busy_timeout = 5000;");
      raw.prepare("UPDATE salon_bookings SET created_at = datetime('now', '-70 minutes') WHERE id = ?").run(bookingCId);
      raw.close();
    }

    // A second client checks availability BEFORE expiry: slot should be
    // reported unavailable (the pending request still holds it).
    const beforeExpiry = await api(`/api/salon-bookings?salonUserId=${salonUserId}`, { cookie: clientCookie });
    // Stored/returned time is normalized to Latin digits (normalizeBookingTimeLabel),
    // regardless of the Persian-digit literal used when creating the booking above.
    const slotBusyBefore = (beforeExpiry.payload?.unavailableSlots || []).some((s) => s.time === "12:00");
    step("before sweep: pending slot ۱۲:۰۰ still reported unavailable", slotBusyBefore, `slots=${JSON.stringify(beforeExpiry.payload?.unavailableSlots)}`);

    // Poll for the sweep (ticking every 2s per ZIBABAN_BOOKING_EXPIRY_SWEEP_MS
    // above) to flip booking C to منقضی شده.
    let expiredStatus = null;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const check = new DatabaseSync(TEST_DB);
      const row = check.prepare("SELECT status FROM salon_bookings WHERE id = ?").get(bookingCId);
      check.close();
      expiredStatus = row?.status;
      if (expiredStatus === "منقضی شده") break;
      await sleep(1000);
    }
    step("sweep auto-expires the stale درخواست row to منقضی شده", expiredStatus === "منقضی شده", `status=${expiredStatus}`);

    // Freed slot: a second client should now see ۱۲:۰۰ as available again.
    const afterExpiry = await api(`/api/salon-bookings?salonUserId=${salonUserId}`, { cookie: clientCookie });
    const slotBusyAfter = (afterExpiry.payload?.unavailableSlots || []).some((s) => s.time === "12:00");
    step("after sweep: expired slot ۱۲:۰۰ is freed (no longer unavailable)", !slotBusyAfter, `slots=${JSON.stringify(afterExpiry.payload?.unavailableSlots)}`);

    // Real chat notification: a booking-card message referencing bookingC,
    // showing the live (expired) status, must exist in the client<->salon
    // conversation.
    const convo = await findConversationWith(clientCookie, salonUserId);
    step("client<->salon conversation exists", Boolean(convo));
    if (convo) {
      const { payload } = await api(`/api/conversations/${convo.id}/messages`, { cookie: clientCookie });
      const msgs = payload?.data?.messages || [];
      const expiryCard = msgs.find((m) => m.attachmentType === "salon-booking" && Number(m.booking?.id) === Number(bookingCId) && m.booking?.status === "منقضی شده");
      step("client got a real booking-card chat notification with status منقضی شده", Boolean(expiryCard), JSON.stringify(expiryCard));
    }
  } catch (err) {
    step("unexpected error", false, String(err?.stack || err));
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nBOOKING EXPIRY TEST: ${passed}/${total} passed`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
