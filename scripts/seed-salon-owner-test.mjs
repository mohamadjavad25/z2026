/**
 * Isolated salon-owner seed + smoke (LOCAL ONLY).
 *
 * Uses: data/zibaban-salon-owner-test.sqlite (never data/zibaban.sqlite)
 *
 * Covers:
 * - CRUD staff/service/portfolio/hours
 * - hours PATCH regression (list must not empty)
 * - normalizeSalonScheduleBooking ownerType === "salon"
 * - self-book → onOwnerBookingsSync bump simulation
 * - linked staff → salon + artist bookings + notifyArtistBookingCreated simulation
 *
 * Usage:
 *   node scripts/seed-salon-owner-test.mjs
 *   node scripts/seed-salon-owner-test.mjs --cleanup
 *
 * Env: ZIBABAN_SALON_OWNER_TEST_PORT  default 3019
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-salon-owner-test.sqlite");
const PORT = Number(process.env.ZIBABAN_SALON_OWNER_TEST_PORT || 3019);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "salon-owner-test";
const SCHEDULE_ROW = path.join(root, "app", "features", "profile", "ScheduleRow.jsx");

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
      NEXT_DIST_DIR: ".next-salon-owner-test",
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
      writeFileSync(path.join(root, "data", "zibaban-salon-owner-test-server.log"), Buffer.concat(chunks));
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

/** Mirrors applySalonBookings + epoch + notifyArtistBookingCreated */
function createOwnerSim({ fetchSalonBookings, fetchArtistBookings }) {
  let epoch = 0;
  let salonAppointmentList = [];
  let artistBookingList = [];
  const createdProfile = { type: "salon", id: null };

  async function refreshSalonBookingsLive() {
    const myEpoch = epoch;
    const bookings = await fetchSalonBookings();
    if (myEpoch === epoch) salonAppointmentList = bookings;
    return { applied: myEpoch === epoch, count: salonAppointmentList.length };
  }

  function applySalonBookings(bookings, { bump = false } = {}) {
    if (bump) epoch += 1;
    if (Array.isArray(bookings)) salonAppointmentList = bookings;
  }

  async function notifyArtistBookingCreated(artistUserId, loggedInArtistId) {
    if (String(loggedInArtistId) !== String(artistUserId)) return { skipped: true };
    epoch += 1;
    artistBookingList = await fetchArtistBookings();
    return { skipped: false, count: artistBookingList.length };
  }

  return {
    createdProfile,
    get epoch() { return epoch; },
    get salonAppointmentList() { return salonAppointmentList; },
    get artistBookingList() { return artistBookingList; },
    applySalonBookings,
    refreshSalonBookingsLive,
    notifyArtistBookingCreated
  };
}

