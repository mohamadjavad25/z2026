/**
 * Isolated auth/session seed + smoke (LOCAL ONLY).
 *
 * Uses: data/zibaban-auth-test.sqlite (never data/zibaban.sqlite)
 *
 * Covers:
 * 1. Register + login/boot cascade for all 4 roles (role-scoped API only)
 * 2. Race: delayed guest /me vs login lock → final profile is login, not guest
 * 3. Logout UI gaps + intentional non-clears (salonDirectory / last_phone)
 * 4. Leak-between-sessions: login A → mutate UI gaps → logout → login B
 * 5. Double-boot generation guard (authBootRef)
 * 6. --cleanup
 *
 * Usage:
 *   node scripts/seed-auth-test.mjs
 *   node scripts/seed-auth-test.mjs --cleanup
 *
 * Env: ZIBABAN_AUTH_TEST_PORT  default 3021
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-auth-test.sqlite");
const PORT = Number(process.env.ZIBABAN_AUTH_TEST_PORT || 3021);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "auth-test-pass1";

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
      NEXT_DIST_DIR: ".next-auth-test",
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
      writeFileSync(path.join(root, "data", "zibaban-auth-test-server.log"), Buffer.concat(chunks));
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

async function registerRole(type, phone, extra = {}) {
  const data = {
    name: extra.name || `Auth ${type}`,
    area: extra.area || "تهران",
    service: extra.service || (type === "shop" ? "مراقبت پوست" : type === "artist" ? "میکاپ" : "تمام خدمات"),
    phone,
    email: `${type}@auth-test.local`,
    ...extra.data
  };
  if (type === "client") delete data.service;
  const { res, payload, cookie } = await api("/api/auth/register", {
    method: "POST",
    body: { type, phone, password: PASSWORD, data }
  });
  return { ok: res.ok, status: res.status, payload, cookie, profile: payload.profile || payload.data?.user };
}

async function login(phone) {
  return api("/api/auth/login", {
    method: "POST",
    body: { phone, password: PASSWORD }
  });
}

async function me(cookie) {
  return api("/api/auth/me", { cookie });
}

async function roleWorkspaceProbes(cookie, role) {
  const artist = await api("/api/artist/me", { cookie });
  const salon = await api("/api/salon-staff", { cookie });
  const shop = await api("/api/shop/me", { cookie });
  return {
    artistOk: artist.res.ok,
    salonOk: salon.res.ok,
    shopOk: shop.res.ok,
    expected: {
      artist: role === "artist",
      salon: role === "salon",
      shop: role === "shop"
    }
  };
}

function assertCascade(role, probes) {
  const artistMatch = probes.artistOk === probes.expected.artist;
  const salonMatch = probes.salonOk === probes.expected.salon;
  const shopMatch = probes.shopOk === probes.expected.shop;
  // client: none of the owner workspaces
  if (role === "client") {
    return !probes.artistOk && !probes.salonOk && !probes.shopOk;
  }
  return artistMatch && salonMatch && shopMatch;
}

async function main() {
  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned auth test db");
    return;
  }

  cleanupDbFiles();
  const child = startTestServer();
  let failed = false;

  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) {
      failed = true;
      return;
    }

    const roles = [
      { type: "client", phone: "09140000001", name: "بانو تست" },
      { type: "artist", phone: "09140000002", name: "آرتیست تست", service: "میکاپ" },
      { type: "salon", phone: "09140000003", name: "سالن تست", service: "تمام خدمات" },
      { type: "shop", phone: "09140000004", name: "فروشگاه تست", service: "پوست" }
    ];

    const sessions = {};

    for (const role of roles) {
      const reg = await registerRole(role.type, role.phone, { name: role.name, service: role.service });
      step(`register ${role.type}`, reg.ok && Boolean(reg.profile?.id), `status=${reg.status}`);
      if (!reg.ok) { failed = true; continue; }

      const boot = await me(reg.cookie);
      const bootUser = boot.payload.profile || boot.payload.data?.user;
      step(`boot /me ${role.type}`, boot.res.ok && bootUser?.type === role.type, bootUser?.type || "none");

      const probes = await roleWorkspaceProbes(reg.cookie, role.type);
      const cascadeOk = assertCascade(role.type, probes);
      step(
        `cascade ${role.type} only own workspace`,
        cascadeOk,
        `artist=${probes.artistOk} salon=${probes.salonOk} shop=${probes.shopOk}`
      );
      if (!cascadeOk) failed = true;

      // logout + re-login
      await api("/api/auth/logout", { method: "POST", cookie: reg.cookie });
      const loggedOut = await me("");
      const guest = !(loggedOut.payload.profile || loggedOut.payload.data?.user);
      step(`logout clears session ${role.type}`, guest);

      const relog = await login(role.phone);
      step(`re-login ${role.type}`, relog.res.ok && (relog.payload.profile || relog.payload.data?.user)?.type === role.type);
      sessions[role.type] = { ...role, cookie: relog.cookie || reg.cookie, id: reg.profile?.id };
      if (!relog.res.ok) failed = true;
    }

    // --- Race: delayed guest me vs login lock ---
    {
      const { createAuthRaceGuards } = await import(pathToFileURL(path.join(root, "app/features/auth/raceGuards.js")).href);
      const { normalizeProfile } = await import(pathToFileURL(path.join(root, "app/features/auth/constants.js")).href);

      const guards = createAuthRaceGuards();
      const bootId = guards.beginBoot();

      // Simulate slow /me (guest) started before login
      const delayedGuest = sleep(80).then(() =>
        guards.applyMeResult(bootId, null, normalizeProfile)
      );

      // Login wins mid-flight
      await sleep(10);
      const loginUser = {
        id: 99,
        type: "artist",
        name: "Race Artist",
        area: "تهران",
        service: "میکاپ",
        phone: "09149999999",
        email: "",
        avatar: "",
        bio: ""
      };
      guards.enterAuthenticated(normalizeProfile(loginUser));

      const meOutcome = await delayedGuest;
      const finalType = guards.createdProfile?.type;
      const raceOk = meOutcome === "skipped-locked" && finalType === "artist";
      step(
        "race: late guest /me cannot overwrite login",
        raceOk,
        `meOutcome=${meOutcome} finalType=${finalType}`
      );
      if (!raceOk) failed = true;
    }

    // --- Double-boot generation ---
    {
      const { createAuthRaceGuards } = await import(pathToFileURL(path.join(root, "app/features/auth/raceGuards.js")).href);
      const { normalizeProfile } = await import(pathToFileURL(path.join(root, "app/features/auth/constants.js")).href);
      const guards = createAuthRaceGuards();
      const boot1 = guards.beginBoot();
      const boot2 = guards.beginBoot();
      const stale = guards.applyMeResult(boot1, {
        id: 1, type: "client", name: "Stale", area: "", service: "", phone: "09141111111", email: "", avatar: "", bio: ""
      }, normalizeProfile);
      const fresh = guards.applyMeResult(boot2, {
        id: 2, type: "salon", name: "Fresh", area: "", service: "", phone: "09142222222", email: "", avatar: "", bio: ""
      }, normalizeProfile);
      const doubleOk = stale === "skipped-stale" && fresh === "applied" && guards.createdProfile?.type === "salon";
      step(
        "double-boot: authBootRef blocks stale overwrite",
        doubleOk,
        `stale=${stale} fresh=${fresh} type=${guards.createdProfile?.type}`
      );
      if (!doubleOk) failed = true;
    }

    // --- Logout UI gaps + intentional keeps ---
    {
      const { createLogoutUiGapResets, LOGOUT_UI_GAP_DEFAULTS } = await import(
        pathToFileURL(path.join(root, "app/features/auth/logoutUiGaps.js")).href
      );

      const state = {
        bookingSheetOpen: true,
        scheduleBookingMenu: { id: 1 },
        scheduleBookingView: "time",
        shopOwnerChatOpen: true,
        shopOwnerChatDraft: "hello",
        shopOwnerActiveChat: { id: "x" },
        shopOwnerMessages: [{ id: 1 }],
        clientBookingSettings: { id: 2 },
        artistServiceCreateOpen: true,
        artistServiceCreateMode: "custom",
        artistServiceDraft: { id: 9, name: "leak", price: "1", duration: "۱۰", hint: "x" },
        bookingStaffName: "آرتیست قدیمی",
        bookingServiceName: "خدمت قدیمی",
        bookingDate: "فردا",
        bookingTime: "۱۰:۰۰",
        bookingCreateStep: "time",
        bookingSelectMenu: "staff",
        // intentional non-clears
        salonDirectory: [{ id: "keep-me" }],
        reservationRequestList: [{ id: "seed" }],
        lastPhone: "09140000002"
      };

      const reset = createLogoutUiGapResets({
        setBookingSheetOpen: (v) => { state.bookingSheetOpen = v; },
        setScheduleBookingMenu: (v) => { state.scheduleBookingMenu = v; },
        setScheduleBookingView: (v) => { state.scheduleBookingView = v; },
        setShopOwnerChatOpen: (v) => { state.shopOwnerChatOpen = v; },
        setShopOwnerChatDraft: (v) => { state.shopOwnerChatDraft = v; },
        setShopOwnerActiveChat: (v) => { state.shopOwnerActiveChat = v; },
        setShopOwnerMessages: (v) => { state.shopOwnerMessages = v; },
        setClientBookingSettings: (v) => { state.clientBookingSettings = v; },
        setArtistServiceCreateOpen: (v) => { state.artistServiceCreateOpen = v; },
        setArtistServiceCreateMode: (v) => { state.artistServiceCreateMode = v; },
        setArtistServiceDraft: (v) => { state.artistServiceDraft = v; },
        setBookingStaffName: (v) => { state.bookingStaffName = v; },
        setBookingServiceName: (v) => { state.bookingServiceName = v; },
        setBookingDate: (v) => { state.bookingDate = v; },
        setBookingTime: (v) => { state.bookingTime = v; },
        setBookingCreateStep: (v) => { state.bookingCreateStep = v; },
        setBookingSelectMenu: (v) => { state.bookingSelectMenu = v; }
      });

      reset();

      const gapsOk =
        state.bookingSheetOpen === LOGOUT_UI_GAP_DEFAULTS.bookingSheetOpen
        && state.scheduleBookingMenu === LOGOUT_UI_GAP_DEFAULTS.scheduleBookingMenu
        && state.scheduleBookingView === LOGOUT_UI_GAP_DEFAULTS.scheduleBookingView
        && state.shopOwnerChatOpen === LOGOUT_UI_GAP_DEFAULTS.shopOwnerChatOpen
        && state.shopOwnerChatDraft === LOGOUT_UI_GAP_DEFAULTS.shopOwnerChatDraft
        && state.shopOwnerActiveChat === LOGOUT_UI_GAP_DEFAULTS.shopOwnerActiveChat
        && Array.isArray(state.shopOwnerMessages) && state.shopOwnerMessages.length === 0
        && state.clientBookingSettings === LOGOUT_UI_GAP_DEFAULTS.clientBookingSettings
        && state.artistServiceCreateOpen === LOGOUT_UI_GAP_DEFAULTS.artistServiceCreateOpen
        && state.bookingStaffName === ""
        && state.bookingServiceName === ""
        && state.bookingDate === ""
        && state.bookingTime === LOGOUT_UI_GAP_DEFAULTS.bookingTime
        && state.bookingCreateStep === LOGOUT_UI_GAP_DEFAULTS.bookingCreateStep
        && state.bookingSelectMenu === "";

      const keepsOk =
        Array.isArray(state.salonDirectory) && state.salonDirectory[0]?.id === "keep-me"
        && Array.isArray(state.reservationRequestList) && state.reservationRequestList[0]?.id === "seed"
        && state.lastPhone === "09140000002";

      step("logout gaps reset (booking/schedule/chat/drafts)", gapsOk);
      step("logout keeps salonDirectory + reservationRequestList + last_phone", keepsOk);
      if (!gapsOk || !keepsOk) failed = true;

      // HomeApp wiring presence
      const home = readFileSync(path.join(root, "app/features/shell/HomeApp.jsx"), "utf8");
      const wired =
        home.includes("createLogoutUiGapResets")
        && home.includes("resetLogoutUiGaps()")
        && home.includes("useAuthSession")
        && home.includes("onLoggedOut")
        && home.includes("AuthGateForms")
        && !home.includes("authBootRef")
        && !home.includes("AUTH_SESSION_KEY");
      step("HomeApp wires useAuthSession + logout gaps (no local race refs)", wired);
      if (!wired) failed = true;
    }

    // --- Leak between sessions (HTTP + UI gap simulation) ---
    {
      const artist = sessions.artist;
      const salon = sessions.salon;
      if (!artist?.cookie || !salon?.cookie) {
        step("leak-between-sessions setup", false, "missing artist/salon sessions");
        failed = true;
      } else {
        // Artist session owns artist workspace; after logout cookie must not access it
        const before = await api("/api/artist/me", { cookie: artist.cookie });
        await api("/api/auth/logout", { method: "POST", cookie: artist.cookie });
        const afterLogout = await api("/api/artist/me", { cookie: artist.cookie });
        const salonLogin = await login(salon.phone);
        const salonAsArtist = await api("/api/artist/me", { cookie: salonLogin.cookie });
        const salonAsSalon = await api("/api/salon-staff", { cookie: salonLogin.cookie });
        const meSalon = await me(salonLogin.cookie);
        const meType = (meSalon.payload.profile || meSalon.payload.data?.user)?.type;

        // Simulate UI leak: previous booking sheet state must be cleared before new session
        const { createLogoutUiGapResets } = await import(
          pathToFileURL(path.join(root, "app/features/auth/logoutUiGaps.js")).href
        );
        let bookingSheetOpen = true;
        let scheduleBookingMenu = { from: "artist-session", artistId: artist.id };
        let artistServiceDraft = { name: "old-artist-service" };
        createLogoutUiGapResets({
          setBookingSheetOpen: (v) => { bookingSheetOpen = v; },
          setScheduleBookingMenu: (v) => { scheduleBookingMenu = v; },
          setArtistServiceDraft: (v) => { artistServiceDraft = v; }
        })();

        const leakOk =
          before.res.ok
          && !afterLogout.res.ok
          && !salonAsArtist.res.ok
          && salonAsSalon.res.ok
          && meType === "salon"
          && bookingSheetOpen === false
          && scheduleBookingMenu === null
          && artistServiceDraft?.name === "";

        step(
          "leak-between-sessions: artist → logout → salon (no workspace/UI leak)",
          leakOk,
          `me=${meType} artistApi=${salonAsArtist.res.status} salonApi=${salonAsSalon.res.status}`
        );
        if (!leakOk) failed = true;
      }
    }

    // normalizeProfile shape contract
    {
      const { normalizeProfile } = await import(pathToFileURL(path.join(root, "app/features/auth/constants.js")).href);
      const p = normalizeProfile({
        id: 7,
        type: "artist",
        name: "N",
        area: "A",
        service: "S",
        phone: "09140000002",
        email: "e",
        avatar: "x",
        bio: "b"
      });
      const shapeOk =
        p
        && p.id === 7
        && p.type === "artist"
        && p.data
        && p.data.name === "N"
        && p.data.phone === "09140000002"
        && Object.keys(p).sort().join(",") === "data,id,type"
        && Object.keys(p.data).sort().join(",") === "area,avatar,bio,email,name,phone,service";
      step("createdProfile normalize shape unchanged for 7 hooks", shapeOk);
      if (!shapeOk) failed = true;
    }

  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nAUTH TEST: ${passed}/${total} passed`);
  if (failed || passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
