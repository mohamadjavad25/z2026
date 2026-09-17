/**
 * Quick sync probe (LOCAL ONLY) for Salon-owner phase B.
 *
 * 1) Client POST /api/salon-bookings → owner GET sees booking (DB).
 *    UI note: onOwnerBookingsSync only when booker === salon owner; else 8s poll.
 * 2) Staff with artist_user_id → same POST also creates artist booking → GET /api/artist/me.
 *    UI note: artist workspace has no salon→artist callback; only 8s artist poll.
 *
 *   node scripts/probe-salon-owner-sync.mjs
 *   node scripts/probe-salon-owner-sync.mjs --cleanup
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-salon-owner-sync-probe.sqlite");
const PORT = Number(process.env.ZIBABAN_SALON_OWNER_SYNC_PROBE_PORT || 3018);
const BASE = `http://127.0.0.1:${PORT}`;
const args = new Set(process.argv.slice(2));

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

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    try {
      const res = await fetch(`${BASE}/api/salons`);
      if (res.status === 200) return true;
    } catch {
      // wait
    }
    await sleep(400);
  }
  return false;
}

function startServer() {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    cwd: root,
    env: {
      ...process.env,
      ZIBABAN_DB_PATH: TEST_DB,
      NEXT_DIST_DIR: ".next-salon-owner-sync-probe",
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
      writeFileSync(path.join(root, "data", "zibaban-salon-owner-sync-probe-server.log"), Buffer.concat(chunks));
    } catch {
      // ignore
    }
  });
  return child;
}

async function stopServer(child) {
  if (!child || child.killed) return;
  try { child.kill("SIGTERM"); } catch { /* ignore */ }
  await sleep(600);
  if (!child.killed) {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
  }
}

/** Mirrors HomeApp onOwnerBookingsSync gate + applySalonBookings({ bump:true }) */
function simulateOwnerUiAfterClientBook({ createdProfileId, salonUserId, payloadBookings, apply }) {
  if (String(salonUserId) === String(createdProfileId)) {
    apply(payloadBookings || [], { bump: true });
    return { immediate: true };
  }
  return { immediate: false };
}

