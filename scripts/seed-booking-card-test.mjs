/**
 * Isolated booking-card chat test (LOCAL ONLY).
 *
 * Verifies POST /api/salon-bookings and POST /api/artist/bookings each drop
 * a "booking card" system message (attachmentType "salon-booking" /
 * "artist-booking") into the client's chat with the salon/artist, and that
 * GET /api/conversations/[id]/messages enriches it with live booking data
 * (service, date/time, staff, status) — mirroring seed-shop-idempotency-test.mjs.
 *
 * Uses a separate SQLite file (never data/zibaban.sqlite):
 *   data/zibaban-booking-card-test.sqlite
 *
 * Usage:
 *   node scripts/seed-booking-card-test.mjs
 *   node scripts/seed-booking-card-test.mjs --cleanup
 *
 * Env:
 *   ZIBABAN_BOOKING_CARD_TEST_PORT  default 3013
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-booking-card-test.sqlite");
const PORT = Number(process.env.ZIBABAN_BOOKING_CARD_TEST_PORT || 3013);
const BASE = `http://127.0.0.1:${PORT}`;

const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");

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

if (doCleanupOnly) {
  cleanupDbFiles();
  console.log("cleaned up");
  process.exit(0);
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
      const res = await fetch(`${BASE}/api/shops`);
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
        NEXT_DIST_DIR: ".next-booking-card-test",
        PORT: String(PORT)
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true
    }
  );
  const logPath = path.join(root, "data", "zibaban-booking-card-test-server.log");
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

async function register(phone, type, name) {
  const { payload, cookie } = await api("/api/auth/register", {
    method: "POST",
    body: { phone, password: "test1234", type, data: { name } }
  });
  if (!payload?.data?.user) throw new Error(`register failed for ${phone}: ${JSON.stringify(payload)}`);
  return { user: payload.data.user, cookie };
}

async function findConversationWith(cookie, peerUserId) {
  const { payload } = await api("/api/conversations", { cookie });
  const list = payload?.data?.conversations || [];
  return list.find((c) => c.peer?.id === peerUserId) || null;
}

async function main() {
  cleanupDbFiles();
  const server = startTestServer();
  let allOk = true;
  try {
    const up = await waitForServer();
    step("dev server up", up, `${BASE}`);
    if (!up) throw new Error("server did not start");

    // ── Salon booking card ──────────────────────────────────────────────
    const client = await register("09120000001", "client", "مشتری تست");
    const salon = await register("09120000002", "salon", "سالن تست");

    // Default salon hours have جمعه (Friday) closed — try a small run of
    // relative days so this test isn't flaky depending on what "today" is.
    let bookingRes = null;
    for (const day of ["امروز", "فردا", "پس‌فردا"]) {
      bookingRes = await api("/api/salon-bookings", {
        method: "POST",
        cookie: client.cookie,
        body: {
          salonUserId: salon.user.id,
          service: "کوتاهی مو",
          date: day,
          time: "12:00"
        }
      });
      if (bookingRes.res.status === 201) break;
    }
    step("salon booking created", bookingRes.res.status === 201, `status=${bookingRes.res.status} ${JSON.stringify(bookingRes.payload).slice(0, 200)}`);

    const salonConvo = await findConversationWith(client.cookie, salon.user.id);
    step("client↔salon conversation exists", Boolean(salonConvo));

    if (salonConvo) {
      const { payload } = await api(`/api/conversations/${salonConvo.id}/messages`, { cookie: client.cookie });
      const msgs = payload?.data?.messages || [];
      const card = msgs.find((m) => m.attachmentType === "salon-booking");
      step("salon-booking card message present", Boolean(card), JSON.stringify(card));
      if (card) {
        step("card.booking is live salon_bookings data", card.booking?.service === "کوتاهی مو" && card.booking?.status === "تازه", JSON.stringify(card.booking));
        step("card centered/system-eligible (no body text)", !card.body, `body=${JSON.stringify(card.body)}`);
      } else {
        allOk = false;
      }
      if (!card || card.booking?.service !== "کوتاهی مو") allOk = false;
    } else {
      allOk = false;
    }

    // A client-composed message must NEVER be able to carry a booking attachmentType.
    const spoofRes = salonConvo
      ? await api(`/api/conversations/${salonConvo.id}/messages`, {
          method: "POST",
          cookie: client.cookie,
          body: { body: "hi", attachmentType: "salon-booking" }
        })
      : null;
    if (spoofRes) {
      const stored = spoofRes.payload?.data?.message;
      step("client-sent message can't spoof attachmentType", stored?.attachmentType !== "salon-booking", JSON.stringify(stored));
      if (stored?.attachmentType === "salon-booking") allOk = false;
    }

    // ── Artist booking card ─────────────────────────────────────────────
    const client2 = await register("09120000003", "client", "مشتری تست ۲");
    const artist = await register("09120000004", "artist", "آرتیست تست");

    const artistBookingRes = await api("/api/artist/bookings", {
      method: "POST",
      cookie: client2.cookie,
      body: {
        artistUserId: artist.user.id,
        service: "میکاپ عروس",
        date: "امروز",
        time: "13:00"
      }
    });
    step("artist booking created", artistBookingRes.res.status === 201, `status=${artistBookingRes.res.status} ${JSON.stringify(artistBookingRes.payload).slice(0, 200)}`);

    const artistConvo = await findConversationWith(client2.cookie, artist.user.id);
    step("client↔artist conversation exists", Boolean(artistConvo));

    if (artistConvo) {
      const { payload } = await api(`/api/conversations/${artistConvo.id}/messages`, { cookie: client2.cookie });
      const msgs = payload?.data?.messages || [];
      const card = msgs.find((m) => m.attachmentType === "artist-booking");
      step("artist-booking card message present", Boolean(card), JSON.stringify(card));
      if (card) {
        step("card.booking is live artist_bookings data", card.booking?.service === "میکاپ عروس", JSON.stringify(card.booking));
      } else {
        allOk = false;
      }
      if (!card || card.booking?.service !== "میکاپ عروس") allOk = false;
    } else {
      allOk = false;
    }

    // ── Walk-in salon booking (no client account) must NOT create a card ──
    const salon2 = await register("09120000005", "salon", "سالن تست ۲");
    let walkinRes = null;
    for (const day of ["امروز", "فردا", "پس‌فردا"]) {
      walkinRes = await api("/api/salon-bookings", {
        method: "POST",
        cookie: salon2.cookie,
        body: {
          service: "رنگ مو",
          date: day,
          time: "14:00",
          client: "مشتری حضوری",
          phone: "09129999999"
        }
      });
      if (walkinRes.res.status === 201) break;
    }
    step("walk-in salon booking created", walkinRes.res.status === 201, `status=${walkinRes.res.status}`);
    const { payload: convosAfterWalkin } = await api("/api/conversations", { cookie: salon2.cookie });
    const walkinConvoCount = (convosAfterWalkin?.data?.conversations || []).length;
    step("walk-in booking (no linked account) creates no chat card", walkinConvoCount === 0, `conversations=${walkinConvoCount}`);
    if (walkinConvoCount !== 0) allOk = false;
  } catch (err) {
    step("unexpected error", false, String(err?.stack || err));
    allOk = false;
  } finally {
    await stopServer(server);
    cleanupDbFiles();
  }

  const failed = report.filter((r) => !r.ok);
  console.log(`\n${report.length - failed.length}/${report.length} PASS`);
  if (failed.length) {
    console.log("Failures:");
    failed.forEach((f) => console.log(`  ${f.line}`));
  }
  process.exit(allOk && failed.length === 0 ? 0 : 1);
}

main();
