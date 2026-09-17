/**
 * Salon booking conflict FIX verification (LOCAL ONLY).
 *
 * DB: data/zibaban-conflict-fix-test.sqlite
 *
 * Covers: S1 overlap, S2 staff, S3 digits, non-overlap regression,
 * concurrent race, and pre-migration Persian-digit row after v12 migrate.
 *
 * Usage:
 *   node scripts/seed-salon-conflict-fix-test.mjs
 *   node scripts/seed-salon-conflict-fix-test.mjs --cleanup
 *
 * Env: ZIBABAN_CONFLICT_FIX_TEST_PORT  default 3034
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";
import { resolveRollingPersianDateKey } from "../app/shared/lib/persianCalendar.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-conflict-fix-test.sqlite");
const PORT = Number(process.env.ZIBABAN_CONFLICT_FIX_TEST_PORT || 3034);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "conflict-fix-test";

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
      NEXT_DIST_DIR: ".next-conflict-fix-test",
      PORT: String(PORT)
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  child.on("exit", () => {
    try {
      writeFileSync(path.join(root, "data", "zibaban-conflict-fix-test-server.log"), Buffer.concat(chunks));
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
    body: {
      phone,
      password: PASSWORD,
      type,
      data: { name, area: "تهران", service: type === "salon" ? "زیبایی" : undefined }
    }
  });
}

async function book(cookie, body) {
  return api("/api/salon-bookings", { method: "POST", cookie, body });
}

async function main() {
  console.log("=== seed-salon-conflict-fix-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned conflict-fix test db");
    return;
  }

  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) {
      process.exitCode = 1;
      return;
    }

    const salonReg = await register({ phone: "09130002101", type: "salon", name: "سالن فیکس تداخل" });
    const salonCookie = salonReg.cookie;
    const salonUserId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    step("register salon", salonReg.res.ok && Boolean(salonUserId), `id=${salonUserId}`);

    const clientReg = await register({ phone: "09130002102", type: "client", name: "مشتری فیکس" });
    const clientCookie = clientReg.cookie;
    step("register client", clientReg.res.ok && Boolean(clientCookie));

    const staffA = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "Staff Alpha", role: "آرایشگر", state: "فعال" }
    });
    const staffB = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "Staff Beta", role: "آرایشگر", state: "فعال" }
    });
    const personA = staffA.payload?.person;
    const personB = staffB.payload?.person;
    step("seed two staff", Boolean(personA?.name) && Boolean(personB?.name));

    await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "خدمت ۹۰ دقیقه", price: "800000", duration: "۹۰ دقیقه" }
    });
    await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "خدمت ۳۰ دقیقه", price: "300000", duration: "۳۰ دقیقه" }
    });

    const bookingDate = "امروز";

    // --- S1 ---
    console.log("\n--- S1 duration overlap ---");
    {
      const first = await book(clientCookie, {
        salonUserId,
        client: "S1",
        phone: "09130002102",
        service: "خدمت ۹۰ دقیقه",
        staff: personA.name,
        bookingDate,
        time: "۱۰:۰۰",
        durationMinutes: 90,
        status: "درخواست"
      });
      step("S1 seed 90min @ ۱۰:۰۰", first.res.status === 201, `stored=${first.payload?.booking?.time}`);

      const second = await book(clientCookie, {
        salonUserId,
        client: "S1b",
        phone: "09130002103",
        service: "خدمت ۳۰ دقیقه",
        staff: personA.name,
        bookingDate,
        time: "۱۰:۳۰",
        durationMinutes: 30,
        status: "درخواست"
      });
      step(
        "S1 EXPECT overlap → 409",
        second.res.status === 409,
        `status=${second.res.status} id=${second.payload?.booking?.id || "n/a"}`
      );
    }

    // --- S2 ---
    console.log("\n--- S2 staff-scoped ---");
    {
      const slot = "۱۴:۰۰";
      const a1 = await book(clientCookie, {
        salonUserId, client: "A1", phone: "09130002201", service: "خدمت ۳۰ دقیقه",
        staff: personA.name, bookingDate, time: slot, durationMinutes: 30, status: "درخواست"
      });
      const b1 = await book(clientCookie, {
        salonUserId, client: "B1", phone: "09130002202", service: "خدمت ۳۰ دقیقه",
        staff: personB.name, bookingDate, time: slot, durationMinutes: 30, status: "درخواست"
      });
      step("S2a different staff both 201", a1.res.status === 201 && b1.res.status === 201);

      const a2 = await book(clientCookie, {
        salonUserId, client: "A2", phone: "09130002203", service: "خدمت ۳۰ دقیقه",
        staff: personA.name, bookingDate, time: slot, durationMinutes: 30, status: "درخواست"
      });
      step("S2b same staff → 409", a2.res.status === 409, `status=${a2.res.status}`);
    }

    // --- S3 ---
    console.log("\n--- S3 Persian vs Latin ---");
    {
      const persian = await book(clientCookie, {
        salonUserId, client: "FA", phone: "09130002301", service: "خدمت ۳۰ دقیقه",
        staff: personB.name, bookingDate, time: "۱۶:۰۰", durationMinutes: 30, status: "درخواست"
      });
      step("S3 seed Persian ۱۶:۰۰", persian.res.status === 201, `stored=${persian.payload?.booking?.time}`);

      const latin = await book(clientCookie, {
        salonUserId, client: "LA", phone: "09130002302", service: "خدمت ۳۰ دقیقه",
        staff: personB.name, bookingDate, time: "16:00", durationMinutes: 30, status: "درخواست"
      });
      step("S3 EXPECT Latin 16:00 → 409", latin.res.status === 409, `status=${latin.res.status}`);
    }

    // --- Regression: non-overlapping ---
    console.log("\n--- Regression non-overlap ---");
    {
      const early = await book(clientCookie, {
        salonUserId, client: "R1", phone: "09130002401", service: "خدمت ۹۰ دقیقه",
        staff: personA.name, bookingDate, time: "۱۸:۰۰", durationMinutes: 90, status: "درخواست"
      });
      const late = await book(clientCookie, {
        salonUserId, client: "R2", phone: "09130002402", service: "خدمت ۳۰ دقیقه",
        staff: personA.name, bookingDate, time: "۱۹:۳۰", durationMinutes: 30, status: "درخواست"
      });
      step(
        "non-overlap 18:00+90 and 19:30+30 both 201",
        early.res.status === 201 && late.res.status === 201,
        `early=${early.res.status} late=${late.res.status}`
      );
    }

    // --- Race: concurrent identical slot ---
    console.log("\n--- Race concurrent same slot ---");
    {
      const body = {
        salonUserId,
        client: "RACE",
        phone: "09130002501",
        service: "خدمت ۳۰ دقیقه",
        staff: personA.name,
        bookingDate,
        time: "۲۰:۰۰",
        durationMinutes: 30,
        status: "درخواست"
      };
      const [r1, r2] = await Promise.all([
        book(clientCookie, { ...body, client: "RACE1", phone: "09130002501" }),
        book(clientCookie, { ...body, client: "RACE2", phone: "09130002502" })
      ]);
      const statuses = [r1.res.status, r2.res.status].sort();
      const oneWin = statuses[0] === 201 && statuses[1] === 409;
      step(
        "race: exactly one 201 and one 409",
        oneWin,
        `statuses=${r1.res.status},${r2.res.status}`
      );
    }

    // --- Migration: insert legacy Persian row while server stopped? ---
    // Insert via direct sqlite on the live DB (WAL) then book overlapping Latin.
    console.log("\n--- Migration / legacy Persian row ---");
    {
      let legacyOk = false;
      let detail = "";
      try {
        const dayKey = resolveRollingPersianDateKey("امروز");
        const database = new DatabaseSync(TEST_DB);
        // After v12 migrate, column exists; insert Persian digits deliberately.
        database.prepare(`
          INSERT INTO salon_bookings
            (salon_user_id, client, phone, service, staff, booking_date, time, duration_minutes, status)
          VALUES (?, 'LEGACY', '09130002601', 'خدمت ۹۰ دقیقه', ?, ?, '۱۷:۰۰', 90, 'درخواست')
        `).run(salonUserId, personB.name, dayKey);
        database.close();

        const clash = await book(clientCookie, {
          salonUserId,
          client: "LEGACY-CLASH",
          phone: "09130002602",
          service: "خدمت ۳۰ دقیقه",
          staff: personB.name,
          bookingDate: "امروز",
          time: "17:30",
          durationMinutes: 30,
          status: "درخواست"
        });
        legacyOk = clash.res.status === 409;
        detail = `status=${clash.res.status} (read-path digit normalize + duration)`;
      } catch (err) {
        detail = String(err?.message || err);
      }
      step("legacy Persian ۱۷:۰۰ overlaps Latin 17:30 → 409", legacyOk, detail);
    }
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nCONFLICT FIX TEST: ${passed}/${total} passed`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
