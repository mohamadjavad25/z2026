/**
 * J2 artist owner JSX extract smoke (LOCAL ONLY).
 *
 * 1) Structural: HomeApp mounts the 4 presentational panels
 * 2) CSS: key panel classes live in artist.css (not monolith)
 * 3) Presentational: exports without domain hooks
 * 4) API: register artist → create service → set break → delete service
 *    (actions still hooked for ArtistServicesPanel / ArtistBreakEditorModal)
 *
 * Usage:
 *   node scripts/seed-artist-jsx-test.mjs
 *   node scripts/seed-artist-jsx-test.mjs --cleanup
 *
 * Env: ZIBABAN_ARTIST_JSX_TEST_PORT  default 3028
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-artist-jsx-test.sqlite");
const PORT = Number(process.env.ZIBABAN_ARTIST_JSX_TEST_PORT || 3028);
const BASE = `http://127.0.0.1:${PORT}`;
const PHONE = "09120004455";
const PASSWORD = "artist-jsx-test";

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
      const res = await fetch(`${BASE}/api/artists`);
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
      NEXT_DIST_DIR: ".next-artist-jsx-test",
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
      writeFileSync(path.join(root, "data", "zibaban-artist-jsx-test-server.log"), Buffer.concat(chunks));
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
  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned artist jsx test db");
    return;
  }

  const home = readFileSync(path.join(root, "app/features/shell/HomeApp.jsx"), "utf8");
  const artistCss = readFileSync(path.join(root, "app/styles/features/artist.css"), "utf8");
  const monolith = readFileSync(path.join(root, "app/styles.css"), "utf8");

  const mounts = [
    "<ArtistOverviewReviews",
    "<ArtistServicesPanel",
    "<ArtistWorkPreviewModal",
    "<ArtistBreakEditorModal"
  ];
  step(
    "HomeApp mounts all 4 artist owner panels",
    mounts.every((m) => home.includes(m)),
    mounts.filter((m) => !home.includes(m)).join(",") || "all"
  );

  // schedule triad must remain in HomeApp (not extracted)
  step(
    "schedule triad still in HomeApp (not extracted)",
    home.includes("scheduleNow") && home.includes("scheduleViewDay") && home.includes("scheduleBookingMenu"),
    "scheduleNow/ViewDay/BookingMenu"
  );

  const cssKeys = [
    ".artistDashboard",
    ".artistServiceBoard",
    ".artistReviewRail",
    ".artistWorkPreviewModal",
    ".artistBreakEditorActions",
    ".artistServiceCard"
  ];
  const inArtist = cssKeys.every((k) => artistCss.includes(k));
  const notInMono = cssKeys.every((k) => !monolith.includes(k));
  step("artist panel CSS moved to artist.css", inArtist && notInMono, `artist=${inArtist} monoClean=${notInMono}`);

  let rendered = 0;
  const panelFiles = [
    "ArtistOverviewReviews",
    "ArtistServicesPanel",
    "ArtistWorkPreviewModal",
    "ArtistBreakEditorModal"
  ];
  for (const name of panelFiles) {
    const src = readFileSync(path.join(root, "app/features/artist", `${name}.jsx`), "utf8");
    const ok = src.includes(`export function ${name}`)
      && !/import\s*\{[^}]*useArtistWorkspace/.test(src)
      && !src.includes("from \"../shell");
    step(`${name} presentational export (no workspace hook)`, ok);
    if (ok) rendered += 1;
  }

  // Break editor may use local useState? Currently no — good. Services neither.
  // Overview has no useState. Preview has no useState.

  cleanupDbFiles();
  const child = startTestServer();
  try {
    const up = await waitForServer();
    step("test server up", up, BASE);
    if (!up) {
      process.exitCode = 1;
      return;
    }

    const reg = await api("/api/auth/register", {
      method: "POST",
      body: {
        type: "artist",
        phone: PHONE,
        password: PASSWORD,
        data: { name: "آرتیست JSX", area: "تهران", service: "میکاپ", phone: PHONE }
      }
    });
    step("register artist", reg.res.ok, `status=${reg.res.status}`);
    const cookie = reg.cookie;

    const created = await api("/api/artist/me", {
      method: "POST",
      cookie,
      body: {
        name: "میکاپ نود",
        price: "۱.۲ م",
        duration: "۹۰ دقیقه",
        hint: "از ArtistServicesPanel"
      }
    });
    const service = created.payload.data?.service || created.payload.service;
    step("create service via artist API (services panel target)", created.res.ok && Boolean(service?.id), service?.name || "");

    const me1 = await api("/api/artist/me", { cookie });
    const services = me1.payload.data?.services || me1.payload.services || [];
    step(
      "artist/me lists service for ArtistServicesPanel",
      me1.res.ok && services.some((s) => s.id === service?.id),
      `services=${services.length}`
    );

    const breakSet = await api("/api/artist/me", {
      method: "POST",
      cookie,
      body: { kind: "break", startTime: "۱۳:۰۰", endTime: "۱۴:۰۰" }
    });
    const breakTime = breakSet.payload.data?.breakTime || breakSet.payload.breakTime;
    step(
      "save break via artist API (break editor target)",
      breakSet.res.ok && Boolean(breakTime?.start || breakTime?.startTime || breakTime),
      JSON.stringify(breakTime || {})
    );

    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const post = await api("/api/posts", {
      method: "POST",
      cookie,
      body: {
        title: "نمونه JSX",
        tag: "میکاپ",
        caption: "برای overview/preview",
        image: tinyPng,
        inExplore: true,
        featured: true
      }
    });
    const portfolio = post.payload.data?.post || post.payload.post;
    step(
      "create portfolio post (overview/preview target)",
      post.res.ok && Boolean(portfolio?.id),
      portfolio?.title || `status=${post.res.status}`
    );

    const del = await api("/api/artist/me", {
      method: "DELETE",
      cookie,
      body: { id: service?.id }
    });
    step("delete service via artist API (services panel onDelete)", del.res.ok, `status=${del.res.status}`);

    const me2 = await api("/api/artist/me", { cookie });
    const servicesAfter = me2.payload.data?.services || me2.payload.services || [];
    step(
      "service removed after delete",
      me2.res.ok && !servicesAfter.some((s) => s.id === service?.id),
      `services=${servicesAfter.length}`
    );

    const breakClear = await api("/api/artist/me", {
      method: "POST",
      cookie,
      body: { kind: "break", clear: true }
    });
    step("clear break via artist API (break editor onClear)", breakClear.res.ok, `status=${breakClear.res.status}`);
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nARTIST JSX TEST: ${passed}/${total} passed (panels ${rendered}/4)`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
