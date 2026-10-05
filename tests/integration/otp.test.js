import { describe, it, expect } from "vitest";
import { adminClient, createClient, uniquePhone, registerUser } from "./helpers.js";

async function codeFor(admin, phone) {
  const res = await admin.get(`/api/admin/sms?phone=${phone}`);
  return res.payload.data.latestTestCode;
}

describe("SMS codes", () => {
  it("reports that SMS is on but not yet required", async () => {
    const res = await createClient().get("/api/auth/otp/config");
    expect(res.payload.data.enabled).toBe(true);
    expect(res.payload.data.required).toBe(false);
  });

  it("verifies a new number and lets sign-up through only with that proof", async () => {
    const admin = await adminClient();
    const phone = uniquePhone();
    const anon = createClient();
    expect((await anon.post("/api/auth/otp/send", { phone: "123", purpose: "register" })).status).toBe(400);
    expect((await anon.post("/api/auth/otp/send", { phone, purpose: "register" })).ok).toBe(true);
    const code = await codeFor(admin, phone);
    expect(code).toMatch(/^\d{5}$/);

    const wrong = await anon.post("/api/auth/otp/verify", { phone, code: code === "11111" ? "22222" : "11111" });
    expect(wrong.status).toBe(400);
    expect(wrong.payload.error).toMatch(/[؀-ۿ]/);

    const verified = await anon.post("/api/auth/otp/verify", { phone, code });
    expect(verified.ok).toBe(true);
    const proof = verified.payload.data.proof;

    // the code is single-use
    expect((await anon.post("/api/auth/otp/verify", { phone, code })).ok).toBe(false);
    // a proof for one number never works for another
    const other = await createClient().post("/api/auth/register", { phone: uniquePhone(), password: "testpass123", type: "client", name: "x", otpProof: proof });
    expect(other.status).toBe(400);
    expect(other.payload.code).toBe("otp_required");
    const created = await createClient().post("/api/auth/register", { phone, password: "testpass123", type: "client", name: "تأییدشده", otpProof: proof });
    expect(created.ok).toBe(true);
  });

  it("refuses a registered number for sign-up codes", async () => {
    const user = await registerUser(createClient(), { type: "client" });
    const res = await createClient().post("/api/auth/otp/send", { phone: user.phone, purpose: "register" });
    expect(res.status).toBe(409);
  });

  it("burns a code after five wrong guesses", async () => {
    const admin = await adminClient();
    const phone = uniquePhone();
    const anon = createClient();
    await anon.post("/api/auth/otp/send", { phone, purpose: "register" });
    const code = await codeFor(admin, phone);
    const bad = code === "11111" ? "22222" : "11111";
    for (let i = 0; i < 5; i += 1) await anon.post("/api/auth/otp/verify", { phone, code: bad });
    const late = await anon.post("/api/auth/otp/verify", { phone, code });
    expect(late.ok).toBe(false);
  });

  it("throttles repeated sends to one number", async () => {
    const phone = uniquePhone();
    const anon = createClient();
    for (let i = 0; i < 3; i += 1) expect((await anon.post("/api/auth/otp/send", { phone, purpose: "register" })).ok).toBe(true);
    expect((await anon.post("/api/auth/otp/send", { phone, purpose: "register" })).status).toBe(429);
  });

  it("resets a forgotten password with a code, and signs the account out everywhere", async () => {
    const admin = await adminClient();
    const owner = createClient();
    const user = await registerUser(owner, { type: "client", name: "فراموش‌کار" });
    const anon = createClient();
    expect((await anon.post("/api/auth/otp/send", { phone: user.phone, purpose: "reset" })).ok).toBe(true);
    const code = await codeFor(admin, user.phone);

    expect((await anon.post("/api/auth/password-reset/confirm", { phone: user.phone, code, newPassword: "short" })).status).toBe(400);
    const done = await anon.post("/api/auth/password-reset/confirm", { phone: user.phone, code, newPassword: "brandnewpass1" });
    expect(done.ok).toBe(true);

    expect((await owner.get("/api/auth/me")).payload.data.user).toBeNull();
    expect((await createClient().post("/api/auth/login", { phone: user.phone, password: "testpass123" })).ok).toBe(false);
    expect((await createClient().post("/api/auth/login", { phone: user.phone, password: "brandnewpass1" })).ok).toBe(true);
  });

  it("answers a reset request for an unknown number exactly like a real one", async () => {
    const admin = await adminClient();
    const phone = uniquePhone();
    const res = await createClient().post("/api/auth/otp/send", { phone, purpose: "reset" });
    expect(res.ok).toBe(true);
    expect(await codeFor(admin, phone)).toBeNull();
  });
});
