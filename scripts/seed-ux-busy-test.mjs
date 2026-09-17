/**
 * UX busy / double-submit fix verification (C2–C6) — LOCAL ONLY.
 *
 * DB: data/zibaban-ux-busy-test.sqlite
 *
 * For each C2–C6:
 * - Parallel double-call with busy gate → only one runs
 * - After completion, busy is false again
 * - Live API smoke where useful (wallet shell, salon booking patch)
 *
 * Usage:
 *   node scripts/seed-ux-busy-test.mjs
 *   node scripts/seed-ux-busy-test.mjs --cleanup
 *
 * Env: ZIBABAN_UX_BUSY_TEST_PORT  default 3037
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-ux-busy-test.sqlite");
const PORT = Number(process.env.ZIBABAN_UX_BUSY_TEST_PORT || 3037);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "ux-busy-test";

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
  return { res, payload, cookie: parseCookie(res) || cookie || "", ok: res.ok };
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
      NEXT_DIST_DIR: ".next-ux-busy-test",
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
      writeFileSync(path.join(root, "data", "zibaban-ux-busy-test-server.log"), Buffer.concat(chunks));
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
  console.log("=== seed-ux-busy-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned ux-busy test db");
    return;
  }

  const { createBusyGate, createBusyIdGate } = await import(
    pathToFileURL(path.join(root, "app", "shared", "lib", "busyGate.js")).href
  );

  // --- unit gates (mirrors hook ref pattern) ---
  console.log("\n--- busy gate unit ---");
  {
    const gate = createBusyGate();
    let runs = 0;
    const slow = () => new Promise((resolve) => {
      runs += 1;
      setTimeout(resolve, 80);
    });
    const [a, b] = await Promise.all([gate.run(slow), gate.run(slow)]);
    step("C2–C5 gate: parallel → one run, one skipped", a.ok && b.skipped && runs === 1, `runs=${runs} a=${a.ok} b.skipped=${b.skipped}`);
    step("C2–C5 gate: busy false after", gate.isBusy() === false);
    const c = await gate.run(slow);
    step("C2–C5 gate: reusable after clear", c.ok && runs === 2, `runs=${runs}`);
  }

  {
    const gate = createBusyIdGate();
    let runs = 0;
    const slow = () => new Promise((resolve) => {
      runs += 1;
      setTimeout(resolve, 80);
    });
    const [a, b] = await Promise.all([
      gate.run("reservation:1", slow),
      gate.run("reservation:1", slow)
    ]);
    step("C6 id-gate: parallel same id → one run", a.ok && b.skipped && runs === 1, `runs=${runs}`);
    step("C6 id-gate: busyId cleared", gate.getBusyId() === "");
  }

  // Simulate buyShells / confirmPublicArtistBooking / addSalonAppointment / patchSalonAppointment
  async function simulateHookAction(label, apiFn) {
    const gate = createBusyGate();
    let apiHits = 0;
    const action = () => gate.run(async () => {
      apiHits += 1;
      return apiFn();
    });
    const [first, second] = await Promise.all([action(), action()]);
    step(`${label}: double parallel → one API hit`, apiHits === 1 && first.ok && second.skipped, `hits=${apiHits}`);
    step(`${label}: busy cleared`, gate.isBusy() === false);
    return { apiHits, first, second };
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
        phone: "09136005101",
        password: PASSWORD,
        type: "salon",
        data: { name: "سالن Busy UX", area: "تهران", service: "زیبایی" }
      }
    });
    const salonCookie = salonReg.cookie;
    step("register salon", salonReg.res.ok && Boolean(salonCookie));

    const clientReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09136005102",
        password: PASSWORD,
        type: "client",
        data: { name: "مشتری Busy", area: "تهران" }
      }
    });
    const clientCookie = clientReg.cookie;
    step("register client", clientReg.res.ok && Boolean(clientCookie));

    const artistReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09136005103",
        password: PASSWORD,
        type: "artist",
        data: { name: "آرتیست Busy", area: "تهران", service: "میکاپ" }
      }
    });
    const artistCookie = artistReg.cookie;
    const artistId = artistReg.payload?.data?.user?.id || artistReg.payload?.profile?.id;
    step("register artist", artistReg.res.ok && Boolean(artistId), `id=${artistId}`);

    // Seed shells for client so C2 can succeed once
    await api("/api/wallet", {
      method: "POST",
      cookie: clientCookie,
      body: { kind: "shell", amount: 50, note: "seed shells" }
    });

    // --- C2 buyShells pattern ---
    console.log("\n--- C2 buyShells ---");
    await simulateHookAction("C2 buyShells", async () => {
      const r = await api("/api/wallet", {
        method: "POST",
        cookie: clientCookie,
        body: { kind: "shell", amount: 10, note: "busy test buy" }
      });
      if (!r.ok) throw new Error(r.payload.error || "buy failed");
      return r.payload;
    });

    // Without gate, parallel buys would both hit (document server is NOT idempotent)
    {
      const before = await api("/api/wallet", { cookie: clientCookie });
      const balBefore = Number(before.payload?.shellBalance ?? before.payload?.data?.shellBalance ?? 0);
      const [x, y] = await Promise.all([
        api("/api/wallet", { method: "POST", cookie: clientCookie, body: { kind: "shell", amount: 1, note: "ungated-a" } }),
        api("/api/wallet", { method: "POST", cookie: clientCookie, body: { kind: "shell", amount: 1, note: "ungated-b" } })
      ]);
      const after = await api("/api/wallet", { cookie: clientCookie });
      const balAfter = Number(after.payload?.shellBalance ?? after.payload?.data?.shellBalance ?? 0);
      const bothOk = x.ok && y.ok;
      step(
        "C2 note: ungated parallel API can both succeed (not idempotent)",
        bothOk && balAfter === balBefore + 2,
        `Δ=${balAfter - balBefore} (client busy gate is required)`
      );
    }

    // --- C3 public artist booking ---
    console.log("\n--- C3 public artist booking ---");
    await api("/api/artist/me", {
      method: "POST",
      cookie: artistCookie,
      body: { name: "میکاپ Busy", price: "500", duration: "۶۰ دقیقه" }
    });
    await simulateHookAction("C3 confirmPublicArtistBooking", async () => {
      const r = await api("/api/artist/bookings", {
        method: "POST",
        cookie: clientCookie,
        body: {
          artistUserId: artistId,
          service: "میکاپ Busy",
          bookingDate: "امروز",
          time: "۱۰:۰۰",
          durationMinutes: 60,
          clientName: "مشتری Busy",
          clientPhone: "09136005102"
        }
      });
      // first may succeed; second parallel is skipped by gate before API
      return r;
    });

    // --- C4 owner salon booking create ---
    console.log("\n--- C4 salon addSalonAppointment ---");
    const staff = await api("/api/salon-staff", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "Staff Busy", role: "میکاپ" }
    });
    await api("/api/salon-services", {
      method: "POST",
      cookie: salonCookie,
      body: { name: "خدمت Busy", price: "400", duration: "۶۰ دقیقه", staff_id: staff.payload?.person?.id }
    });
    await simulateHookAction("C4 addSalonAppointment", async () => {
      const r = await api("/api/salon-bookings", {
        method: "POST",
        cookie: salonCookie,
        body: {
          client: "Owner Create",
          phone: "09136005999",
          service: "خدمت Busy",
          staff: "Staff Busy",
          booking_date: "امروز",
          time: "۱۲:۰۰",
          durationMinutes: 60,
          status: "تازه"
        }
      });
      if (!r.ok && r.res.status !== 409) throw new Error(r.payload.error || "create failed");
      return r;
    });

    // --- C5 schedule patch ---
    console.log("\n--- C5 schedule patch ---");
    const list = await api("/api/salon-bookings", { cookie: salonCookie });
    const booking = (list.payload?.bookings || []).find((row) => row.status !== "لغو");
    step("C5 has booking to patch", Boolean(booking?.id), `id=${booking?.id}`);
    if (booking?.id) {
      await simulateHookAction("C5 patchSalonAppointment", async () => {
        const r = await api("/api/salon-bookings", {
          method: "PATCH",
          cookie: salonCookie,
          body: { id: booking.id, time: "۱۴:۳۰" }
        });
        if (!r.ok) throw new Error(r.payload.error || "patch failed");
        return r;
      });
    }

    // --- C6 approve reservation / collab id gate ---
    console.log("\n--- C6 approve busy-id ---");
    {
      const gate = createBusyIdGate();
      let hits = 0;
      const approve = (id) => gate.run(`reservation:${id}`, async () => {
        hits += 1;
        // Simulate createSalonBooking for approval
        await api("/api/salon-bookings", {
          method: "POST",
          cookie: salonCookie,
          body: {
            client: `Approve ${id}`,
            phone: "09136005888",
            service: "خدمت Busy",
            staff: "Staff Busy",
            booking_date: "امروز",
            time: "۱۶:۰۰",
            durationMinutes: 60,
            status: "تایید"
          }
        });
      });
      const [a, b] = await Promise.all([approve("r1"), approve("r1")]);
      step("C6 reservation approve parallel → one hit", hits === 1 && a.ok && b.skipped, `hits=${hits}`);
      step("C6 reservation busy cleared", gate.getBusyId() === "");

      let collabHits = 0;
      const collab = (id) => gate.run(`collab:${id}`, async () => {
        collabHits += 1;
        await sleep(40);
      });
      const [c1, c2] = await Promise.all([collab("c9"), collab("c9")]);
      step("C6 collab approve parallel → one hit", collabHits === 1 && c1.ok && c2.skipped, `hits=${collabHits}`);
      step("C6 collab busy cleared", gate.getBusyId() === "");
    }

    // Fail path still clears busy
    console.log("\n--- busy clears on error ---");
    {
      const gate = createBusyGate();
      const failed = await gate.run(async () => {
        throw new Error("boom");
      }).catch(() => null);
      // createBusyGate doesn't catch — wrap like hooks finally
      const gate2 = createBusyGate();
      let threw = false;
      try {
        await gate2.run(async () => {
          throw new Error("boom");
        });
      } catch {
        threw = true;
      }
      step("busy clears after thrown error", threw && gate2.isBusy() === false, `threw=${threw} busy=${gate2.isBusy()}`);
      void failed;
    }
  } finally {
    if (!keepServer) await stopServer(child);
    cleanupDbFiles();
    console.log("cleaned ux-busy test db");
  }

  const failed = report.filter((item) => !item.ok).length;
  console.log(`\n=== result: ${report.length - failed}/${report.length} PASS ===`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
