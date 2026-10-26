import { describe, it, expect } from "vitest";
import { adminClient, createClient, futureBookingDay, registerUser, uniquePhone } from "./helpers.js";
import { newSalon } from "./afterVisitKit.js";

/** Owner's decisions of 2026-10-25: a new password or number signs the account out everywhere but the phone that made
 *  the change; bookings typed for the old number until then stay with the account, later ones don't. */

async function latestCode(phone) {
  return (await (await adminClient()).get(`/api/admin/sms?phone=${phone}`)).payload.data.latestTestCode;
}

const signedIn = async (api) => Boolean((await api.get("/api/auth/me")).payload?.data?.user);

async function secondSession(account) {
  const other = createClient();
  const login = await other.post("/api/auth/login", { phone: account.phone, password: account.password });
  expect(login.ok, JSON.stringify(login.payload)).toBe(true);
  expect(await signedIn(other)).toBe(true);
  return other;
}

async function changePhone(client, next) {
  expect((await client.post("/api/auth/otp/send", { phone: next, purpose: "phone_change" })).ok).toBe(true);
  const verified = await client.post("/api/auth/otp/verify", { phone: next, code: await latestCode(next), purpose: "phone_change" });
  expect(verified.ok).toBe(true);
  return client.post("/api/profile", { data: { phone: next, phoneProof: verified.payload.data.proof } });
}

describe("sign out the other phones", () => {
  it("a password change signs out every other session, not this one", async () => {
    const client = createClient();
    const account = await registerUser(client, { type: "client", name: "Pass Mover" });
    const tablet = await secondSession(account);
    const changed = await client.post("/api/profile", { data: { password: "newpass1234", currentPassword: account.password } });
    expect(changed.ok, JSON.stringify(changed.payload)).toBe(true);
    expect(await signedIn(client)).toBe(true);
    expect(await signedIn(tablet)).toBe(false);
  });

  it("a phone change signs the others out and keeps the old number's bookings, not later ones", async () => {
    const client = createClient();
    const account = await registerUser(client, { type: "client", name: "Phone Keeper", verified: true });
    const tablet = await secondSession(account);
    const ctx = await newSalon("PhoneKeeper");
    const day = futureBookingDay(3);
    const before = await ctx.salonClient.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: day, time: "10:00", client: "Phone Keeper", phone: account.phone });
    expect(before.ok, JSON.stringify(before.payload)).toBe(true);
    const ids = async () => (await client.get("/api/client-bookings")).payload.data.salonBookings.map((b) => b.id);
    const beforeId = before.payload.data.booking.id;
    expect(await ids()).toContain(beforeId);

    const saved = await changePhone(client, uniquePhone());
    expect(saved.ok, JSON.stringify(saved.payload)).toBe(true);
    expect(await signedIn(tablet)).toBe(false);
    expect(await signedIn(client)).toBe(true);
    // typed before the change: still hers; typed after it with the old number: not hers
    const after = await ctx.salonClient.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: day, time: "12:00", client: "Someone", phone: account.phone });
    expect(after.ok, JSON.stringify(after.payload)).toBe(true);
    const mine = await ids();
    expect(mine).toContain(beforeId);
    expect(mine).not.toContain(after.payload.data.booking.id);
  });
});
