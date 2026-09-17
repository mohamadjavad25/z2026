/**
 * J5 shared profile JSX/CSS extract smoke (LOCAL ONLY).
 * Usage: node scripts/seed-profile-jsx-test.mjs [--cleanup]
 * Env: ZIBABAN_PROFILE_JSX_TEST_PORT default 3031
 * Never touches data/zibaban.sqlite
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-profile-jsx-test.sqlite");
const PORT = Number(process.env.ZIBABAN_PROFILE_JSX_TEST_PORT || 3031);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "profile-jsx-test";
const args = new Set(process.argv.slice(2));
const doCleanupOnly = args.has("--cleanup");
const keepServer = args.has("--keep-server");
const report = [];

function step(title, ok, detail = "") {
  const line = `${ok ? "OK" : "FAIL"} ${title}${detail ? ` -- ${detail}` : ""}`;
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
  const res = await fetch(`${BASE}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const payload = await res.json().catch(() => ({}));
  return { res, payload, cookie: parseCookie(res) || cookie || "" };
}
async function waitForServer(timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(`${BASE}/api/artists`)).status === 200) return true; } catch {}
    await sleep(500);
  }
  return false;
}
function startTestServer() {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(PORT)], {
    cwd: root,
    env: { ...process.env, ZIBABAN_DB_PATH: TEST_DB, NEXT_DIST_DIR: ".next-profile-jsx-test", PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const chunks = [];
  child.stdout.on("data", (b) => chunks.push(b));
  child.stderr.on("data", (b) => chunks.push(b));
  child.on("exit", () => {
    try { writeFileSync(path.join(root, "data", "zibaban-profile-jsx-test-server.log"), Buffer.concat(chunks)); } catch {}
  });
  return child;
}
async function stopServer(child) {
  if (!child || child.killed) return;
  try { child.kill("SIGTERM"); } catch {}
  await sleep(700);
  if (!child.killed) { try { child.kill("SIGKILL"); } catch {} }
}

const PANEL_NAMES = ["ProfileHero", "OwnerChatSheet", "ProfileSettingsSheet", "ServiceComposerModal"];

async function main() {
  console.log("=== seed-profile-jsx-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);
  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned profile jsx test db");
    return;
  }

  const home = readFileSync(path.join(root, "app/features/shell/HomeApp.jsx"), "utf8");
  const profileCss = readFileSync(path.join(root, "app/styles/features/profile.css"), "utf8");
  const monolith = readFileSync(path.join(root, "app/styles.css"), "utf8");

  for (const name of PANEL_NAMES) step(`HomeApp mounts ${name}`, home.includes(`<${name}`));

  step(
    "OwnerChatSheet open gates include shop|artist|salon",
    home.includes('createdProfile?.type === "shop"')
      && home.includes('createdProfile?.type === "artist"')
      && home.includes('createdProfile?.type === "salon"')
      && home.includes("<OwnerChatSheet"),
    "three-role mount"
  );
  step(
    "HomeApp wires ServiceComposerModal open={artistServiceCreateOpen}",
    /<ServiceComposerModal[\s\S]{0,200}open=\{artistServiceCreateOpen\}/.test(home)
  );
  step("HomeApp wires onPickPreset={addArtistServicePreset}", home.includes("onPickPreset={addArtistServicePreset}"));

  for (const name of PANEL_NAMES) {
    const src = readFileSync(path.join(root, "app/features/profile", `${name}.jsx`), "utf8");
    const ok = src.includes(`export function ${name}`)
      && !/import\s+.*HomeApp/.test(src)
      && !/from\s+["'][^"']*HomeApp/.test(src);
    step(`${name} exports function and does not import HomeApp`, ok);
  }

  const composer = readFileSync(path.join(root, "app/features/profile/ServiceComposerModal.jsx"), "utf8");
  step(
    "ServiceComposerModal presentational (props open/onPickPreset, no fetch)",
    composer.includes("export function ServiceComposerModal")
      && /open\s*[,}=]/.test(composer)
      && /onPickPreset/.test(composer)
      && !composer.includes("fetch(")
      && !composer.includes("/api/")
  );

  const hero = readFileSync(path.join(root, "app/features/profile/ProfileHero.jsx"), "utf8");
  step(
    "ProfileHero role branches (client/artist/salon/shop)",
    ["client", "artist", "salon", "shop"].every((r) => hero.includes(r)) && hero.includes("profileHero")
  );

  const settings = readFileSync(path.join(root, "app/features/profile/ProfileSettingsSheet.jsx"), "utf8");
  step(
    "ProfileSettingsSheet salon hours (SalonHoursEditor / settingsSalonHours / hours)",
    settings.includes("SalonHoursEditor")
      && (settings.includes("settingsSalonHours") || settings.includes("hoursOpen") || settings.includes("hours"))
  );

  step("profile.css J5 header", profileCss.includes("shared profile chrome") && profileCss.includes("J5"));
  step("styles.css imports profile.css", monolith.includes('@import "./styles/features/profile.css";'));

  const cssKeys = [".profileHero", ".artistServiceModal", ".shopOwnerChatBackdrop", ".salonHeroSheetBackdrop", ".settingsPanel", ".settingsAccount", ".settingsSalonHours", ".hoursPreset", ".hoursWeekStrip"];
  const inProfile = cssKeys.every((k) => profileCss.includes(k));
  const monoPanelDefs = [".profileHero {", ".artistServiceModal {", ".shopOwnerChatBackdrop {", ".salonHeroSheetBackdrop {", ".settingsPanel {", ".settingsAccountCard {", ".settingsSalonHours {", ".hoursPresetGrid {"].filter((k) => monolith.includes(k));
  step(
    "CSS keys in profile.css not as panel defs in monolith",
    inProfile && monoPanelDefs.length === 0,
    `profile=${inProfile} monoPanelDefs=${monoPanelDefs.length}${monoPanelDefs.length ? " " + monoPanelDefs.join("|") : ""}`
  );
  step("artist board CSS stayed out of profile.css", !profileCss.includes("artistServiceBoard") && !profileCss.includes(".artistServiceCard"));

  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) { process.exitCode = 1; return; }

    const artistReg = await api("/api/auth/register", {
      method: "POST",
      body: { type: "artist", phone: "09120005501", password: PASSWORD, data: { name: "Artist Profile JSX", area: "Tehran", service: "Hair", phone: "09120005501" } }
    });
    step("register artist", artistReg.res.ok, `status=${artistReg.res.status}`);

    const artistSvc = await api("/api/artist/me", {
      method: "POST",
      cookie: artistReg.cookie,
      body: { name: "Custom service JSX", price: "250k", duration: "60m", hint: "ServiceComposerModal" }
    });
    const aService = artistSvc.payload.data?.service || artistSvc.payload.service;
    step("POST artist custom service (/api/artist/me)", artistSvc.res.ok && Boolean(aService?.id), aService?.name || `status=${artistSvc.res.status}`);

    const salonReg = await api("/api/auth/register", {
      method: "POST",
      body: { type: "salon", phone: "09120005502", password: PASSWORD, data: { name: "Salon Profile JSX", area: "Tehran", service: "Beauty" } }
    });
    const salonId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id;
    step("register salon", salonReg.res.ok && Boolean(salonId), `id=${salonId}`);

    const salonSvc = await api("/api/salon-services", {
      method: "POST",
      cookie: salonReg.cookie,
      body: { name: "Salon service JSX", price: "300k", duration: "45m" }
    });
    step("POST salon service (/api/salon-services)", salonSvc.res.status === 201 || salonSvc.res.ok, `status=${salonSvc.res.status}`);

    const shopReg = await api("/api/auth/register", {
      method: "POST",
      body: { type: "shop", phone: "09120005503", password: PASSWORD, data: { name: "Shop Profile JSX", area: "Tehran", service: "Retail", phone: "09120005503" } }
    });
    step("register shop (OwnerChatSheet structural)", shopReg.res.ok, `status=${shopReg.res.status}`);

    const hoursGet = await api("/api/salon-hours", { cookie: salonReg.cookie });
    const hoursBefore = hoursGet.payload?.hours || [];
    if (hoursGet.res.ok && hoursBefore.length > 0) {
      const targetDay = hoursBefore.find((h) => h.day) || hoursBefore[0];
      const hoursPatch = await api("/api/salon-hours", {
        method: "PATCH",
        cookie: salonReg.cookie,
        body: { ...targetDay, day: targetDay.day, open_time: "10:00", close_time: "20:00", active: true }
      });
      step("salon hours PATCH (settings hours API)", hoursPatch.res.ok && (hoursPatch.payload?.hours || []).length > 0, `hours=${(hoursPatch.payload?.hours || []).length}`);
    } else {
      step("salon hours PATCH (settings hours API)", false, "no baseline hours");
    }
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const failed = report.filter((r) => !r.ok).length;
  console.log(`\nSCORE ${passed}/${passed + failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
