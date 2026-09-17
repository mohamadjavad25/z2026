/**
 * Isolated salon booking conflict scenarios (LOCAL ONLY).
 *
 * DB: data/zibaban-conflict-test.sqlite (never data/zibaban.sqlite)
 *
 * Scenarios:
 * 1) Partial duration overlap (90min @ 10:00 vs 30min @ 10:30) → expect 409
 * 2) Staff-scoped: different staff same time OK; same staff same time → 409
 * 3) Persian "۱۰:۰۰" vs Latin "10:00" same staff → expect 409 (one slot)
 *
 * Usage:
 *   node scripts/seed-salon-conflict-test.mjs
 *   node scripts/seed-salon-conflict-test.mjs --cleanup
 *
 * Env: ZIBABAN_CONFLICT_TEST_PORT  default 3033
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-conflict-test.sqlite");
const PORT = Number(process.env.ZIBABAN_CONFLICT_TEST_PORT || 3033);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "conflict-test";

const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");
const keepServer = args.has("--keep-server");

const report = [];

function step(title, ok, detail = "") {
  const verdict = ok ? "PASS" : "FAIL";
  const line = `${verdict} ${title}${detail ? ` — ${detail}` : ""}`;
  report.push({ ok, title, detail, line, verdict });
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
      NEXT_DIST_DIR: ".next-conflict-test",
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
      writeFileSync(path.join(root, "data", "zibaban-conflict-test-server.log"), Buffer.concat(chunks));
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

async function register({ phone, type, name, area = "تهران" }) {
  return api("/api/auth/register", {
    method: "POST",
    body: {
      phone,
      password: PASSWORD,
      type,
      data: { name, area, service: type === "salon" ? "زیبایی" : undefined }
    }
  });
}

async function book(cookie, body) {
  return api("/api/salon-bookings", {
    method: "POST",
    cookie,
    body
  });
}

async function main() {
  console.log("=== seed-salon-conflict-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned conflict test db");
    return;
  }

  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    if (!up) {
      step("test server up", false, BASE);
      process.exitCode = 1;
      return;
    }
    step("test server up", true, BASE);

    // --- shared salon + client + two staff ---
    const salonReg = await register({ phone: "09130001101", type: "salon", name: "سالن تداخل" });
    const salonCookie = salonReg.cookie;
    const salonUserId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    step("register salon", salonReg.res.ok && Boolean(salonUserId), `id=${salonUserId}`);
    if (!salonReg.res.ok) return;

    const clientReg = await register({ phone: "09130001102", type: "client", name: "مشتری تداخل" });
    const clientCookie = clientReg.cookie;
    step("register client", clientReg.res.ok && Boolean(clientCookie));
    if (!clientReg.res.ok) return;

    const staffA = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "Staff Alpha", role: "آرایشگر", state: "فعال", phone: "09130001111" }
    });
    const staffB = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "Staff Beta", role: "آرایشگر", state: "فعال", phone: "09130001112" }
    });
    const personA = staffA.payload?.person;
    const personB = staffB.payload?.person;
    step(
      "seed two staff",
      (staffA.res.ok || staffA.res.status === 201) && (staffB.res.ok || staffB.res.status === 201)
        && Boolean(personA?.name) && Boolean(personB?.name),
      `A=${personA?.name} B=${personB?.name}`
    );

    await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "خدمت ۹۰ دقیقه", price: "800000", duration: "۹۰ دقیقه", hint: "overlap test" }
    });
    await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "خدمت ۳۰ دقیقه", price: "300000", duration: "۳۰ دقیقه", hint: "overlap test" }
    });

    const bookingDate = "امروز";

    // ========== Scenario 1: partial duration overlap ==========
    console.log("\n--- Scenario 1: duration overlap (90@10:00 vs 30@10:30) ---");
    {
      const first = await book(clientCookie, {
        salonUserId,
        client: "مشتری تداخل",
        phone: "09130001102",
        service: "خدمت ۹۰ دقیقه",
        staff: personA?.name || "Staff Alpha",
        bookingDate,
        time: "۱۰:۰۰",
        durationMinutes: 90,
        status: "درخواست"
      });
      const firstOk = first.res.status === 201 && Boolean(first.payload?.booking?.id);
      step(
        "S1 seed: book 90min at ۱۰:۰۰",
        firstOk,
        firstOk
          ? `id=${first.payload.booking.id} time=${first.payload.booking.time}`
          : `status=${first.res.status} ${first.payload.error || ""}`
      );

      const second = await book(clientCookie, {
        salonUserId,
        client: "مشتری تداخل ۲",
        phone: "09130001103",
        service: "خدمت ۳۰ دقیقه",
        staff: personA?.name || "Staff Alpha",
        bookingDate,
        time: "۱۰:۳۰",
        durationMinutes: 30,
        status: "درخواست"
      });
      const rejected = second.res.status === 409;
      step(
        "S1 EXPECT: 10:30 overlaps 10:00+90 → 409",
        rejected,
        rejected
          ? `status=409 error=${second.payload.error || ""}`
          : `BUG: expected 409 conflict for partial overlap; got status=${second.res.status} bookingId=${second.payload?.booking?.id || "n/a"} error=${second.payload.error || ""} — salon conflict likely exact-time only (no duration window)`
      );
    }

    // ========== Scenario 2: staff-scoped ==========
    console.log("\n--- Scenario 2: staff-scoped same clock time ---");
    {
      const slot = "۱۴:۰۰";
      const a1 = await book(clientCookie, {
        salonUserId,
        client: "C-A1",
        phone: "09130001201",
        service: "خدمت ۳۰ دقیقه",
        staff: personA?.name || "Staff Alpha",
        bookingDate,
        time: slot,
        status: "درخواست"
      });
      const b1 = await book(clientCookie, {
        salonUserId,
        client: "C-B1",
        phone: "09130001202",
        service: "خدمت ۳۰ دقیقه",
        staff: personB?.name || "Staff Beta",
        bookingDate,
        time: slot,
        status: "درخواست"
      });
      const differentStaffOk = a1.res.status === 201 && b1.res.status === 201;
      step(
        "S2a EXPECT: different staff same time both 201",
        differentStaffOk,
        differentStaffOk
          ? `A=${a1.payload?.booking?.id} B=${b1.payload?.booking?.id}`
          : `got A=${a1.res.status} B=${b1.res.status} — ${a1.payload.error || ""} ${b1.payload.error || ""}`
      );

      const a2 = await book(clientCookie, {
        salonUserId,
        client: "C-A2",
        phone: "09130001203",
        service: "خدمت ۳۰ دقیقه",
        staff: personA?.name || "Staff Alpha",
        bookingDate,
        time: slot,
        status: "درخواست"
      });
      const sameStaffConflict = a2.res.status === 409;
      step(
        "S2b EXPECT: same staff same time → 409",
        sameStaffConflict,
        sameStaffConflict
          ? `status=409`
          : `BUG: expected 409 for same staff+time; got status=${a2.res.status} id=${a2.payload?.booking?.id || "n/a"} error=${a2.payload.error || ""}`
      );
    }

    // ========== Scenario 3: Persian vs Latin digits ==========
    console.log("\n--- Scenario 3: Persian vs Latin time digits ---");
    {
      const persian = await book(clientCookie, {
        salonUserId,
        client: "C-FA",
        phone: "09130001301",
        service: "خدمت ۳۰ دقیقه",
        staff: personB?.name || "Staff Beta",
        bookingDate,
        time: "۱۶:۰۰",
        status: "درخواست"
      });
      const persianOk = persian.res.status === 201;
      step(
        "S3 seed: book with Persian ۱۶:۰۰",
        persianOk,
        persianOk
          ? `id=${persian.payload?.booking?.id} stored=${persian.payload?.booking?.time}`
          : `status=${persian.res.status} ${persian.payload.error || ""}`
      );

      const latin = await book(clientCookie, {
        salonUserId,
        client: "C-LA",
        phone: "09130001302",
        service: "خدمت ۳۰ دقیقه",
        staff: personB?.name || "Staff Beta",
        bookingDate,
        time: "16:00",
        status: "درخواست"
      });
      const digitConflict = latin.res.status === 409;
      step(
        "S3 EXPECT: Latin 16:00 vs Persian ۱۶:۰۰ → 409",
        digitConflict,
        digitConflict
          ? `status=409 (treated as one slot)`
          : `BUG: expected 409 for digit-normalized same slot; got status=${latin.res.status} id=${latin.payload?.booking?.id || "n/a"} storedFirst=${persian.payload?.booking?.time || "?"} — times compared as raw strings without digit normalize`
      );
    }
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  console.log("\n=== SUMMARY ===");
  const scenarios = [
    { id: "S1", label: "duration partial overlap", keys: ["S1 EXPECT"] },
    { id: "S2", label: "staff-scoped", keys: ["S2a EXPECT", "S2b EXPECT"] },
    { id: "S3", label: "Persian vs Latin digits", keys: ["S3 EXPECT"] }
  ];
  for (const sc of scenarios) {
    const rows = report.filter((r) => sc.keys.some((k) => r.title.includes(k)));
    const ok = rows.length > 0 && rows.every((r) => r.ok);
    console.log(`${ok ? "PASS" : "FAIL"} ${sc.id} ${sc.label}`);
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nCONFLICT TEST: ${passed}/${total} assertions passed`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
