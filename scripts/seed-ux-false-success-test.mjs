/**
 * UX false-success fix verification (C1 / C7 / C8) — LOCAL ONLY.
 *
 * DB: data/zibaban-ux-false-success-test.sqlite
 *
 * Covers:
 * - Helper prefers payload.error over message / fallback
 * - notifyFromResponse never emits success on !ok and blocks state update
 * - Live API failures (401 / wrong role / insufficient shells) surface Persian errors
 * - Beauty passport error field is `error` (C8)
 * - Wallet shell spend returns real error strings (C7)
 *
 * Usage:
 *   node scripts/seed-ux-false-success-test.mjs
 *   node scripts/seed-ux-false-success-test.mjs --cleanup
 *
 * Env: ZIBABAN_UX_FALSE_SUCCESS_TEST_PORT  default 3036
 */
import { spawn } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(root, "data", "zibaban-ux-false-success-test.sqlite");
const PORT = Number(process.env.ZIBABAN_UX_FALSE_SUCCESS_TEST_PORT || 3036);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "ux-false-success-test";

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
      NEXT_DIST_DIR: ".next-ux-false-success-test",
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
      writeFileSync(path.join(root, "data", "zibaban-ux-false-success-test-server.log"), Buffer.concat(chunks));
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

/**
 * Mirrors fixed client mutation pattern (C1): notify error on !ok, do not mutate local state.
 */
function applyStaffCreateClient(result, localStaff, successText = "پرسنل جدید در دیتابیس سالن ذخیره شد.") {
  const toasts = [];
  const notify = (msg) => toasts.push(msg);
  let staff = [...localStaff];
  let updated = false;

  // Same contract as notifyFromResponse + early return before setState
  if (!result.ok) {
    notify(result.payload?.error || result.payload?.message || "ثبت پرسنل انجام نشد؛ دوباره امتحان کن.");
    return { staff, toasts, updated };
  }
  staff = Array.isArray(result.payload.staff) ? result.payload.staff : staff;
  updated = true;
  notify(successText);
  return { staff, toasts, updated };
}

