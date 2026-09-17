/**
 * J3 client JSX extract smoke (LOCAL ONLY).
 *
 * 1) Structural: HomeApp mounts ClientBookingsPanel + ClientBookingSettingsModal
 * 2) No large inline client booking list JSX left in HomeApp
 * 3) CSS: clientBooking* keys in client.css (not monolith)
 * 4) Presentational: panel exports without useSalonDirectory
 * 5) API: salon owner + client register -> POST booking -> GET client list
 *
 * Usage:
 *   node scripts/seed-client-jsx-test.mjs
 *   node scripts/seed-client-jsx-test.mjs --cleanup
 *
 * Env: ZIBABAN_CLIENT_JSX_TEST_PORT  default 3029
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-client-jsx-test.sqlite");
const PORT = Number(process.env.ZIBABAN_CLIENT_JSX_TEST_PORT || 3029);
const BASE = `http://127.0.0.1:${PORT}`;
const SALON_PHONE = "09120005501";
const CLIENT_PHONE = "09120005502";
const PASSWORD = "client-jsx-test";

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
      NEXT_DIST_DIR: ".next-client-jsx-test",
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
      writeFileSync(path.join(root, "data", "zibaban-client-jsx-test-server.log"), Buffer.concat(chunks));
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
    console.log("cleaned client jsx test db");
    return;
  }

  const home = readFileSync(path.join(root, "app/features/shell/HomeApp.jsx"), "utf8");
  const clientCss = readFileSync(path.join(root, "app/styles/features/client.css"), "utf8");
  const monolith = readFileSync(path.join(root, "app/styles.css"), "utf8");

  step("HomeApp mounts ClientBookingsPanel", home.includes("<ClientBookingsPanel"));
  step("HomeApp mounts ClientBookingSettingsModal", home.includes("<ClientBookingSettingsModal"));

  const noInlineMap = !home.includes("clientBookingList.map");
  const noInlineCard = !home.includes('className="clientBookingCard"');
  const noInlineBoard = !home.includes('className="clientBookingsBoard"');
  step(
    "HomeApp has no inline client booking list JSX",
    noInlineMap && noInlineCard && noInlineBoard,
    `map=${!noInlineMap} card=${!noInlineCard} board=${!noInlineBoard}`
  );

  step(
    "HomeApp wires onOpenSettings={setClientBookingSettings}",
    home.includes("onOpenSettings={setClientBookingSettings}")
  );
  step(
    "HomeApp wires ClientBookingSettingsModal onMessageSalon",
    /<ClientBookingSettingsModal[\s\S]*?onMessageSalon=/.test(home)
  );

  const cssKeys = [
    ".clientBookingsBoard",
    ".clientBookingCard",
    ".clientBookingSettingsBackdrop",
    ".clientBookingSettingsActions"
  ];
  const inClient = cssKeys.every((k) => clientCss.includes(k));
  // Profile shell may keep :has(.clientBookingsBoard); ban panel rule definitions in monolith.
  const monoPanelRules = [
    ".clientBookingsBoard {",
    ".clientBookingCard {",
    ".clientBookingSettingsBackdrop",
    ".clientBookingSettingsActions"
  ].filter((k) => monolith.includes(k));
  step(
    "client panel CSS in client.css (not monolith)",
    inClient && monoPanelRules.length === 0,
    `client=${inClient} monoPanelRules=${monoPanelRules.length}`
  );

  const panelFiles = ["ClientBookingsPanel", "ClientBookingSettingsModal"];
  let rendered = 0;
  for (const name of panelFiles) {
    const src = readFileSync(path.join(root, "app/features/client", `${name}.jsx`), "utf8");
    const ok = src.includes(`export function ${name}`)
      && !/import\s*\{[^}]*\buseSalonDirectory\b/.test(src)
      && !src.includes('useSalonDirectory(');
    step(`${name} presentational (no useSalonDirectory)`, ok);
    if (ok) rendered += 1;
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

    const salonReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: SALON_PHONE,
        password: PASSWORD,
        type: "salon",
        data: {
          name: "سالن تست مشتری" + " JSX",
          area: "ونک",
          service: "service",
          bio: "seed client-jsx"
        }
      }
    });
    const salonCookie = salonReg.cookie;
    const salonUserId = salonReg.payload?.data?.user?.id || salonReg.payload?.profile?.id || null;
    step(
      "register salon owner",
      salonReg.res.ok && Boolean(salonCookie) && Boolean(salonUserId),
      salonReg.res.ok ? `salonUserId=${salonUserId}` : `status=${salonReg.res.status}`
    );
    if (!salonReg.res.ok) {
      process.exitCode = 1;
      return;
    }

    const svc = await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: {
        name: "کوتاهی مو تست",
        price: "350000",
        duration: "60",
        hint: "client jsx seed"
      }
    });
    const service = svc.payload?.service || svc.payload?.data?.service;
    step(
      "seed salon service",
      (svc.res.status === 201 || svc.res.ok) && Boolean(service?.name || service?.id),
      service?.name || `status=${svc.res.status}`
    );

    const clientReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: CLIENT_PHONE,
        password: PASSWORD,
        type: "client",
        data: { name: "مشتری تست سالن", area: "تهران" }
      }
    });
    const clientCookie = clientReg.cookie;
    const clientId = clientReg.payload?.data?.user?.id || clientReg.payload?.profile?.id;
    step(
      "register client",
      clientReg.res.ok && Boolean(clientCookie) && Boolean(clientId),
      clientReg.res.ok ? `clientId=${clientId}` : `status=${clientReg.res.status}`
    );
    if (!clientReg.res.ok) {
      process.exitCode = 1;
      return;
    }

    const booked = await api("/api/salon-bookings", {
      method: "POST",
      cookie: clientCookie,
      body: {
        salonUserId,
        client: "مشتری تست سالن",
        phone: CLIENT_PHONE,
        service: "کوتاهی مو تست",
        staff: "",
        bookingDate: "امروز",
        time: "۱۱:۰۰",
        status: "درخواست"
      }
    });
    const booking = booked.payload?.booking || booked.payload?.data?.booking;
    step(
      "client POST /api/salon-bookings",
      (booked.res.status === 201 || booked.res.ok) && Boolean(booking?.id),
      booking?.id ? `id=${booking.id}` : `status=${booked.res.status} ${booked.payload.error || ""}`
    );

    const list = await api("/api/salon-bookings", { cookie: clientCookie });
    const bookings = list.payload?.bookings || list.payload?.data?.bookings || [];
    const found = bookings.some((b) => Number(b.id) === Number(booking?.id));
    step(
      "client GET /api/salon-bookings lists booking",
      list.res.ok && found,
      `bookings=${bookings.length}, found=${found}`
    );
  } finally {
    if (!keepServer) await stopServer(child);
    if (!keepServer) cleanupDbFiles();
  }

  const passed = report.filter((r) => r.ok).length;
  const total = report.length;
  console.log(`\nCLIENT JSX TEST: ${passed}/${total} passed (panels ${rendered}/2)`);
  if (passed !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
