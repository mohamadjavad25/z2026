import { describe, it, expect } from "vitest";
import { createClient, registerUser, uniquePhone } from "./helpers.js";

describe("auth", () => {
  it("registers, sets a session cookie, and auth/me reflects it", async () => {
    const client = createClient();
    const { phone, user } = await registerUser(client, { name: "Auth Flow" });
    expect(user.phone).toBe(phone);

    const me = await client.get("/api/auth/me");
    expect(me.ok).toBe(true);
    expect(me.payload.data.user.phone).toBe(phone);
  });

  it("logs in with the correct password and rejects a wrong one", async () => {
    const client = createClient();
    const { phone, password } = await registerUser(client, { name: "Login Flow" });

    const anon = createClient();
    const bad = await anon.post("/api/auth/login", { phone, password: "wrongpassword" });
    expect(bad.status).toBe(401);
    expect(bad.payload.code).toBe("bad_password");

    const good = await anon.post("/api/auth/login", { phone, password });
    expect(good.ok).toBe(true);
    expect(good.payload.data.user.phone).toBe(phone);
  });

  it("reports not_found for an unregistered phone", async () => {
    const anon = createClient();
    const res = await anon.post("/api/auth/login", { phone: uniquePhone(), password: "whatever123" });
    expect(res.status).toBe(401);
    expect(res.payload.code).toBe("not_found");
  });

  it("rejects an invalid phone on profile update (the confirmed validation gap)", async () => {
    const client = createClient();
    await registerUser(client, { name: "Phone Validate" });
    const res = await client.post("/api/profile", { data: { phone: "not-a-real-phone" } });
    expect(res.status).toBe(400);
  });

  it("rate-limits repeated wrong-password login attempts", async () => {
    const client = createClient();
    const { phone } = await registerUser(client, { name: "Rate Limited" });
    const anon = createClient();
    let lastStatus = 0;
    // LOGIN_ATTEMPT_LIMIT is 10 in app/api/auth/login/route.js.
    for (let i = 0; i < 11; i += 1) {
      const res = await anon.post("/api/auth/login", { phone, password: "wrongpassword" });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