async function main() {
  console.log("=== seed-ux-false-success-test ===");
  console.log("DB:", TEST_DB);
  console.log("PORT:", PORT);

  if (doCleanupOnly) {
    cleanupDbFiles();
    console.log("cleaned ux-false-success test db");
    return;
  }

  const helperMod = await import(pathToFileURL(path.join(root, "app", "shared", "lib", "apiNotify.js")).href);
  const { getApiErrorMessage, notifyFromResponse } = helperMod;

  // --- unit: helper ---
  console.log("\n--- helper unit ---");
  step(
    "getApiErrorMessage prefers error over message",
    getApiErrorMessage({ error: "ورود لازم است.", message: "ignored" }, "fb") === "ورود لازم است."
  );
  step(
    "getApiErrorMessage falls back to message then fallback",
    getApiErrorMessage({ message: "فقط سالن." }, "fb") === "فقط سالن."
      && getApiErrorMessage({}, "fb") === "fb"
  );

  {
    const toasts = [];
    const okNotify = notifyFromResponse((m) => toasts.push(m), { ok: false, payload: { error: "دسترسی غیرمجاز." } }, {
      success: "SUCCESS_SHOULD_NOT_SHOW",
      failure: "fallback"
    });
    step(
      "notifyFromResponse on fail → error toast, not success",
      okNotify === false && toasts.length === 1 && toasts[0] === "دسترسی غیرمجاز." && !toasts.includes("SUCCESS_SHOULD_NOT_SHOW"),
      `toasts=${JSON.stringify(toasts)}`
    );
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

    // --- C1: salon staff without session ---
    console.log("\n--- C1 salon mutations fail path ---");
    const noAuthStaff = await api("/api/salon-staff", {
      method: "POST",
      body: { name: "Should Not Persist", role: "میکاپ" }
    });
    step(
      "POST /api/salon-staff without auth → 401 + error",
      noAuthStaff.res.status === 401 && Boolean(noAuthStaff.payload.error),
      `status=${noAuthStaff.res.status} error=${noAuthStaff.payload.error}`
    );

    const localBefore = [{ id: 1, name: "Existing Staff" }];
    const clientApply = applyStaffCreateClient(
      { ok: noAuthStaff.ok, payload: noAuthStaff.payload },
      localBefore
    );
    step(
      "client pattern: toast is error, state unchanged",
      clientApply.updated === false
        && clientApply.staff.length === 1
        && clientApply.staff[0].name === "Existing Staff"
        && clientApply.toasts[0] === noAuthStaff.payload.error
        && !/ذخیره شد|موفق/.test(clientApply.toasts[0] || ""),
      `toast=${clientApply.toasts[0]} staff=${clientApply.staff.map((s) => s.name).join(",")}`
    );

    // Client user hitting salon-only endpoints
    const clientReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09135004101",
        password: PASSWORD,
        type: "client",
        data: { name: "مشتری UX", area: "تهران" }
      }
    });
    const clientCookie = clientReg.cookie;
    step("register client", clientReg.res.ok && Boolean(clientCookie));

    const hoursAsClient = await api("/api/salon-hours", {
      method: "PATCH",
      cookie: clientCookie,
      body: { day: "شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", active: true }
    });
    step(
      "PATCH hours as client → fail + error (not success)",
      !hoursAsClient.ok && Boolean(hoursAsClient.payload.error),
      `status=${hoursAsClient.res.status} error=${hoursAsClient.payload.error}`
    );
    {
      const toasts = [];
      const applied = notifyFromResponse((m) => toasts.push(m), hoursAsClient, {
        success: "تقویم ذخیره شد.",
        failure: "به‌روزرسانی تقویم سالن انجام نشد؛ دوباره امتحان کن."
      });
      step(
        "hours client notifyFromResponse blocks success",
        applied === false && toasts[0] === hoursAsClient.payload.error,
        `toast=${toasts[0]}`
      );
    }

    const deleteSvc = await api("/api/salon-services", {
      method: "DELETE",
      cookie: clientCookie,
      body: { id: 99999 }
    });
    step(
      "DELETE service as client → fail + error",
      !deleteSvc.ok && Boolean(deleteSvc.payload.error),
      `status=${deleteSvc.res.status} error=${deleteSvc.payload.error}`
    );

    // Staff PATCH missing id as salon (404) after register salon
    const salonReg = await api("/api/auth/register", {
      method: "POST",
      body: {
        phone: "09135004102",
        password: PASSWORD,
        type: "salon",
        data: { name: "سالن UX False", area: "تهران", service: "زیبایی" }
      }
    });
    const salonCookie = salonReg.cookie;
    step("register salon", salonReg.res.ok && Boolean(salonCookie));

    const hoursGet = await api("/api/salon-hours", { cookie: salonCookie });
    const hoursSnapshot = hoursGet.payload?.hours || [];
    step("hours baseline", hoursGet.ok && hoursSnapshot.length > 0, `count=${hoursSnapshot.length}`);

    const badStaffPatch = await api("/api/salon-staff", {
      method: "PATCH",
      cookie: salonCookie,
      body: { id: 999999, name: "Ghost" }
    });
    step(
      "PATCH staff missing id → 404 error",
      badStaffPatch.res.status === 404 && Boolean(badStaffPatch.payload.error),
      `status=${badStaffPatch.res.status} error=${badStaffPatch.payload.error}`
    );
    {
      let localStaff = [{ id: 1, name: "Real" }];
      const toasts = [];
      if (!notifyFromResponse((m) => toasts.push(m), badStaffPatch, { failure: "به‌روزرسانی پرسنل انجام نشد." })) {
        // state untouched
      } else {
        localStaff = badStaffPatch.payload.staff || localStaff;
        toasts.push("SUCCESS");
      }
      step(
        "staff patch fail keeps local state",
        localStaff.length === 1 && localStaff[0].name === "Real" && toasts[0] === badStaffPatch.payload.error,
        `toast=${toasts[0]}`
      );
    }

    // --- C7: wallet shell spend errors ---
    console.log("\n--- C7 AI / wallet shell spend ---");
    const spendNoAuth = await api("/api/wallet", {
      method: "POST",
      body: { amount: -1, note: "AI test" }
    });
    step(
      "shell spend without auth → error (not balance msg only)",
      !spendNoAuth.ok && Boolean(spendNoAuth.payload.error),
      `error=${spendNoAuth.payload.error}`
    );
    step(
      "C7 helper shows server error for no-auth spend",
      getApiErrorMessage(spendNoAuth.payload, "مصرف شل انجام نشد؛ دوباره امتحان کن.") === spendNoAuth.payload.error
    );

    const spendZero = await api("/api/wallet", {
      method: "POST",
      cookie: clientCookie,
      body: { amount: -1, note: "AI test" }
    });
    step(
      "shell spend with 0 balance → موجودی شل کافی نیست",
      !spendZero.ok && spendZero.payload.error === "موجودی شل کافی نیست.",
      `error=${spendZero.payload.error}`
    );
    step(
      "C7 insufficient uses server string (not hardcoded UI-only)",
      getApiErrorMessage(spendZero.payload, "مصرف شل انجام نشد؛ دوباره امتحان کن.") === "موجودی شل کافی نیست."
    );

    // --- C8: beauty passport ---
    console.log("\n--- C8 beauty passport ---");
    const passportFail = await api("/api/beauty-passport", {
      method: "POST",
      cookie: clientCookie,
      body: {}
    });
    step(
      "passport with 0 shells → payload.error set",
      !passportFail.ok && Boolean(passportFail.payload.error) && !passportFail.payload.message,
      `error=${passportFail.payload.error} message=${passportFail.payload.message}`
    );
    const passportToast = getApiErrorMessage(
      passportFail.payload,
      "برای فعال‌سازی شناسنامه زیبایی ۱۰ شل لازم است."
    );
    step(
      "C8 toast uses error first",
      passportToast === passportFail.payload.error
        && (/۱۰|10|شل|پاسپورت/.test(passportToast)),
      `toast=${passportToast}`
    );

    // Old buggy path would show fallback when only error exists if it read .message
    const buggyToast = passportFail.payload.message || "برای فعال‌سازی شناسنامه زیبایی ۱۰ شل لازم است.";
    step(
      "old buggy .message path would miss server error",
      buggyToast !== passportFail.payload.error && passportToast === passportFail.payload.error,
      `buggy=${buggyToast} fixed=${passportToast}`
    );

    // Hours list unchanged after failed client patch (server truth)
    const hoursAfter = await api("/api/salon-hours", { cookie: salonCookie });
    step(
      "salon hours unchanged after foreign fail",
      JSON.stringify(hoursAfter.payload?.hours || []) === JSON.stringify(hoursSnapshot),
      `count=${(hoursAfter.payload?.hours || []).length}`
    );
  } finally {
    if (!keepServer) await stopServer(child);
    cleanupDbFiles();
    console.log("cleaned ux-false-success test db");
  }

  const failed = report.filter((item) => !item.ok).length;
  console.log(`\n=== result: ${report.length - failed}/${report.length} PASS ===`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
