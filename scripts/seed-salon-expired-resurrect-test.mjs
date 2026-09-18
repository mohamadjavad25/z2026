/**
 * QA regression (LOCAL ONLY): PATCH /api/salon-bookings must not be able to
 * silently resurrect an already-expired ("منقضی شده") booking request back
 * to "تایید شده" — the client was already told via bookingExpirySweep.js
 * that the salon never answered in time and the slot was freed; a stale
 * "تایید" button click (unrefreshed UI) must not un-expire it with zero
 * notification. Mirrors seed-artist-confirm-conflict-test.mjs for style,
 * but on the salon side, and asserts the companion fix in
 * patchSalonBookingWithArtistSync (app/lib/db/repos/salons/bookings.js).
 *
 * Covers:
 *  1. A real "درخواست" salon booking that gets swept to "منقضی شده".
 *  2. Confirming it (PATCH status: "تایید شده") is rejected with 409 and the
 *     row stays "منقضی شده" (the bug this test targets).
 *  3. Cancelling an already-expired row is left alone (no new 409 guard on
 *     the cancel-to-"لغو" path — that's intentionally still allowed as a
 *     harmless no-op-ish write).
 *  4. Regression guard: confirming a normal (non-expired) "درخواست" booking
 *     still works exactly as before.
 *
 * DB: data/zibaban-salon-expired-resurrect-test.sqlite
 *
 * Usage:
 *   node scripts/seed-salon-expired-resurrect-test.mjs
 *
 * Env: ZIBABAN_SALON_EXPIRED_RESURRECT_TEST_PORT  default 3042
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-salon-expired-resurrect-test.sqlite");
const PORT = Number(process.env.ZIBABAN_SALON_EXPIRED_RESURRECT_TEST_PORT || 3042);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "salon-expired-resurrect-test";
const BOOKING_DATE = "شنبه"; // pinned — see seed-booking-expiry-test.mjs header comment

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
      NEXT_DIST_DIR: ".next-salon-expired-resurrect-test",
      PORT: String(PORT),
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
      writeFileSync(path.join(root, "data", "zibaban-salon-expired-resurrect-test-server.log"), Buffer.concat(chunks));
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
  console.log("=== seed-salon-expired-resurrect-test ===");
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

    const salonReg = await register({ phone: "09150009901", type: "salon", name: "سالن رستاخیز تست" });
    const salonCookie = salonReg.cookie;
    const salonUserId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    step("register salon", salonReg.res.ok && Boolean(salonUserId), `id=${salonUserId}`);

    const clientReg = await register({ phone: "09150009902", type: "client", name: "مشتری رستاخیز تست" });
    const clientCookie = clientReg.cookie;
    step("register client", clientReg.res.ok);

    // ── 1. Real pending booking, swept to منقضی شده ─────────────────────────
    const bookA = await api("/api/salon-bookings", {
      method: "POST",
      cookie: clientCookie,
      body: { salonUserId, service: "خدمت تست", bookingDate: BOOKING_DATE, time: "۱۰:۰۰", durationMinutes: 30, status: "درخواست" }
    });
    const bookingAId = bookA.payload?.booking?.id;
    step("client booking A created", bookA.res.status === 201, `status=${bookA.res.status} id=${bookingAId}`);

    backdateCreatedAt("salon_bookings", bookingAId, 70);

    let expiredStatus = null;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      expiredStatus = readStatus("salon_bookings", bookingAId);
      if (expiredStatus === "منقضی شده") break;
      await sleep(1000);
    }
    step("sweep auto-expires booking A to منقضی شده", expiredStatus === "منقضی شده", `status=${expiredStatus}`);

    // ── 2. BUG CHECK: confirm on an expired row must be rejected ───────────
    const confirmExpired = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: bookingAId, status: "تایید شده" }
    });
    step(
      "BUG CHECK: confirming an already-EXPIRED booking is rejected (409), not resurrected",
      confirmExpired.res.status === 409,
      `status=${confirmExpired.res.status} body=${JSON.stringify(confirmExpired.payload).slice(0, 200)}`
    );
    const statusAfterConfirmAttempt = readStatus("salon_bookings", bookingAId);
    step(
      "row status still منقضی شده after the rejected confirm attempt (not resurrected)",
      statusAfterConfirmAttempt === "منقضی شده",
      `status=${statusAfterConfirmAttempt}`
    );

    // ── 3. Cancelling an already-expired row is left alone ─────────────────
    const cancelExpired = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: bookingAId, status: "لغو", action: "cancel" }
    });
    step(
      "cancelling an already-expired row is still allowed (no new guard on cancel path)",
      cancelExpired.res.status === 200 && cancelExpired.payload?.booking?.status === "لغو",
      `status=${cancelExpired.res.status} booking.status=${cancelExpired.payload?.booking?.status}`
    );

    // ── 4. Regression guard: normal (non-expired) confirm still works ──────
    const bookB = await api("/api/salon-bookings", {
      method: "POST",
      cookie: clientCookie,
      body: { salonUserId, service: "خدمت تست", bookingDate: BOOKING_DATE, time: "۱۱:۰۰", durationMinutes: 30, status: "درخواست" }
    });
    const bookingBId = bookB.payload?.booking?.id;
    step("client booking B created", bookB.res.status === 201, `status=${bookB.res.status} id=${bookingBId}`);

    const confirmFresh = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: bookingBId, status: "تایید شده" }
    });
    step(
      "regression guard: confirming a normal (non-expired) booking still succeeds",
      confirmFresh.res.status === 200 && confirmFresh.payload?.booking?.status === "تایید شده",
      `status=${confirmFresh.res.status} booking.status=${confirmFresh.payload?.booking?.status}`
    );
  } catch (err) {
    step("unexpected error", false, String(err?.stack || err));
  } finally {
    await stopServer(child);
    cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nSALON EXPIRED RESURRECT TEST: ${passed}/${total} passed`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
