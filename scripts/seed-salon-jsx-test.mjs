/**
 * J4 salon owner JSX extract smoke (LOCAL ONLY).
 *
 * 1) Structural: HomeApp mounts 6 salon presentational components
 * 2) Schedule triad still in HomeApp
 * 3) No large inline staff/services/tool classNames left in HomeApp
 * 4) CSS: key panel classes in salon.css (not monolith panel defs)
 * 5) Presentational: panel exports without useSalonWorkspace import/call
 * 6) API: register salon -> staff/service CRUD (+ optional artist link)
 *
 * Usage:
 *   node scripts/seed-salon-jsx-test.mjs
 *   node scripts/seed-salon-jsx-test.mjs --cleanup
 *
 * Env: ZIBABAN_SALON_JSX_TEST_PORT  default 3030
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-salon-jsx-test.sqlite");
const PORT = Number(process.env.ZIBABAN_SALON_JSX_TEST_PORT || 3030);
const BASE = `http://127.0.0.1:${PORT}`;
const SALON_PHONE = "09120006601";
const ARTIST_PHONE = "09120006602";
const PASSWORD = "salon-jsx-test";

const PANEL_NAMES = [
  "SalonStaffWorkspace",
  "SalonServicesWorkspace",
  "SalonStaffProfileModal",
  "SalonCreateStaffModal",
  "SalonNearbyInviteSheet",
  "SalonToolSheets"
];

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
      NEXT_DIST_DIR: ".next-salon-jsx-test",
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
      writeFileSync(path.join(root, "data", "zibaban-salon-jsx-test-server.log"), Buffer.concat(chunks));
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

async function main() {
  console.log("=== seed-salon-jsx-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned salon jsx test db");
    return;
  }

  const home = readFileSync(path.join(root, "app/features/shell/HomeApp.jsx"), "utf8");
  const salonCss = readFileSync(path.join(root, "app/styles/features/salon.css"), "utf8");
  const monolith = readFileSync(path.join(root, "app/styles.css"), "utf8");

  for (const name of PANEL_NAMES) {
    step(`HomeApp mounts ${name}`, home.includes(`<${name}`));
  }

  step(
    "schedule triad still in HomeApp",
    home.includes("scheduleNow") && home.includes("scheduleViewDay") && home.includes("scheduleBookingMenu")
  );

  const bannedInline = [
    'className="artistList"',
    'className="staffWorkspaceHead"',
    'className="staffProfileModal"',
    'className="artistCreateModal"',
    'className="salonToolModal"',
    'className="artistInviteSheet"'
  ];
  const foundInline = bannedInline.filter((s) => home.includes(s));
  step(
    "HomeApp has no inline staff/tool panel classNames",
    foundInline.length === 0,
    foundInline.length ? foundInline.join(",") : "clean"
  );

  step("HomeApp wires onManageStaff", home.includes("onManageStaff="));
  step("HomeApp wires addSalonStaff", home.includes("addSalonStaff"));
  step("HomeApp wires onSubmit={addSalonStaff}", home.includes("onSubmit={addSalonStaff}"));
  step(
    "HomeApp wires SalonStaffProfileModal onUpdate",
    /<SalonStaffProfileModal[\s\S]*?onUpdate=/.test(home)
  );

  const cssKeys = [
    ".salonWorkspacePanel.is-staff",
    ".hoursWorkspaceHead",
    ".salonServiceManagerList",
    ".staffProfileModal",
    ".artistCreateModal",
    ".artistInviteSheet",
    ".salonToolModal",
    ".systemHeroPanel"
  ];
  const inSalon = cssKeys.every((k) => salonCss.includes(k));
  const monoPanelRules = [
    ".salonWorkspacePanel.is-staff {",
    ".hoursWorkspaceHead {",
    ".salonServiceManagerList {",
    ".staffProfileModal",
    ".artistCreateModal",
    ".artistInviteSheet",
    ".salonToolModal {",
    ".systemHeroPanel {"
  ].filter((k) => monolith.includes(k));
  step(
    "salon panel CSS in salon.css (not monolith)",
    inSalon && monoPanelRules.length === 0,
    `salon=${inSalon} monoPanelRules=${monoPanelRules.length}${monoPanelRules.length ? " " + monoPanelRules.join("|") : ""}`
  );

  let presentationalOk = 0;
  for (const name of PANEL_NAMES) {
    const src = readFileSync(path.join(root, "app/features/salons", `${name}.jsx`), "utf8");
    const ok = src.includes(`export function ${name}`)
      && !/import\s*\{[^}]*\buseSalonWorkspace\b/.test(src)
      && !src.includes("useSalonWorkspace(");
    step(`${name} presentational (no useSalonWorkspace)`, ok);
    if (ok) presentationalOk += 1;
  }

  const profileSrc = readFileSync(path.join(root, "app/features/salons/SalonStaffProfileModal.jsx"), "utf8");
  step(
    "SalonStaffProfileModal has staffProfileHero marker",
    profileSrc.includes("staffProfileHero")
  );

  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) {
      process.exitCode = 1;
      return;
    }

    const salonReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: SALON_PHONE,
        password: PASSWORD,
        type: "salon",
        data: {
          name: "Salon JSX Test",
          area: "Tehran",
          service: "hair",
          bio: "seed salon-jsx"
        }
      }
    });
    const salonCookie = salonReg.cookie;
    const salonId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id || null;
    step(
      "register salon",
      salonReg.res.ok && Boolean(salonCookie) && Boolean(salonId),
      salonReg.res.ok ? `salonId=${salonId}` : `status=${salonReg.res.status}`
    );
    if (!salonReg.res.ok) {
      process.exitCode = 1;
      return;
    }

    const staffCreate = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "Staff Unlinked",
        role: "artist",
        state: "active",
        phone: "09120006699"
      }
    });
    const staffPerson = staffCreate.payload?.person;
    step(
      "POST staff (without artist link)",
      (staffCreate.res.status === 201 || staffCreate.res.ok) && Boolean(staffPerson?.id),
      staffPerson?.id ? `id=${staffPerson.id} linked=${staffPerson.artist_user_id || "null"}` : `status=${staffCreate.res.status}`
    );

    const artistReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: ARTIST_PHONE,
        password: PASSWORD,
        type: "artist",
        data: { name: "Artist Link JSX", area: "Tehran", service: "nails" }
      }
    });
    const artistId = artistReg.payload?.data?.user?.id || artistReg.payload?.profile?.id;
    step("register artist", artistReg.res.ok && Boolean(artistId), `id=${artistId}`);

    if (artistId) {
      const linked = await api("/api/salon-staff", {
        method: "POST",
        cookie: salonCookie,
        body: {
          name: "Artist Link JSX",
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
    } else {
      step("POST staff linked to artist", false, "no artist id");
    }

    const svc = await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "Cut JSX",
        price: "250000",
        duration: "45",
        hint: "salon jsx seed",
        staff_id: staffPerson?.id
      }
    });
    const service = svc.payload?.service || svc.payload?.data?.service;
    step(
      "POST service",
      (svc.res.status === 201 || svc.res.ok) && Boolean(service?.name || service?.id),
      service?.name || `status=${svc.res.status}`
    );

    const staffList = await api("/api/salon-staff", { cookie: salonCookie });
    const staffRows = staffList.payload?.staff || [];
    const hasStaff = staffRows.some((s) => Number(s.id) === Number(staffPerson?.id));
    step(
      "GET staff list includes staff",
      staffList.res.ok && hasStaff,
      `count=${staffRows.length} found=${hasStaff}`
    );

    const svcList = await api("/api/salon-services", { cookie: salonCookie });
    const services = svcList.payload?.services || svcList.payload?.data?.services || [];
    const hasService = services.some((s) =>
      (service?.id && Number(s.id) === Number(service.id))
      || String(s.name || "") === String(service?.name || "Cut JSX")
    );
    step(
      "GET services includes service",
      svcList.res.ok && hasService,
      `count=${services.length} found=${hasService}`
    );

    const patched = await api("/api/salon-staff", {
      method: "PATCH",
      cookie: salonCookie,
      body: {
        id: staffPerson?.id,
        role: "manager",
        state: "idle"
      }
    });
    const patchedPerson = patched.payload?.person;
    step(
      "PATCH/update staff role or state",
      patched.res.ok
        && (String(patchedPerson?.role || "") === "manager" || String(patchedPerson?.state || "") === "idle"),
      `role=${patchedPerson?.role} state=${patchedPerson?.state}`
    );

    const deleted = await api("/api/salon-staff", {
      method: "DELETE",
      cookie: salonCookie,
      body: { id: staffPerson?.id }
    });
    const afterDelete = deleted.payload?.staff || [];
    const gone = !afterDelete.some((s) => Number(s.id) === Number(staffPerson?.id));
    step(
      "DELETE staff",
      (deleted.res.ok || deleted.payload?.ok) && gone,
      `remaining=${afterDelete.length} gone=${gone}`
    );
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nSALON JSX TEST: ${passed}/${total} passed (panels presentational ${presentationalOk}/6)`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
