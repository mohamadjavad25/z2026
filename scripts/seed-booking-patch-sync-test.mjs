/**
 * PATCH /api/salon-bookings → artist_bookings sync (LOCAL ONLY).
 *
 * DB: data/zibaban-booking-patch-sync-test.sqlite
 *
 * Covers:
 * 1. Create salon booking with linked staff → artist_booking exists
 * 2. PATCH time → artist_booking time updated
 * 3. PATCH cancel → artist_booking soft-cancelled (لغو)
 * 4. PATCH staff → unlinked → artist_booking soft-cancelled
 * 5. Forced mid-tx failure → neither table left half-updated
 *
 * Usage:
 *   node scripts/seed-booking-patch-sync-test.mjs
 *   node scripts/seed-booking-patch-sync-test.mjs --cleanup
 *
 * Env: ZIBABAN_BOOKING_PATCH_SYNC_TEST_PORT  default 3035
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-booking-patch-sync-test.sqlite");
const PORT = Number(process.env.ZIBABAN_BOOKING_PATCH_SYNC_TEST_PORT || 3035);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "booking-patch-sync-test";

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
      ZIBABAN_BOOKING_PATCH_SYNC_TEST: "1",
      NEXT_DIST_DIR: ".next-booking-patch-sync-test",
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
      writeFileSync(path.join(root, "data", "zibaban-booking-patch-sync-test-server.log"), Buffer.concat(chunks));
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
      data: { name, area: "تهران", service: type === "salon" ? "زیبایی" : "میکاپ" }
    }
  });
}

function asciiTime(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .trim();
}

function artistBookings(mePayload) {
  return mePayload?.data?.bookings || mePayload?.bookings || [];
}

function findArtistBooking(mePayload, { client, time, status } = {}) {
  const list = artistBookings(mePayload);
  return list.find((row) => {
    if (client && String(row.client_name || row.client || "") !== client) return false;
    if (time != null && asciiTime(row.time) !== asciiTime(time)) return false;
    if (status != null && String(row.status || "") !== status) return false;
    return true;
  }) || null;
}

async function main() {
  console.log("=== seed-booking-patch-sync-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned booking-patch-sync test db");
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

    const salonReg = await register({ phone: "09134003101", type: "salon", name: "سالن Patch Sync" });
    const salonCookie = salonReg.cookie;
    const salonId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    step("register salon", salonReg.res.ok && Boolean(salonId), `id=${salonId}`);

    const artistReg = await register({ phone: "09134003102", type: "artist", name: "آرتیست لینک Patch" });
    const artistCookie = artistReg.cookie;
    const artistId = artistReg.payload?.data?.user?.id || artistReg.payload?.profile?.id;
    step("register artist A", artistReg.res.ok && Boolean(artistId), `id=${artistId}`);

    const artistBReg = await register({ phone: "09134003103", type: "artist", name: "آرتیست B Patch" });
    const artistBId = artistBReg.payload?.data?.user?.id || artistBReg.payload?.profile?.id;
    step("register artist B", artistBReg.res.ok && Boolean(artistBId), `id=${artistBId}`);

    const linkedStaff = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "آرتیست لینک Patch", role: "میکاپ", artist_user_id: artistId }
    });
    const linkedPerson = linkedStaff.payload?.person;
    step(
      "create linked staff",
      Boolean(linkedPerson?.id) && Number(linkedPerson?.artist_user_id) === Number(artistId),
      `staff=${linkedPerson?.name} linked=${linkedPerson?.artist_user_id}`
    );

    const unlinkedStaff = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "Staff بدون لینک", role: "کمک", state: "فعال" }
    });
    const unlinkedPerson = unlinkedStaff.payload?.person;
    step(
      "create unlinked staff",
      Boolean(unlinkedPerson?.id) && !unlinkedPerson?.artist_user_id,
      `staff=${unlinkedPerson?.name}`
    );

    await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "خدمت Patch",
        price: "500000",
        duration: "۶۰ دقیقه",
        staff_id: linkedPerson?.id
      }
    });

    const bookingDate = "امروز";

    // --- 1) Create linked booking ---
    console.log("\n--- 1 create linked booking ---");
    const created = await api("/api/salon-bookings", {
      method: "POST",
      cookie: salonCookie,
      body: {
        client: "مشتری Patch",
        phone: "09134003999",
        service: "خدمت Patch",
        staff: linkedPerson.name,
        booking_date: bookingDate,
        time: "۱۰:۰۰",
        durationMinutes: 60,
        status: "تایید"
      }
    });
    const salonBookingId = created.payload?.booking?.id;
    step(
      "POST salon booking + linked artist",
      created.res.status === 201 && Boolean(salonBookingId) && Boolean(created.payload?.linkedArtistId),
      `salonId=${salonBookingId} linked=${created.payload?.linkedArtistId}`
    );

    let artistMe = await api("/api/artist/me", { cookie: artistCookie });
    let artistRow = findArtistBooking(artistMe.payload, { client: "مشتری Patch", time: "10:00" });
    if (!artistRow) artistRow = findArtistBooking(artistMe.payload, { client: "مشتری Patch", time: "۱۰:۰۰" });
    step(
      "artist_booking exists after POST",
      Boolean(artistRow) && String(artistRow.status) !== "لغو",
      `time=${artistRow?.time} status=${artistRow?.status}`
    );

    // --- 2) PATCH time ---
    console.log("\n--- 2 PATCH time ---");
    const patchTime = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: salonBookingId, time: "۱۱:۳۰" }
    });
    step(
      "PATCH time 200 + linkedArtistIds",
      patchTime.res.ok && Array.isArray(patchTime.payload?.linkedArtistIds),
      `status=${patchTime.res.status} ids=${JSON.stringify(patchTime.payload?.linkedArtistIds)} salonTime=${patchTime.payload?.booking?.time}`
    );

    artistMe = await api("/api/artist/me", { cookie: artistCookie });
    const afterTime = findArtistBooking(artistMe.payload, { client: "مشتری Patch", time: "11:30" })
      || findArtistBooking(artistMe.payload, { client: "مشتری Patch", time: "۱۱:۳۰" });
    step(
      "artist_booking time synced",
      Boolean(afterTime) && asciiTime(afterTime.time) === "11:30",
      `time=${afterTime?.time}`
    );

    // --- 3) PATCH cancel (separate booking so we can keep going) ---
    console.log("\n--- 3 PATCH cancel ---");
    const cancelSeed = await api("/api/salon-bookings", {
      method: "POST",
      cookie: salonCookie,
      body: {
        client: "مشتری لغو",
        phone: "09134003998",
        service: "خدمت Patch",
        staff: linkedPerson.name,
        booking_date: bookingDate,
        time: "۱۳:۰۰",
        durationMinutes: 60,
        status: "تایید"
      }
    });
    const cancelId = cancelSeed.payload?.booking?.id;
    step("seed cancel booking", cancelSeed.res.status === 201 && Boolean(cancelId), `id=${cancelId}`);

    const patchCancel = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: cancelId, action: "cancel" }
    });
    step(
      "PATCH cancel salon",
      patchCancel.res.ok && patchCancel.payload?.booking?.status === "لغو",
      `status=${patchCancel.payload?.booking?.status}`
    );

    artistMe = await api("/api/artist/me", { cookie: artistCookie });
    const cancelledArtist = artistBookings(artistMe.payload).find(
      (row) => String(row.client_name || "") === "مشتری لغو"
    );
    step(
      "artist_booking soft-cancelled",
      Boolean(cancelledArtist) && cancelledArtist.status === "لغو",
      `status=${cancelledArtist?.status || "missing"}`
    );

    // --- 4) PATCH staff → unlinked ---
    console.log("\n--- 4 PATCH staff → unlinked ---");
    const unlinkSeed = await api("/api/salon-bookings", {
      method: "POST",
      cookie: salonCookie,
      body: {
        client: "مشتری Unlink",
        phone: "09134003997",
        service: "خدمت Patch",
        staff: linkedPerson.name,
        booking_date: bookingDate,
        time: "۱۵:۰۰",
        durationMinutes: 60,
        status: "تایید"
      }
    });
    const unlinkId = unlinkSeed.payload?.booking?.id;
    step("seed unlink booking", unlinkSeed.res.status === 201 && Boolean(unlinkId), `id=${unlinkId}`);

    const beforeUnlinkMe = await api("/api/artist/me", { cookie: artistCookie });
    const beforeUnlink = artistBookings(beforeUnlinkMe.payload).find(
      (row) => String(row.client_name || "") === "مشتری Unlink" && row.status !== "لغو"
    );
    step("artist row before unlink", Boolean(beforeUnlink), `id=${beforeUnlink?.id}`);

    const patchUnlink = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: unlinkId, staff: unlinkedPerson.name }
    });
    step(
      "PATCH staff → unlinked",
      patchUnlink.res.ok && patchUnlink.payload?.booking?.staff === unlinkedPerson.name,
      `staff=${patchUnlink.payload?.booking?.staff} notify=${JSON.stringify(patchUnlink.payload?.linkedArtistIds)}`
    );

    artistMe = await api("/api/artist/me", { cookie: artistCookie });
    const afterUnlink = artistBookings(artistMe.payload).find(
      (row) => String(row.client_name || "") === "مشتری Unlink"
    );
    step(
      "artist_booking cancelled after unlink",
      Boolean(afterUnlink) && afterUnlink.status === "لغو",
      `status=${afterUnlink?.status || "missing"}`
    );

    // --- 5) Forced rollback ---
    console.log("\n--- 5 transactional rollback ---");
    const forceSeed = await api("/api/salon-bookings", {
      method: "POST",
      cookie: salonCookie,
      body: {
        client: "مشتری Force",
        phone: "09134003996",
        service: "خدمت Patch",
        staff: linkedPerson.name,
        booking_date: bookingDate,
        time: "۱۷:۰۰",
        durationMinutes: 60,
        status: "تایید"
      }
    });
    const forceId = forceSeed.payload?.booking?.id;
    const salonBefore = forceSeed.payload?.booking;
    step("seed force-fail booking", forceSeed.res.status === 201 && Boolean(forceId), `id=${forceId} time=${salonBefore?.time}`);

    artistMe = await api("/api/artist/me", { cookie: artistCookie });
    const artistBefore = artistBookings(artistMe.payload).find(
      (row) => String(row.client_name || "") === "مشتری Force" && row.status !== "لغو"
    );
    const artistBeforeTime = artistBefore?.time;
    step("artist row before force-fail", Boolean(artistBefore), `time=${artistBeforeTime}`);

    const forcePatch = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: forceId, time: "۱۸:۳۰", __testForceFail: true }
    });
    step(
      "forced fail returns 409",
      forcePatch.res.status === 409 && forcePatch.payload?.code === "TEST_FORCE_FAIL",
      `status=${forcePatch.res.status} code=${forcePatch.payload?.code}`
    );

    const salonList = await api("/api/salon-bookings", { cookie: salonCookie });
    const salonAfter = (salonList.payload?.bookings || []).find((row) => Number(row.id) === Number(forceId));
    step(
      "salon_booking unchanged after rollback",
      Boolean(salonAfter)
        && asciiTime(salonAfter.time) === asciiTime(salonBefore.time)
        && salonAfter.staff === salonBefore.staff
        && salonAfter.status !== "لغو",
      `time=${salonAfter?.time} staff=${salonAfter?.staff}`
    );

    artistMe = await api("/api/artist/me", { cookie: artistCookie });
    const artistAfter = artistBookings(artistMe.payload).find(
      (row) => String(row.client_name || "") === "مشتری Force" && row.status !== "لغو"
    );
    step(
      "artist_booking unchanged after rollback",
      Boolean(artistAfter) && asciiTime(artistAfter.time) === asciiTime(artistBeforeTime),
      `time=${artistAfter?.time}`
    );

    // Extra: staff A → B move (create on B, cancel A)
    console.log("\n--- bonus staff A → B ---");
    const staffB = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "آرتیست B Patch", role: "میکاپ", artist_user_id: artistBId }
    });
    const personB = staffB.payload?.person;
    const moveSeed = await api("/api/salon-bookings", {
      method: "POST",
      cookie: salonCookie,
      body: {
        client: "مشتری Move",
        phone: "09134003995",
        service: "خدمت Patch",
        staff: linkedPerson.name,
        booking_date: bookingDate,
        time: "۱۹:۰۰",
        durationMinutes: 60,
        status: "تایید"
      }
    });
    const moveId = moveSeed.payload?.booking?.id;
    const movePatch = await api("/api/salon-bookings", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: moveId, staff: personB?.name }
    });
    step(
      "PATCH staff A→B ok",
      movePatch.res.ok && movePatch.payload?.booking?.staff === personB?.name,
      `staff=${movePatch.payload?.booking?.staff}`
    );

    artistMe = await api("/api/artist/me", { cookie: artistCookie });
    const aAfterMove = artistBookings(artistMe.payload).find(
      (row) => String(row.client_name || "") === "مشتری Move"
    );
    const artistBCookie = artistBReg.cookie;
    const artistBMe = await api("/api/artist/me", { cookie: artistBCookie });
    const bAfterMove = artistBookings(artistBMe.payload).find(
      (row) => String(row.client_name || "") === "مشتری Move" && row.status !== "لغو"
    );
    step(
      "A cancelled + B created",
      aAfterMove?.status === "لغو" && Boolean(bAfterMove),
      `A=${aAfterMove?.status} B=${bAfterMove?.time || "missing"}`
    );
  } finally {
    if (!keepServer) await stopServer(child);
    cleanupDbFiles();
    console.log("cleaned booking-patch-sync test db");
  }

  const failed = report.filter((item) => !item.ok).length;
  console.log(`\n=== result: ${report.length - failed}/${report.length} PASS ===`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
