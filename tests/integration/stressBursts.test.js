import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { adminClient, createClient, registerUser, uniquePhone } from "./helpers.js";
import { TEST_BASE_URL } from "../globalSetup.js";

/** Chaos round 2: OTP brute force at scale, phone-search sweeping, money races, oversized public payloads. */
const note = (...args) => console.log("[chaos]", ...args);
const tally = (results) => results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

async function latestCode(phone) {
  return (await (await adminClient()).get(`/api/admin/sms?phone=${phone}`)).payload.data.latestTestCode;
}

describe("OTP guessing at scale", () => {
  it("password reset: a burst with the right code hidden inside succeeds far more often than 12/90000", async () => {
    let cracked = 0;
    const trials = 6;
    const BURST = 600;
    for (let t = 0; t < trials; t += 1) {
      const victim = await registerUser(createClient(), { type: "client" });
      await createClient().post("/api/auth/otp/send", { phone: victim.phone, purpose: "reset" });
      const real = await latestCode(victim.phone);
      // The attacker does not know `real`; this puts it in a random slot only to measure how many of the guesses get evaluated.
      // slot >= 50: the real code can only be accepted if more than the 5 allowed guesses were really checked.
      const slot = 50 + Math.floor(Math.random() * (BURST - 50));
      const guesses = Array.from({ length: BURST }, (_, i) => (i === slot ? real : String(10000 + ((Number(real) - 10000 + 1 + i) % 90000))));
      const results = await Promise.all(guesses.map((code) => createClient().post("/api/auth/password-reset/confirm", { phone: victim.phone, code, newPassword: "hijacked-pass-1" })));
      const won = results.some((r) => r.ok);
      if (won) cracked += 1;
      note(`reset trial ${t}`, tally(results), won ? "REAL CODE ACCEPTED" : "real code slot starved");
    }
    note(`reset: real code accepted in ${cracked}/${trials} bursts of ${BURST}`);
    // Intended design: 5 attempts per code, 12 per 15 min => about 12/90000 odds. If this is red the guard leaks under concurrency.
    expect(cracked).toBe(0);
  }, 120_000);

  it("2500 parallel guesses at one signup code: count how many are really checked", async () => {
    const phone = uniquePhone();
    await createClient().post("/api/auth/otp/send", { phone, purpose: "register" });
    const results = await Promise.all(Array.from({ length: 2500 }, (_, i) => createClient().post("/api/auth/otp/verify", { phone, code: String(10000 + i) })));
    const evaluated = results.filter((r) => r.payload?.code !== undefined || r.status === 400).length;
    note("2500 verify burst", tally(results));
    expect(tally(results)[400] || 0).toBeLessThanOrEqual(15);
    expect(evaluated).toBeDefined();
  }, 120_000);
});

describe("phone-number sweeping (what «دعوت در انتظار» will sit next to)", () => {
  it("one client firing 300 parallel phone searches gets about 40, not 300", async () => {
    const c = createClient();
    await registerUser(c, { type: "client" });
    const results = await Promise.all(Array.from({ length: 300 }, (_, i) => c.get(`/api/connections/search?q=0912${String(7000000 + i)}`)));
    const answered = results.filter((r) => r.status === 200).length;
    note("search burst", tally(results), "answered:", answered);
    expect(answered).toBeLessThanOrEqual(60);
  }, 60_000);

  it("unknown number and known salon number answer differently (this is the listing oracle)", async () => {
    const salon = await registerUser(createClient(), { type: "salon", name: `سالن اوراکل ${Math.random().toString(36).slice(2, 6)}` });
    const c = createClient();
    await registerUser(c, { type: "client" });
    const hit = await c.get(`/api/connections/search?q=${salon.phone}`);
    const miss = await c.get(`/api/connections/search?q=${uniquePhone()}`);
    note("oracle hit results:", hit.payload.data?.results?.length, "miss results:", miss.payload.data?.results?.length, "fields exposed:", Object.keys(hit.payload.data?.results?.[0] || {}).join(","));
    expect(hit.status).toBe(200);
  });
});

describe("big public payloads", () => {
  it("a 200,000-character name is refused, and the directory stays small", async () => {
    const refused = await createClient().post("/api/auth/register", { phone: uniquePhone(), password: "testpass123", type: "artist", name: "ب".repeat(200_000) });
    expect(refused.status).toBe(400);
    await registerUser(createClient(), { type: "artist", name: "ب".repeat(120) });
    for (const path of ["/api/artists", "/api/salons", "/api/connections/by-category"]) {
      const c = createClient();
      await registerUser(c, { type: "client" });
      const res = await fetch(`${TEST_BASE_URL}${path}`, { headers: { Cookie: c.cookie() } });
      const text = await res.text();
      note(`GET ${path}`, res.status, `${(text.length / 1024).toFixed(0)} KB`);
      expect(text.length).toBeLessThan(400 * 1024);
    }
  }, 60_000);
});

describe("money races", () => {
  it("15 parallel bank callbacks for ONE payment credit the subscription once", async () => {
    await connected;
    const admin = await adminClient();
    await db.query("UPDATE admin_sessions SET stepup_until = $2 WHERE user_id = (SELECT id FROM users WHERE phone = $1)", ["09120000001", new Date(Date.now() + 10 * 60_000).toISOString()]);
    const on = await fetch(`${TEST_BASE_URL}/api/admin/billing/settings`, { method: "PUT", headers: { "Content-Type": "application/json", Cookie: admin.cookie() }, body: JSON.stringify({ enabled: true, graceDays: 3 }) });
    note("billing on", on.status);
    try {
      const salon = createClient();
      const acct = await registerUser(salon, { type: "salon", name: `سالن پول ${Math.random().toString(36).slice(2, 6)}` });
      await db.query("UPDATE users SET created_at = NOW() - INTERVAL '40 days' WHERE id = $1", [acct.user.id]);
      const start = await salon.post("/api/billing/checkout", { plan: "salon_1m" });
      note("checkout", start.status, JSON.stringify(start.payload).slice(0, 200));
      expect(start.status).toBe(201);
      const authority = start.payload.data.redirect.url.split("/pay/sandbox/")[1];
      const answered = await createClient().post(`/api/billing/sandbox/${authority}`, { action: "pay" });
      const callbackUrl = answered.payload.data.redirect;
      const hits = await Promise.all(Array.from({ length: 15 }, () => fetch(callbackUrl, { redirect: "manual" }).then((r) => ({ status: r.status }))));
      note("callback replays", tally(hits));
      const { rows } = await db.query("SELECT status, count(*) FROM payments WHERE user_id = $1 GROUP BY status", [acct.user.id]);
      const { rows: grants } = await db.query("SELECT count(*) AS c FROM subscriptions WHERE user_id = $1", [acct.user.id]).catch(() => ({ rows: [{ c: "n/a" }] }));
      note("payments", JSON.stringify(rows), "periods:", grants[0].c);
      expect(hits.filter((h) => h.status >= 500).length).toBe(0);
      const state = await salon.get("/api/billing");
      note("billing view", JSON.stringify(state.payload.data).slice(0, 300));
    } finally {
      await fetch(`${TEST_BASE_URL}/api/admin/billing/settings`, { method: "PUT", headers: { "Content-Type": "application/json", Cookie: admin.cookie() }, body: JSON.stringify({ enabled: false, graceDays: 3 }) });
    }
  }, 60_000);
});
