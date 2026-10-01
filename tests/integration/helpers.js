import { TEST_BASE_URL } from "../globalSetup.js";

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

let phoneCounter = 0;
/** Unique-per-call Iranian mobile number (all test files share one live
 *  database, sequentially -- see vitest.config.js -- so every registered
 *  user across every test needs a phone that's never been used before).
 *
 *  Vitest gives each test file its own isolated module registry (visible
 *  as separate worker startups even with fileParallelism: false), so a
 *  plain in-module counter restarts at 0 for every file and collides with
 *  phones already registered by an earlier file. A random per-module salt
 *  (fixed for the lifetime of one file's run) combined with the counter
 *  keeps numbers unique both within a file and across files. */
const fileSalt = Math.floor(Math.random() * 900) + 100;
export function uniquePhone() {
  phoneCounter += 1;
  return `0912${fileSalt}${String(1000 + phoneCounter).slice(-4)}`;
}

export async function registerUser(client, { type = "client", name = "Test User", password = "testpass123" } = {}) {
  const phone = uniquePhone();
  const res = await client.post("/api/auth/register", { phone, password, type, name });
  if (!res.ok) throw new Error(`registerUser failed: ${JSON.stringify(res.payload)}`);
  return { phone, password, user: res.payload.data.user };
}
