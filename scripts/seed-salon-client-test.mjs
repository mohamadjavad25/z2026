/**
 * Isolated salon-client seed + smoke test (LOCAL ONLY).
 *
 * Uses: data/zibaban-salon-client-test.sqlite (never data/zibaban.sqlite)
 *
 * Covers client flows only (directory, booking, follow) — not owner dashboard UI.
 *
 * Usage:
 *   node scripts/seed-salon-client-test.mjs
 *   node scripts/seed-salon-client-test.mjs --cleanup
 *
 * Env: ZIBABAN_SALON_CLIENT_TEST_PORT  default 3014
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-salon-client-test.sqlite");
const PORT = Number(process.env.ZIBABAN_SALON_CLIENT_TEST_PORT || 3014);
const BASE = `http://127.0.0.1:${PORT}`;
const SALON_PHONE = "09121110001";
const CLIENT_PHONE = "09121110002";
const PASSWORD = "salon-client-test";

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
      const res = await fetch(`${BASE}/api/salons`);
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
      NEXT_DIST_DIR: ".next-salon-client-test",
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    windowsHide: true
  });
  const logPath = path.join(root, "data", "zibaban-salon-client-test-server.log");
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
  console.log("=== salon-client seed / smoke (isolated DB) ===");
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
    step("start Next on isolated DB", false, "timeout — see data/zibaban-salon-client-test-server.log");
    await stopServer(server);
    process.exitCode = 1;
    return;
  }
  step("start Next on isolated DB", true, `port ${PORT}, ZIBABAN_DB_PATH set`);

  let salonCookie = "";
  let clientCookie = "";
  let salonUserId = null;
  const bookingDay = "امروز";
  const bookingTime = "۱۱:۰۰";

  try {
    {
      const { res, payload, cookie } = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: SALON_PHONE,
          password: PASSWORD,
          type: "salon",
          data: {
            name: "سالن تست مشتری",
            area: "ونک",
            service: "زیبایی",
            bio: "seed salon-client"
          }
        }
      });
      salonCookie = cookie;
      salonUserId = payload?.data?.user?.id || payload?.profile?.id || null;
      step(
        "POST /api/auth/register (salon owner)",
        res.ok && Boolean(salonCookie) && Boolean(salonUserId),
        res.ok ? `salonUserId=${salonUserId}` : `status=${res.status}`
      );
      if (!res.ok) throw new Error("salon register failed");
    }

    {
      const { res, payload } = await api("/api/salon-services", {
        method: "POST",
        cookie: salonCookie,
        body: {
          name: "کوتاهی مو تست",
          price: "۵۰۰٬۰۰۰",
          duration: "۶۰ دقیقه",
          hint: "seed service"
        }
      });
      const service = payload?.service || payload?.data?.service;
      step(
        "POST /api/salon-services (owner seed)",
        res.status === 201 && Boolean(service?.name || service?.id),
        service ? `name=${service.name || service.id}` : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api("/api/salon-hours", { cookie: salonCookie });
      const hours = payload?.hours || payload?.data?.hours || [];
      step(
        "GET /api/salon-hours (owner read; client UI does not use this)",
        res.ok && hours.length > 0,
        res.ok ? `days=${hours.length}` : `status=${res.status}`
      );
    }

    {
      const { res, payload, cookie } = await api("/api/auth/register", {
        method: "POST",
        body: {
          phone: CLIENT_PHONE,
          password: PASSWORD,
          type: "client",
          data: { name: "مشتری تست سالن", area: "تهران" }
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
      const { res, payload } = await api("/api/salons");
      const salons = payload?.data?.salons || payload?.salons || [];
      const found = salons.find((s) => Number(s.id) === Number(salonUserId) || s.name === "سالن تست مشتری");
      step(
        "GET /api/salons shows seeded salon",
        res.ok && Boolean(found),
        res.ok ? `salons=${salons.length}, foundId=${found?.id ?? "no"}` : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api("/api/salon-bookings", {
        method: "POST",
        cookie: clientCookie,
        body: {
          salonUserId,
          client: "مشتری تست سالن",
          phone: CLIENT_PHONE,
          service: "کوتاهی مو تست",
          staff: "",
          bookingDate: bookingDay,
          time: bookingTime,
          status: "درخواست"
        }
      });
      const booking = payload?.booking;
      step(
        "POST /api/salon-bookings (client free slot)",
        res.status === 201 && Boolean(booking?.id),
        res.status === 201
          ? `id=${booking.id}, date=${booking.booking_date}, time=${booking.time}`
          : `status=${res.status} ${payload.error || ""}`
      );
      if (res.status !== 201) throw new Error("first booking failed");
    }

    {
      const { res, payload } = await api("/api/salon-bookings", {
        method: "POST",
        cookie: clientCookie,
        body: {
          salonUserId,
          client: "مشتری تست سالن",
          phone: CLIENT_PHONE,
          service: "کوتاهی مو تست",
          staff: "",
          bookingDate: bookingDay,
          time: bookingTime,
          status: "درخواست"
        }
      });
      const conflicted = res.status === 409;
      step(
        "POST /api/salon-bookings same slot again (expect conflict)",
        conflicted,
        conflicted
          ? `status=409 code=${payload.code || "conflict"}`
          : `FINDING: expected 409, got status=${res.status} ${payload.error || ""} — conflict detection weak or missing`
      );
    }

    {
      const { res, payload } = await api(`/api/salon-bookings?salonUserId=${encodeURIComponent(salonUserId)}`, {
        cookie: clientCookie
      });
      const slots = payload?.unavailableSlots || payload?.data?.unavailableSlots || [];
      const hit = slots.some((s) => s.time === bookingTime || String(s.time).includes("۱۱"));
      step(
        "GET /api/salon-bookings?salonUserId= → unavailableSlots",
        res.ok && slots.length >= 1,
        res.ok ? `slots=${slots.length}, includesBookedTime=${hit}` : `status=${res.status}`
      );
    }

    {
      const { res, payload } = await api("/api/salon-follow", {
        method: "POST",
        cookie: clientCookie,
        body: { salonUserId, follow: true }
      });
      const follow = payload?.follow || payload?.data || payload;
      const ok = res.ok && (follow?.follower_count != null || follow?.ok !== false);
      step(
        "POST /api/salon-follow",
        ok,
        res.ok
          ? `follower_count=${follow?.follower_count ?? follow?.followerCount ?? "?"}`
          : `status=${res.status}`
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
  console.log("rollback: node scripts/seed-salon-client-test.mjs --cleanup");
  console.log("note: scheduleNow/scheduleViewDay/scheduleBookingMenu stay in HomeApp (shared with artist)");

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
