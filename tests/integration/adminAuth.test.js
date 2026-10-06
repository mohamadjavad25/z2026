import { describe, it, expect } from "vitest";
import { createClient, registerUser, uniquePhone } from "./helpers.js";
import { TEST_ADMIN2_PHONE, TEST_ADMIN_PASSWORD, TEST_ADMIN_SETUP_KEY } from "../globalSetup.js";
import { totpCodeAt, totpStepAt } from "../../app/lib/totp.js";

// Each test sends its own fake client IP so the per-IP throttles never leak between tests.
let ipCounter = 0;
const ipHeader = () => ({ headers: { "x-forwarded-for": `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}` } });

describe("admin login (password + authenticator code)", () => {
  const credentials = { phone: TEST_ADMIN2_PHONE, password: TEST_ADMIN_PASSWORD };
  let secret;
  let usedStep;

  it("is closed to everybody before setup, and a normal account or admin session is never enough", async () => {
    const anon = createClient();
    expect((await anon.get("/api/admin/me")).payload.data.isAdmin).toBe(false);
    expect((await anon.get("/api/admin/stats")).status).toBe(403);

    // The admin's account exists, with the right password, but has no authenticator yet -> still refused, with the generic message.
    const admin = createClient();
    await registerUser(admin, { type: "client", name: "Admin Two", phone: TEST_ADMIN2_PHONE });
    expect((await admin.get("/api/admin/stats")).status).toBe(403); // plain user login does not open the panel
    const early = await createClient().post("/api/admin/auth/login", { ...credentials, code: "123456" }, ipHeader());
    expect(early.status).toBe(401);
    expect(early.payload.error).toMatch(/[؀-ۿ]/);
  });

  it("setup needs the setup key, the right password and a listed phone, and answers every failure the same way", async () => {
    const client = createClient();
    const base = { ...credentials, setupKey: TEST_ADMIN_SETUP_KEY };
    const wrongKey = await client.post("/api/admin/auth/enroll/start", { ...base, setupKey: "nope" }, ipHeader());
    const wrongPassword = await client.post("/api/admin/auth/enroll/start", { ...base, password: "bad-password" }, ipHeader());
    const user = await registerUser(createClient(), { type: "client", name: "Not Admin" });
    const notListed = await client.post("/api/admin/auth/enroll/start", { phone: user.phone, password: user.password, setupKey: TEST_ADMIN_SETUP_KEY }, ipHeader());
    for (const result of [wrongKey, wrongPassword, notListed]) expect(result.status).toBe(401);
    expect(wrongKey.payload).toEqual(wrongPassword.payload);
    expect(wrongKey.payload).toEqual(notListed.payload);
  });

  it("links an authenticator and logs in; the confirm step rejects a wrong code", async () => {
    const client = createClient();
    const base = { ...credentials, setupKey: TEST_ADMIN_SETUP_KEY };
    const started = await client.post("/api/admin/auth/enroll/start", base, ipHeader());
    expect(started.ok).toBe(true);
    secret = started.payload.data.secret;
    expect(started.payload.data.qr).toMatch(/^data:image\/png;base64,/);
    expect(started.payload.data.uri).toContain(`secret=${secret}`);

    const wrong = await client.post("/api/admin/auth/enroll/confirm", { ...base, code: "000000" }, ipHeader());
    expect(wrong.status).toBe(401);
    expect((await client.get("/api/admin/me")).payload.data.isAdmin).toBe(false);

    usedStep = totpStepAt();
    const confirmed = await client.post("/api/admin/auth/enroll/confirm", { ...base, code: totpCodeAt(secret, usedStep) }, ipHeader());
    expect(confirmed.ok).toBe(true);
    expect((await client.get("/api/admin/me")).payload.data.isAdmin).toBe(true);
    expect((await client.get("/api/admin/stats")).ok).toBe(true);
  });

  it("cannot be set up a second time (nobody can swap the authenticator), even with every credential", async () => {
    const again = await createClient().post("/api/admin/auth/enroll/start", { ...credentials, setupKey: TEST_ADMIN_SETUP_KEY }, ipHeader());
    expect(again.status).toBe(401);
  });

  it("logs in with a fresh code, refuses a reused or wrong code, and logout ends the session", async () => {
    const nextCode = totpCodeAt(secret, usedStep + 1); // the next 30 s window is accepted as clock drift
    const reused = await createClient().post("/api/admin/auth/login", { ...credentials, code: totpCodeAt(secret, usedStep) }, ipHeader());
    expect(reused.status).toBe(401); // the code used at setup works exactly once

    const wrongPassword = await createClient().post("/api/admin/auth/login", { ...credentials, password: "bad-password", code: nextCode }, ipHeader());
    expect(wrongPassword.status).toBe(401);
    const wrongCode = await createClient().post("/api/admin/auth/login", { ...credentials, code: "000000" }, ipHeader());
    expect(wrongCode.status).toBe(401);
    expect(wrongCode.payload).toEqual(wrongPassword.payload);

    const client = createClient();
    const ok = await client.post("/api/admin/auth/login", { ...credentials, code: nextCode }, ipHeader());
    expect(ok.ok).toBe(true);
    expect((await client.get("/api/admin/stats")).ok).toBe(true);
    const replay = await createClient().post("/api/admin/auth/login", { ...credentials, code: nextCode }, ipHeader());
    expect(replay.status).toBe(401);

    expect((await client.post("/api/admin/auth/logout", {})).ok).toBe(true);
    expect((await client.get("/api/admin/stats")).status).toBe(403);
  });

  it("refuses cross-site state-changing requests", async () => {
    const res = await createClient().post("/api/admin/auth/login", { ...credentials, code: "123456" }, { headers: { origin: "https://evil.example", "x-forwarded-for": "10.2.0.1" } });
    expect(res.status).toBe(403);
  });

  it("throttles guessing per phone", async () => {
    const phone = uniquePhone();
    const statuses = [];
    for (let i = 0; i < 10; i += 1) {
      statuses.push((await createClient().post("/api/admin/auth/login", { phone, password: "x", code: "123456" }, ipHeader())).status);
    }
    expect(statuses.slice(0, 8).every((status) => status === 401)).toBe(true);
    expect(statuses[9]).toBe(429);
  });
});