async function main() {
  console.log("=== probe: salon client book → owner + linked artist ===");
  if (args.has("--cleanup")) {
    cleanupDbFiles();
    console.log("cleaned", TEST_DB);
    return;
  }
  cleanupDbFiles();
  const server = startServer();
  if (!(await waitForServer())) {
    console.log("FAIL server timeout");
    await stopServer(server);
    process.exitCode = 1;
    return;
  }

  let failed = 0;
  const check = (title, ok, detail = "") => {
    console.log(`${ok ? "✓" : "✗"} ${title}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failed += 1;
  };

  try {
    const salonReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09141110001",
        password: "probe-pass",
        type: "salon",
        data: { name: "سالن پروب Owner", area: "تهران", service: "زیبایی" }
      }
    });
    const salonCookie = salonReg.cookie;
    const salonId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    check("salon register", salonReg.res.ok && Boolean(salonId), `id=${salonId}`);

    const artistReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09141110002",
        password: "probe-pass",
        type: "artist",
        data: { name: "آرتیست لینک پروب", area: "تهران", service: "میکاپ" }
      }
    });
    const artistCookie = artistReg.cookie;
    const artistId = artistReg.payload?.data?.user?.id || artistReg.payload?.profile?.id;
    check("artist register", artistReg.res.ok && Boolean(artistId), `id=${artistId}`);

    const staff = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "آرتیست لینک پروب",
        role: "میکاپ",
        artist_user_id: artistId,
        artistUserId: artistId
      }
    });
    const staffPerson = staff.payload?.person || staff.payload?.staff?.[0];
    const linkedId = Number(staffPerson?.artist_user_id || staffPerson?.artistUserId || 0);
    check("salon staff linked to artist", staff.res.ok && linkedId === Number(artistId), `linked=${linkedId}`);

    await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "میکاپ سالن",
        price: "۳۰۰",
        duration: "۶۰ دقیقه",
        staff_id: staffPerson?.id
      }
    });

    const beforeSalon = await api("/api/salon-bookings", { cookie: salonCookie });
    const beforeArtist = await api("/api/artist/me", { cookie: artistCookie });
    const beforeSalonCount = (beforeSalon.payload?.bookings || []).length;
    const beforeArtistCount = (beforeArtist.payload?.data?.bookings || []).length;
    check("baselines", beforeSalon.res.ok && beforeArtist.res.ok, `salon=${beforeSalonCount} artist=${beforeArtistCount}`);

    const clientReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09141110003",
        password: "probe-pass",
        type: "client",
        data: { name: "مشتری پروب سالن", area: "تهران" }
      }
    });
    const clientCookie = clientReg.cookie;

    const book = await api("/api/salon-bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        salonUserId: salonId,
        client: "مشتری پروب سالن",
        phone: "09141110003",
        service: "میکاپ سالن",
        staff: "آرتیست لینک پروب",
        bookingDate: "امروز",
        time: "۱۶:۰۰",
        status: "درخواست"
      }
    });
    check(
      "client POST /api/salon-bookings",
      book.res.status === 201,
      `status=${book.res.status} artistBooking=${Boolean(book.payload?.artistBooking)} linkedArtistId=${book.payload?.linkedArtistId}`
    );

    const afterSalon = await api("/api/salon-bookings", { cookie: salonCookie });
    const afterSalonCount = (afterSalon.payload?.bookings || []).length;
    const foundSalon = (afterSalon.payload?.bookings || []).some((b) => String(b.time || "").includes("۱۶"));
    check(
      "owner GET sees client booking (DB immediate)",
      afterSalon.res.ok && afterSalonCount === beforeSalonCount + 1 && foundSalon,
      `count=${afterSalonCount}`
    );

    // Simulate UI sync gates
    let ownerList = [];
    const fromOtherClient = simulateOwnerUiAfterClientBook({
      createdProfileId: salonId,
      salonUserId: salonId,
      payloadBookings: book.payload?.bookings,
      // wrong: this is what WOULD happen if client===salon; here client is different
      apply: () => {}
    });
    // Correct simulation: client id ≠ salon id
    const uiGate = simulateOwnerUiAfterClientBook({
      createdProfileId: "client-not-salon",
      salonUserId: salonId,
      payloadBookings: book.payload?.bookings,
      apply: (bookings) => { ownerList = bookings; }
    });
    check(
      "UI: other-client book does NOT fire onOwnerBookingsSync",
      uiGate.immediate === false && ownerList.length === 0,
      "needs 8s poll / refreshSalonBookingsLive"
    );

    const selfBookGate = simulateOwnerUiAfterClientBook({
      createdProfileId: salonId,
      salonUserId: salonId,
      payloadBookings: book.payload?.bookings || [{ id: 1 }],
      apply: (bookings) => { ownerList = bookings; }
    });
    check(
      "UI: same-session owner-as-client WOULD sync immediately",
      selfBookGate.immediate === true && ownerList.length >= 1,
      `list=${ownerList.length}`
    );

    const afterArtist = await api("/api/artist/me", { cookie: artistCookie });
    const afterArtistCount = (afterArtist.payload?.data?.bookings || []).length;
    const foundArtist = (afterArtist.payload?.data?.bookings || []).some((b) => String(b.time || "").includes("۱۶"));
    check(
      "linked artist GET /api/artist/me sees salon-sourced booking (DB)",
      afterArtist.res.ok && afterArtistCount === beforeArtistCount + 1 && foundArtist,
      `count=${afterArtistCount} artistBookingInPost=${Boolean(book.payload?.artistBooking)}`
    );

    check(
      "UI note: artist has no salon→artist callback (only 8s poll / manual refresh)",
      true,
      "notifyArtistBookingCreated not wired from salon POST"
    );

    // Client book with staff="" (like useSalonDirectory) — may still link via service.staff_id
    const bookEmptyStaff = await api("/api/salon-bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        salonUserId: salonId,
        client: "مشتری پروب ۲",
        phone: "09141110003",
        service: "میکاپ سالن",
        staff: "",
        bookingDate: "امروز",
        time: "۱۸:۰۰",
        status: "درخواست"
      }
    });
    check(
      "client book staff=\"\" still can link via service.staff_id",
      bookEmptyStaff.res.status === 201,
      `linkedArtistId=${bookEmptyStaff.payload?.linkedArtistId} artistBooking=${Boolean(bookEmptyStaff.payload?.artistBooking)}`
    );

  } catch (error) {
    console.log("FAIL", error.message || error);
    failed += 1;
  }

  await stopServer(server);
  cleanupDbFiles();
  console.log(failed ? `RESULT: FAIL (${failed})` : "RESULT: OK");
  console.log("cleanup done");
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
