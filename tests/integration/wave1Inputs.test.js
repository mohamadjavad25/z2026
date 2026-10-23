import { describe, it, expect } from "vitest";
import { adminClient, createClient, registerUser, uniquePhone } from "./helpers.js";

async function latestCode(phone) {
  return (await (await adminClient()).get(`/api/admin/sms?phone=${phone}`)).payload.data.latestTestCode;
}

describe("changing the phone needs a code sent to the new number", () => {
  it("full flow: send, verify, save; the old number and a stranger's proof do not work", async () => {
    const client = createClient();
    const account = await registerUser(client, { type: "client", name: "Phone Mover", verified: true });
    const next = uniquePhone();

    // not signed in: no code
    expect((await createClient().post("/api/auth/otp/send", { phone: next, purpose: "phone_change" })).status).toBe(401);
    // no proof: refused, and nothing changed
    const bare = await client.post("/api/profile", { data: { phone: next } });
    expect(bare.status).toBe(400);
    expect(bare.payload.code).toBe("phone_proof_required");

    expect((await client.post("/api/auth/otp/send", { phone: next, purpose: "phone_change" })).ok).toBe(true);
    const code = await latestCode(next);
    const verified = await client.post("/api/auth/otp/verify", { phone: next, code, purpose: "phone_change" });
    expect(verified.ok).toBe(true);
    const proof = verified.payload.data.proof;

    // a proof made for this account does not work for another one, nor for another number
    const stranger = createClient();
    await registerUser(stranger, { type: "client", name: "Stranger" });
    expect((await stranger.post("/api/profile", { data: { phone: next, phoneProof: proof } })).status).toBe(400);
    expect((await client.post("/api/profile", { data: { phone: uniquePhone(), phoneProof: proof } })).status).toBe(400);

    const saved = await client.post("/api/profile", { data: { phone: next, phoneProof: proof } });
    expect(saved.ok, JSON.stringify(saved.payload)).toBe(true);
    expect(saved.payload.data.user.phone).toBe(next);
    // saving the same number again needs no code
    expect((await client.post("/api/profile", { data: { phone: next, name: "Phone Mover 2" } })).ok).toBe(true);
    expect(account.phone).not.toBe(next);
  });

  it("a number that belongs to another account cannot be taken, and sending codes is limited", async () => {
    const client = createClient();
    await registerUser(client, { type: "client", name: "Taker" });
    const other = createClient();
    const owner = await registerUser(other, { type: "client", name: "Owner" });
    const res = await client.post("/api/auth/otp/send", { phone: owner.phone, purpose: "phone_change" });
    expect(res.status).toBe(409);
    let limited = 0;
    for (let i = 0; i < 8; i += 1) {
      const r = await client.post("/api/auth/otp/send", { phone: uniquePhone(), purpose: "phone_change" });
      if (r.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("opening hours are read strictly", () => {
  it("refuses bad times, a close before the open, a bad capacity and an unknown day", async () => {
    const salon = createClient();
    await registerUser(salon, { type: "salon", name: "Hours Salon" });
    const hours = (await salon.get("/api/salon-hours")).payload.data.hours;
    const day = hours[1].day;
    for (const patch of [{ openTime: "abc" }, { closeTime: "99:99" }, { capacity: -4 }, { capacity: "x" }, { active: "false" }, { openTime: "۲۰:۰۰", closeTime: "۱۰:۰۰" }, { day: "ششنبه" }]) {
      const res = await salon.patch("/api/salon-hours", { day, ...patch });
      expect(res.status, JSON.stringify(patch)).toBe(400);
    }
    const ok = await salon.patch("/api/salon-hours", { day, openTime: "۰۹:۰۰", closeTime: "۱۹:۰۰", capacity: 6, active: true });
    expect(ok.ok).toBe(true);
  });
});
