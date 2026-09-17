/**
 * J6 schedule JSX + CSS extract smoke (LOCAL ONLY).
 *
 * Structural: HomeApp mounts 3 schedule components; triad/memos/interval stay in HomeApp.
 * CSS: key panel classes in schedule.css (not monolith panel defs).
 * API: salon booking create + PATCH time; artist booking create + list.
 *
 * Usage:
 *   node scripts/seed-schedule-jsx-test.mjs
 *   node scripts/seed-schedule-jsx-test.mjs --cleanup
 *
 * Env: ZIBABAN_SCHEDULE_JSX_TEST_PORT  default 3032
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-schedule-jsx-test.sqlite");
const PORT = Number(process.env.ZIBABAN_SCHEDULE_JSX_TEST_PORT || 3032);
const BASE = `http://127.0.0.1:${PORT}`;
const SALON_PHONE = "09120007701";
const ARTIST_PHONE = "09120007702";
const CLIENT_PHONE = "09120007703";
const PASSWORD = "schedule-jsx-test";

const PANEL_FILES = {
  SalonScheduleDashboard: "SalonScheduleDashboard.jsx",
  ArtistScheduleBoard: "ArtistScheduleBoard.jsx",
  ScheduleBookingMenuModal: "ScheduleBookingMenuModal.jsx"
};

const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");
const keepServer = args.has("--keep-server");
const report = [];

function step(title, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} ${title}${detail ? ` -- ${detail}` : ""}`;
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
      NEXT_DIST_DIR: ".next-schedule-jsx-test",
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
      writeFileSync(path.join(root, "data", "zibaban-schedule-jsx-test-server.log"), Buffer.concat(chunks));
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

function assertNoTriadUseState(src, label) {
  const badNow = /useState\s*\([^)]*\)[^\n]*scheduleNow|const\s*\[\s*scheduleNow\s*,/.test(src);
  const badDay = /const\s*\[\s*scheduleViewDay\s*,/.test(src);
  const badMenu = /const\s*\[\s*scheduleBookingMenu\s*,/.test(src);
  const importsHook = /useSalonWorkspace|useArtistWorkspace/.test(src);
  return {
    ok: !badNow && !badDay && !badMenu && !importsHook,
    detail: `now=${badNow} day=${badDay} menu=${badMenu} hooks=${importsHook} (${label})`
  };
}

async function main() {
  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned schedule jsx test db");
    return;
  }

  if (TEST_DB.replace(/\\/g, "/").endsWith("data/zibaban.sqlite")) {
    throw new Error("refusing to use main DB path");
  }

  const home = readFileSync(path.join(root, "app/features/shell/HomeApp.jsx"), "utf8");
  const scheduleCss = readFileSync(path.join(root, "app/styles/features/schedule.css"), "utf8");
  const monolith = readFileSync(path.join(root, "app/styles.css"), "utf8");
  const modalSrc = readFileSync(path.join(root, "app/features/schedule/ScheduleBookingMenuModal.jsx"), "utf8");

  console.log("PORT:", PORT);
  console.log("DB:", TEST_DB);

  step("HomeApp mounts SalonScheduleDashboard", home.includes("<SalonScheduleDashboard"));
  step("HomeApp mounts ArtistScheduleBoard", home.includes("<ArtistScheduleBoard"));
  step("HomeApp mounts ScheduleBookingMenuModal", home.includes("<ScheduleBookingMenuModal"));

  step(
    "HomeApp defines schedule triad useState",
    home.includes("const [scheduleNow")
      && home.includes("const [scheduleViewDay")
      && home.includes("const [scheduleBookingMenu")
  );

  step(
    "HomeApp has openScheduleBookingMenu",
    home.includes("function openScheduleBookingMenu")
  );

  const intervalNearNow = /setScheduleNow[\s\S]{0,400}setInterval|setInterval\([\s\S]{0,200}setScheduleNow/.test(home);
  step("HomeApp setInterval near scheduleNow", intervalNearNow);

  step(
    "HomeApp has scheduleDayAppointments memo",
    home.includes("scheduleDayAppointments")
  );
  step(
    "HomeApp has artistScheduleDayRows memo",
    home.includes("artistScheduleDayRows")
  );

  step(
    "HomeApp wires onChangeTime={changeScheduleBookingTime}",
    home.includes("onChangeTime={changeScheduleBookingTime}")
  );
  step(
    "HomeApp wires onChangeStaff",
    /<ScheduleBookingMenuModal[\s\S]*?onChangeStaff=/.test(home)
  );
  step(
    "HomeApp wires onCancel",
    /<ScheduleBookingMenuModal[\s\S]*?onCancel=/.test(home)
  );
  step(
    "HomeApp wires onMessage",
    /<ScheduleBookingMenuModal[\s\S]*?onMessage=/.test(home)
  );
  step(
    'ArtistScheduleBoard onOpenBookingMenu with "artist"',
    /onOpenBookingMenu=\{[^}]*openScheduleBookingMenu\([^)]*["']artist["']/.test(home)
      || home.includes('openScheduleBookingMenu(booking, "artist")')
  );

  for (const [name, file] of Object.entries(PANEL_FILES)) {
    const src = readFileSync(path.join(root, "app/features/schedule", file), "utf8");
    const check = assertNoTriadUseState(src, name);
    step(`${name} has no triad useState / workspace hooks`, check.ok, check.detail);
  }

  step(
    "ScheduleBookingMenuModal salon ownerType gate",
    modalSrc.includes('ownerType === "salon"') && modalSrc.includes("isSalonOwner")
  );
  step(
    "ScheduleBookingMenuModal mini actions salon-only marker",
    modalSrc.includes("scheduleBookingMiniActions")
      && /isSalonOwner\s*\?\s*\([\s\S]*?scheduleBookingMiniActions/.test(modalSrc)
  );

  const cssKeys = [
    ".salonDashboard",
    ".artistBookingsPage",
    ".scheduleBookingMiniActions",
    ".salonTodaySchedule",
    ".artistBookingsToolbar"
  ];
  const inSchedule = cssKeys.every((k) => scheduleCss.includes(k));
  const monoPanelRules = [
    ".salonDashboard{",
    ".salonDashboard {",
    ".artistBookingsPage{",
    ".artistBookingsPage {",
    ".scheduleBookingMiniActions{",
    ".scheduleBookingMiniActions {"
  ].filter((k) => {
    // Only count top-level panel defs: selector starts a rule (not descendant-only in mixed leave-behinds).
    // Mixed leftover ".artistBookingsPage," in a multi-selector is OK.
    if (k.includes("artistBookingsPage")) {
      return /(?:^|\}|\n)\s*\.artistBookingsPage\s*\{/.test(monolith);
    }
    if (k.includes("salonDashboard")) {
      return /(?:^|\}|\n)\s*\.salonDashboard\s*\{/.test(monolith);
    }
    if (k.includes("scheduleBookingMiniActions")) {
      return /(?:^|\}|\n)\s*\.scheduleBookingMiniActions\s*\{/.test(monolith);
    }
    return monolith.includes(k);
  });
  step(
    "schedule panel CSS in schedule.css (not monolith)",
    inSchedule && monoPanelRules.length === 0,
    `schedule=${inSchedule} monoPanelRules=${monoPanelRules.length}`
  );
  step(
    "styles.css imports schedule.css",
    monolith.includes('./styles/features/schedule.css')
  );

  cleanupDbFiles();
  const child = startTestServer();
  try {
    const ready = await waitForServer();
    if (!ready) {
      step("server ready", false, "timeout");
      return;
    }
    step("server ready", true, `:${PORT}`);

    const salonReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: SALON_PHONE,
        password: PASSWORD,
        type: "salon",
        data: { name: "Schedule JSX Salon", area: "Tehran", service: "hair" }
      }
    });
    const salonCookie = salonReg.cookie;
    const salonId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    step("register salon", salonReg.res.ok && Boolean(salonCookie), `id=${salonId}`);

    const artistReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: ARTIST_PHONE,
        password: PASSWORD,
        type: "artist",
        data: { name: "Schedule JSX Artist", area: "Tehran", service: "nails" }
      }
    });
    const artistCookie = artistReg.cookie;
    const artistId = artistReg.payload?.data?.user?.id || artistReg.payload?.profile?.id;
    step("register artist", artistReg.res.ok && Boolean(artistId), `id=${artistId}`);

    const linked = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "Schedule JSX Artist",
        role: "artist",
        state: "active",
        artist_user_id: artistId
      }
    });
    const linkedStaff = linked.payload?.person;
    step(
      "POST staff linked to artist",
      (linked.res.status === 201 || linked.res.ok) && Number(linkedStaff?.artist_user_id) === Number(artistId),
      `id=${linkedStaff?.id} artist_user_id=${linkedStaff?.artist_user_id}`
    );

    const svc = await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "Schedule Cut",
        price: "200000",
        duration: "45",
        hint: "schedule jsx",
        staff_id: linkedStaff?.id
      }
    });
    const service = svc.payload?.service || svc.payload?.data?.service;
    step(
      "POST service",
      (svc.res.status === 201 || svc.res.ok) && Boolean(service?.name || service?.id),
      service?.name || `status=${svc.res.status}`
    );

    const book = await api("/api/salon-bookings", {
      method: "POST",
      cookie: salonCookie,
      body: {
        time: "۱۰:۰۰",
        booking_date: "امروز",
        client: "Schedule Client",
        phone: CLIENT_PHONE,
        service: "Schedule Cut",
        staff: "Schedule JSX Artist",
        status: "تازه"
      }
    });
    const bookingRow = book.payload?.booking
      || (book.payload?.bookings || []).find((b) => String(b.time || "").includes("۱۰") || String(b.time || "").includes("10"));
    step(
      "POST /api/salon-bookings creates booking",
      (book.res.status === 201 || book.res.ok) && Boolean(bookingRow?.id),
      `id=${bookingRow?.id} time=${bookingRow?.time}`
    );

    const list1 = await api("/api/salon-bookings", { cookie: salonCookie });
    const listed = (list1.payload?.bookings || []).some((b) => Number(b.id) === Number(bookingRow?.id));
    step(
      "GET salon bookings lists created booking",
      list1.res.ok && listed,
      `count=${(list1.payload?.bookings || []).length}`
    );

    const patched = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: {
        id: bookingRow?.id,
        time: "۱۱:۳۰"
      }
    });
    const patchedRow = patched.payload?.booking
      || (patched.payload?.bookings || []).find((b) => Number(b.id) === Number(bookingRow?.id));
    const timeOk = String(patchedRow?.time || "").includes("۱۱:۳۰") || String(patchedRow?.time || "").includes("11:30");
    step(
      "PATCH /api/salon-bookings changes time",
      patched.res.ok && timeOk,
      `time=${patchedRow?.time} status=${patched.res.status}`
    );

    const artistSvc = await api("/api/artist/me", {
      method: "POST",
      cookie: artistCookie,
      body: { name: "Artist Nail", price: "150000", duration: "60" }
    });
    step(
      "create artist service",
      artistSvc.res.status === 201 || artistSvc.res.ok,
      `status=${artistSvc.res.status}`
    );


    const clientReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: CLIENT_PHONE,
        password: PASSWORD,
        type: "client",
        data: { name: "Schedule JSX Client" }
      }
    });
    const clientCookie = clientReg.cookie;
    step("register client", clientReg.res.ok && Boolean(clientCookie));

    const artistBook = await api("/api/artist/bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        artistUserId: artistId,
        service: "Artist Nail",
        bookingDate: "امروز",
        time: "۱۴:۰۰",
        durationMinutes: 60,
        clientName: "Schedule JSX Client",
        clientPhone: CLIENT_PHONE
      }
    });
    step(
      "POST /api/artist/bookings",
      artistBook.res.status === 201 || artistBook.res.ok,
      `status=${artistBook.res.status}`
    );

    const meArtist = await api("/api/artist/me", { cookie: artistCookie });
    const artistBookings = meArtist.payload?.data?.bookings || meArtist.payload?.bookings || [];
    const foundArtistBooking = artistBookings.some((b) => String(b.time || "").includes("۱۴") || String(b.time || "").includes("14"));
    step(
      "artist bookings list has board data",
      meArtist.res.ok && foundArtistBooking,
      `count=${artistBookings.length} found=${foundArtistBooking}`
    );
  } finally {
    if (!keepServer) await stopServer(child);
    cleanupDbFiles();
  }

  const failed = report.filter((r) => !r.ok).length;
  const passed = report.filter((r) => r.ok).length;
  console.log(`\nSCORE ${passed}/${passed + failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
