import { describe, it, expect } from "vitest";
import { createClient, registerUser, uniquePhone } from "./helpers.js";
import { TEST_BASE_URL } from "../globalSetup.js";

/** Chaos round 1: identity, rate limits, OTP and junk input. Every `it` states what SHOULD hold; a red one is a finding. */
const note = (...args) => console.log("[chaos]", ...args);
const tally = (results) => results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
const raw = (path, init = {}) => fetch(`${TEST_BASE_URL}${path}`, init);

describe("signup races", () => {
  it("30 concurrent sign-ups with ONE phone: exactly one account, no 500", async () => {
    const phone = uniquePhone();
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => createClient().post("/api/auth/register", { phone, password: "testpass123", type: "client", name: `Race ${i}` }, { headers: { "x-real-ip": `10.1.0.${i}` } }))
    );
    note("same-phone signup", tally(results));
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => r.status >= 500).length).toBe(0);
  });

  it("20 concurrent salons with the SAME name (different phones): one wins", async () => {
    const name = `سالن رقابت ${Math.random().toString(36).slice(2, 7)}`;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => createClient().post("/api/auth/register", { phone: uniquePhone(), password: "testpass123", type: "salon", name }, { headers: { "x-real-ip": `10.2.0.${i}` } }))
    );
    note("same-name salon signup", tally(results));
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.filter((r) => r.status >= 500).length).toBe(0);
  });
});

describe("rate limits under a burst", () => {
  it("80 parallel wrong-password logins for one phone: far fewer than 80 get a real answer", async () => {
    const user = await registerUser(createClient(), { type: "client" });
    const results = await Promise.all(
      Array.from({ length: 80 }, () => createClient().post("/api/auth/login", { phone: user.phone, password: "wrong-password-1" }))
    );
    const answered = results.filter((r) => r.status !== 429).length;
    note("login burst", tally(results), "answered:", answered);
    expect(answered).toBeLessThan(25);
  });

  it("OTP verify: 300 parallel guesses against ONE live code cannot test more than ~12 codes", async () => {
    const phone = uniquePhone();
    const anon = createClient();
    expect((await anon.post("/api/auth/otp/send", { phone, purpose: "register" })).ok).toBe(true);
    const results = await Promise.all(
      Array.from({ length: 300 }, (_, i) => createClient().post("/api/auth/otp/verify", { phone, code: String(10000 + i) }))
    );
    const tested = results.filter((r) => r.status !== 429 && r.payload?.code !== "expired").length;
    note("otp verify burst", tally(results), "guesses actually evaluated:", tested);
    expect(tested).toBeLessThanOrEqual(15);
  });
});

describe("junk input", () => {
  const NUL = "a\u0000b";
  it("NUL byte in name / search / bio never gives a 500", async () => {
    const reg = await createClient().post("/api/auth/register", { phone: uniquePhone(), password: "testpass123", type: "client", name: NUL });
    note("register NUL name", reg.status);
    expect(reg.status).toBeLessThan(500);
    const c = createClient();
    await registerUser(c, { type: "client" });
    const search = await c.get(`/api/connections/search?q=${encodeURIComponent(NUL)}`);
    note("search NUL", search.status);
    expect(search.status).toBeLessThan(500);
    const profile = await c.post("/api/profile", { name: NUL, bio: NUL });
    note("profile NUL", profile.status);
    expect(profile.status).toBeLessThan(500);
  });

  it("lone surrogate / enormous names are rejected or trimmed, never 500", async () => {
    const results = [];
    for (const name of ["\ud800", "x".repeat(200_000), "😀".repeat(5000)]) {
      results.push(await createClient().post("/api/auth/register", { phone: uniquePhone(), password: "testpass123", type: "artist", name }));
    }
    note("odd names", results.map((r) => r.status));
    for (const r of results) expect(r.status).toBeLessThan(500);
  });

  it("wrong JSON shapes on public endpoints give 4xx, not 500", async () => {
    const bodies = ["[]", "null", "42", '"str"', "{", "", '{"phone":{"a":1},"password":["x"]}', '{"phone":"09121234567","password":123456789}'];
    const statuses = [];
    for (const path of ["/api/auth/register", "/api/auth/login", "/api/auth/otp/send", "/api/auth/otp/verify", "/api/auth/password-reset/confirm"]) {
      for (const body of bodies) {
        const res = await raw(path, { method: "POST", headers: { "Content-Type": "application/json" }, body });
        statuses.push([path, body.slice(0, 12), res.status]);
      }
    }
    const bad = statuses.filter(([, , s]) => s >= 500);
    note("shape 5xx:", JSON.stringify(bad));
    expect(bad).toEqual([]);
  });

  it("a 30 MB JSON body is refused quickly", async () => {
    const started = Date.now();
    const res = await raw("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: uniquePhone(), password: "testpass123", type: "client", name: "x".repeat(30 * 1024 * 1024) }) });
    note("30MB register", res.status, `${Date.now() - started}ms`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("ids in paths: huge, negative, float, text", async () => {
    const c = createClient();
    await registerUser(c, { type: "client" });
    const bad = [];
    for (const id of ["0", "-1", "1.5", "abc", "99999999999999999999", "1e9", "%00", "../../etc"]) {
      for (const base of ["/api/salons/", "/api/artists/", "/api/posts/", "/api/media/avatar/", "/api/media/post/"]) {
        const res = await raw(base + id, { headers: { Cookie: c.cookie() } });
        if (res.status >= 500) bad.push([base + id, res.status]);
      }
    }
    note("id 5xx:", JSON.stringify(bad));
    expect(bad).toEqual([]);
  });
});

describe("heavy fan-in", () => {
  it("200 clients connect to one salon at once; no 5xx", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: `سالن شلوغ ${Math.random().toString(36).slice(2, 6)}` });
    const jars = [];
    for (let i = 0; i < 200; i += 1) {
      const c = createClient();
      await registerUser(c, { type: "client" });
      jars.push(c);
    }
    const started = Date.now();
    const results = await Promise.all(jars.map((c) => c.post("/api/salon-follow", { salonUserId: salon.user.id })));
    note("200 follow", tally(results), `${Date.now() - started}ms`);
    expect(results.filter((r) => r.status >= 500).length).toBe(0);
  }, 180_000);

  it("600 concurrent cheap GETs: no 5xx and the server stays healthy", async () => {
    const started = Date.now();
    const results = await Promise.all(Array.from({ length: 600 }, () => raw("/api/salons").then((r) => ({ status: r.status }))));
    note("600 GET /api/salons", tally(results), `${Date.now() - started}ms`);
    expect(results.filter((r) => r.status >= 500).length).toBe(0);
    expect((await raw("/api/health")).ok).toBe(true);
  }, 120_000);
});