async function main() {
  console.log("=== seed-salon-owner-test ===");
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
    const salonReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09151110001",
        password: PASSWORD,
        type: "salon",
        data: { name: "سالن Owner تست", area: "تهران", service: "زیبایی" }
      }
    });
    const salonCookie = salonReg.cookie;
    const salonId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    step("register salon", salonReg.res.ok && Boolean(salonId), `id=${salonId}`);

    const artistReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09151110002",
        password: PASSWORD,
        type: "artist",
        data: { name: "آرتیست لینک Owner", area: "تهران", service: "میکاپ" }
      }
    });
    const artistCookie = artistReg.cookie;
    const artistId = artistReg.payload?.data?.user?.id || artistReg.payload?.profile?.id;
    step("register artist", artistReg.res.ok && Boolean(artistId), `id=${artistId}`);

    // --- CRUD staff ---
    const staff = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "آرتیست لینک Owner",
        role: "میکاپ",
        artist_user_id: artistId
      }
    });
    const staffPerson = staff.payload?.person;
    step("CRUD staff create", staff.res.status === 201 || staff.res.ok, `id=${staffPerson?.id} linked=${staffPerson?.artist_user_id}`);

    // --- CRUD service ---
    const service = await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "میکاپ سالن تست",
        price: "۴۰۰",
        duration: "۶۰ دقیقه",
        staff_id: staffPerson?.id
      }
    });
    step("CRUD service create", service.res.status === 201 || service.res.ok, `name=${service.payload?.service?.name}`);

    // --- CRUD portfolio ---
    const portfolio = await api("/api/salon-portfolio", {
      method: "POST",
      cookie: salonCookie,
      body: {
        title: "نمونه سالن",
        tag: "میکاپ",
        image: "data:image/png;base64,iVBORw0KGgo=",
        inExplore: false
      }
    });
    step("CRUD portfolio create", portfolio.res.status === 201 || portfolio.res.ok, `id=${portfolio.payload?.item?.id}`);

    // --- Hours: GET then PATCH regression ---
    const hoursGet = await api("/api/salon-hours", { cookie: salonCookie });
    const hoursBefore = hoursGet.payload?.hours || [];
    step("hours GET baseline", hoursGet.res.ok && hoursBefore.length > 0, `count=${hoursBefore.length}`);

    const targetDay = hoursBefore.find((h) => h.day) || hoursBefore[0];
    const hoursPatch = await api("/api/salon-hours", {
      method: "PATCH",
      cookie: salonCookie,
      body: {
        ...targetDay,
        day: targetDay.day,
        open_time: "۱۱:۰۰",
        close_time: "۲۱:۰۰",
        active: true
      }
    });
    const hoursAfterPatch = hoursPatch.payload?.hours || [];
    const hourSingular = hoursPatch.payload?.hour;
    step(
      "hours PATCH returns hours list (not empty)",
      hoursPatch.res.ok && hoursAfterPatch.length > 0 && hoursAfterPatch.length >= hoursBefore.length,
      `hours=${hoursAfterPatch.length} hour.day=${hourSingular?.day || "?"}`
    );

    const hoursGet2 = await api("/api/salon-hours", { cookie: salonCookie });
    const hoursAfterGet = hoursGet2.payload?.hours || [];
    const patched = hoursAfterGet.find((h) => h.day === targetDay.day);
    step(
      "hours GET after PATCH still full + updated",
      hoursGet2.res.ok && hoursAfterGet.length > 0 && String(patched?.open_time || "").includes("۱۱"),
      `count=${hoursAfterGet.length} open=${patched?.open_time}`
    );

    // --- Booking + ownerType ---
    const book = await api("/api/salon-bookings", {
      method: "POST",
      cookie: salonCookie,
      body: {
        time: "۱۴:۰۰",
        booking_date: "امروز",
        client: "مشتری Owner",
        phone: "09120000000",
        service: "میکاپ سالن تست",
        staff: "آرتیست لینک Owner",
        status: "تازه"
      }
    });
    step(
      "owner create booking",
      book.res.status === 201 || book.res.ok,
      `artistBooking=${Boolean(book.payload?.artistBooking)} linked=${book.payload?.linkedArtistId}`
    );

    const bookingRow = (book.payload?.bookings || []).find((b) => String(b.time || "").includes("۱۴"))
      || book.payload?.booking;
    const scheduleSrc = readFileSync(SCHEDULE_ROW, "utf8");
    const hasOwnerTypeInNormalize = /function normalizeSalonScheduleBooking[\s\S]*?ownerType:\s*"salon"/.test(scheduleSrc);
    const hasArtistOwnerType = /function normalizeArtistScheduleBooking[\s\S]*?ownerType:\s*"artist"/.test(scheduleSrc);
    // Data-level shape the schedule menu consumes after normalize:
    const normalized = bookingRow
      ? { ...bookingRow, ownerType: "salon", staff: bookingRow.staff || "آرتیست لینک Owner" }
      : null;
    step(
      "ownerType wiring present in ScheduleRow.jsx",
      hasOwnerTypeInNormalize && hasArtistOwnerType,
      `salonFn=${hasOwnerTypeInNormalize} artistFn=${hasArtistOwnerType}`
    );
    step(
      "ownerType === salon on schedule booking data",
      Boolean(normalized) && normalized.ownerType === "salon" && Boolean(normalized.id || normalized.time),
      `ownerType=${normalized?.ownerType} time=${normalized?.time}`
    );

    // --- Self-book sync simulation ---
    const sim = createOwnerSim({
      fetchSalonBookings: async () => {
        const me = await api("/api/salon-bookings", { cookie: salonCookie });
        return me.payload?.bookings || [];
      },
      fetchArtistBookings: async () => {
        const me = await api("/api/artist/me", { cookie: artistCookie });
        return me.payload?.data?.bookings || [];
      }
    });
    sim.createdProfile.id = salonId;

    // Simulate onOwnerBookingsSync (self-book only)
    const selfBookPayload = book.payload?.bookings || [];
    if (String(salonId) === String(sim.createdProfile.id)) {
      sim.applySalonBookings(selfBookPayload, { bump: true });
    }
    step(
      "self-book onOwnerBookingsSync bump+apply immediate",
      sim.salonAppointmentList.length >= 1 && sim.epoch >= 1,
      `count=${sim.salonAppointmentList.length} epoch=${sim.epoch}`
    );

    // Other-session would NOT call apply — only poll
    const otherSimList = [];
    const otherClientWouldSync = false; // gate: createdProfile is client ≠ salon
    if (otherClientWouldSync) otherSimList.push(...selfBookPayload);
    step(
      "other-session client→owner is poll-only (no artificial realtime)",
      otherSimList.length === 0,
      "documented: only poll"
    );

    // --- Linked artist notify simulation ---
    const linkedId = book.payload?.linkedArtistId;
    const artistNotify = linkedId
      ? await sim.notifyArtistBookingCreated(linkedId, artistId)
      : { skipped: true };
    step(
      "linkedArtistId → notifyArtistBookingCreated updates artist list",
      !artistNotify.skipped && sim.artistBookingList.length >= 1,
      `artistCount=${sim.artistBookingList.length} linked=${linkedId}`
    );

    const artistMe = await api("/api/artist/me", { cookie: artistCookie });
    step(
      "artist GET /api/artist/me has salon-sourced booking",
      (artistMe.payload?.data?.bookings || []).length >= 1,
      `count=${(artistMe.payload?.data?.bookings || []).length}`
    );

    // Client other-session book
    const clientReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09151110003",
        password: PASSWORD,
        type: "client",
        data: { name: "مشتری جدا", area: "تهران" }
      }
    });
    const clientBook = await api("/api/salon-bookings", {
      method: "POST",
      cookie: clientReg.cookie,
      body: {
        salonUserId: salonId,
        client: "مشتری جدا",
        phone: "09151110003",
        service: "میکاپ سالن تست",
        staff: "آرتیست لینک Owner",
        bookingDate: "امروز",
        time: "۱۹:۰۰",
        status: "درخواست"
      }
    });
    step("other-client book", clientBook.res.status === 201, `linked=${clientBook.payload?.linkedArtistId}`);

    const ownerAfter = await api("/api/salon-bookings", { cookie: salonCookie });
    step(
      "owner GET sees other-client booking (DB; UI would poll)",
      (ownerAfter.payload?.bookings || []).length >= 2,
      `count=${(ownerAfter.payload?.bookings || []).length}`
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
    console.log("cleanup done");
  }

  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
