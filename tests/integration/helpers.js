import { TEST_BASE_URL } from "../globalSetup.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

/** A tiny cookie-jar-aware HTTP client for driving the real running test
 *  server (see globalSetup.js) -- session auth is an httpOnly cookie, so
 *  a bare fetch() per call would silently be a fresh anonymous request
 *  every time. */
export function createClient() {
  let cookie = "";
  async function request(path, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(`${TEST_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      // Keep just the name=value pair (drop Path/HttpOnly/... attributes)
      // for reuse as a request Cookie header on the next call.
      cookie = setCookie.split(";")[0];
    }
    const payload = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, payload };
  }
  return {
    get: (path, opts) => request(path, { ...opts, method: "GET" }),
    post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
    patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
    delete: (path, body, opts) => request(path, { ...opts, method: "DELETE", body })
  };
}

const usedPhones = new Set();
/** Unique-per-call Iranian mobile number (all test files share one live
 *  database, sequentially -- see vitest.config.js -- so every registered
 *  user across every test needs a phone that's never been used before).
 *
 *  Vitest gives each test file its own isolated module registry, so
 *  in-module state restarts for every file and can't coordinate across
 *  files. An earlier "random per-file salt + counter" scheme collided
 *  whenever two files drew the same 3-digit salt (~2% of runs, surfacing as
 *  "این شماره قبلاً ثبت شده است" in whichever file ran second). Drawing a
 *  fresh random 7-digit suffix per call makes a clash across the whole run
 *  vanishingly unlikely (tens of phones in a 10^7 space), and the in-module
 *  set rules out repeats within one file. */
export function uniquePhone() {
  for (;;) {
    const suffix = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
    if (usedPhones.has(suffix)) continue;
    usedPhones.add(suffix);
    return `0912${suffix}`;
  }
}

export async function registerUser(client, { type = "client", name = "Test User", password = "testpass123" } = {}) {
  const phone = uniquePhone();
  const res = await client.post("/api/auth/register", { phone, password, type, name });
  if (!res.ok) throw new Error(`registerUser failed: ${JSON.stringify(res.payload)}`);
  return { phone, password, user: res.payload.data.user };
}

/** A Persian date key a few open (non-Friday) days from now, so booking tests never land on a past slot. */
export function futureBookingDay(openDaysAhead = 2) {
  const day = new Date();
  let found = 0;
  while (found < openDaysAhead) {
    day.setDate(day.getDate() + 1);
    if (getPersianWeekday(day) !== "جمعه") found += 1;
  }
  return formatPersianDateKey(day);
}
