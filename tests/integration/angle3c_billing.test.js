import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { newSalon, newClient, newArtist, bookSalon, hhmm, db, connected, futureBookingDay, createClient, ipHeaders } from "./angle3Helpers.js";
import { adminClient } from "./helpers.js";
import { TEST_ADMIN_PHONE, TEST_BASE_URL } from "../globalSetup.js";

const DAY = 86_400_000;

async function put(client, path, body) {
  const res = await fetch(`${TEST_BASE_URL}${path}`, { method: "PUT", headers: { "Content-Type": "application/json", Cookie: client.cookie() }, body: JSON.stringify(body) });
  return { status: res.status, ok: res.ok, payload: await res.json().catch(() => ({})) };
}
const setStepUp = async (on) => {
  await connected;
  await db.query("UPDATE admin_sessions SET stepup_until = $2 WHERE user_id = (SELECT id FROM users WHERE phone = $1)", [TEST_ADMIN_PHONE, on ? new Date(Date.now() + 10 * 60_000).toISOString() : null]);
};
async function setBilling(enabled) {
  const admin = await adminClient();
  await setStepUp(true);
  const saved = await put(admin, "/api/admin/billing/settings", { enabled, graceDays: 3 });
  expect(saved.ok).toBe(true);
}
const age = (userId, days) => db.query("UPDATE users SET created_at = NOW() - ($2::int * INTERVAL '1 day') WHERE id = $1", [userId, days]);

beforeAll(async () => {
  await connected;
  const launchedAt = new Date(Date.now() - 60 * DAY).toISOString();
  await db.query(`INSERT INTO app_settings (key, value) VALUES ('billing', $1::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify({ enabled: false, launchedAt, graceDays: 3 })]);
  await setBilling(true);
});
afterAll(async () => { await setBilling(false); await setStepUp(false); await db.end(); });

describe("angle3c: a salon closes while it holds bookings", () => {
  it("pending and approved bookings survive; the salon can still answer them, clients can still cancel, new requests are refused", async () => {
    const salon = await newSalon("Closing Salon");
    const early = await newClient("Early A");
    const early2 = await newClient("Early B");
    const early3 = await newClient("Early C");
    const day = futureBookingDay(2);
    const pend = await bookSalon(early, salon, { day, time: hhmm(10) });
    const approved = await bookSalon(early2, salon, { day, time: hhmm(12) });
    const toCancel = await bookSalon(early3, salon, { day, time: hhmm(14) });
    expect([pend.status, approved.status, toCancel.status]).toEqual([201, 201, 201]);
    await salon.client.patch("/api/salon-bookings", { id: approved.payload.data.booking.id, status: "تایید شده" });

    await age(salon.user.id, 40);   // free month + grace gone -> closed
    const refused = await bookSalon(await newClient("Late"), salon, { day, time: hhmm(16) });
    expect(refused.status).toBe(403);
    expect(refused.payload.code).toBe("PROVIDER_INACTIVE");

    // The owner still sees both and can approve / cancel.
    const list = await salon.client.get("/api/salon-bookings");
    expect(list.payload.data.bookings.map((b) => b.status).sort()).toEqual(["تایید شده", "درخواست", "درخواست"].sort());
    expect((await salon.client.patch("/api/salon-bookings", { id: pend.payload.data.booking.id, status: "تایید شده" })).status).toBe(200);
    // client keeps the right to cancel
    expect((await early3.client.post(`/api/salon-bookings/${toCancel.payload.data.booking.id}/cancel`, {})).status).toBe(200);
    // and the salon still enters walk-ins (documented behaviour)
    const walkin = await salon.client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: "کراتین مو", client: "Walk", phone: "09120000555", bookingDate: day, time: hhmm(18) });
    expect(walkin.status).toBe(201);
  });

  it("a closed salon does not keep offering free times to clients (availability / preview agree with POST)", async () => {
    const salon = await newSalon("Closed Offer Salon");
    await age(salon.user.id, 40);
    const c = await newClient("Offer Client");
    const day = futureBookingDay(2);
    const avail = await c.client.get(`/api/salon-bookings/availability?salonUserId=${salon.user.id}&day=${encodeURIComponent(day)}&service=${encodeURIComponent("کراتین مو")}`);
    const preview = await c.client.get(`/api/salon-bookings/preview?salonUserId=${salon.user.id}&day=${encodeURIComponent(day)}&time=11:00&service=${encodeURIComponent("کراتین مو")}`);
    const post = await bookSalon(c, salon, { day, time: hhmm(11) });
    console.log("[closed-offer] availability times:", (avail.payload.data?.times || []).length, "| preview ok:", preview.payload.data?.ok, "| POST:", post.status);
    expect(post.status).toBe(403);
    // what the screens show must match what POST does
    expect((avail.payload.data?.times || []).length).toBe(0);
    expect(preview.payload.data?.ok).toBe(false);
  });

  it("a request cannot name a closed salon as its backup; a closed independent artist takes no anonymous or signed-in request", async () => {
    const first = await newSalon("First Choice");
    const backup = await newSalon("Backup Salon");
    const c = await newClient("Backup Client");
    await c.client.post("/api/connections", { targetUserId: backup.user.id });
    await age(backup.user.id, 40);
    const r = await bookSalon(c, first, { day: futureBookingDay(2), time: hhmm(10), extra: { fallbackSalonUserId: backup.user.id } });
    expect(r.status).toBe(201);
    expect(r.payload.data.booking.fallback_salon_user_id).toBeNull();

    const artist = await newArtist("Closed Artist");
    await age(artist.user.id, 40);
    const body = { artistUserId: artist.user.id, service: "ناخن", bookingDate: futureBookingDay(2), time: hhmm(10) };
    expect((await c.client.post("/api/artist/bookings", body)).status).toBe(403);
    expect((await createClient().post("/api/artist/bookings", body)).status).toBe(403);
  });
});

describe("angle3c: checkout and callback abuse", () => {
  it("checkout spam is capped per account", async () => {
    const salon = await newSalon("Checkout Spam");
    const statuses = [];
    for (let i = 0; i < 10; i += 1) statuses.push((await salon.client.post("/api/billing/checkout", { plan: "salon_1m" })).status);
    console.log("[checkout-spam] statuses", statuses.join(","));
    expect(statuses).toContain(429);
    const rows = await db.query("SELECT COUNT(*)::int AS c FROM payments WHERE user_id = $1", [salon.user.id]);
    console.log("[checkout-spam] pending payment rows created:", rows.rows[0].c);
    expect(rows.rows[0].c).toBeLessThanOrEqual(8);
  });

  it("a stranger cannot fail, settle or probe someone else's payment through the callback or the return page", async () => {
    const salon = await newSalon("Cb Victim");
    const start = await salon.client.post("/api/billing/checkout", { plan: "salon_1m" });
    expect(start.status).toBe(201);
    const pid = start.payload.data.paymentId;
    const authority = start.payload.data.redirect.url.split("/pay/sandbox/")[1];
    const hit = async (qs) => fetch(`${TEST_BASE_URL}/api/billing/callback/sandbox?pid=${pid}&${qs}`, { redirect: "manual", headers: ipHeaders() });
    const forged = await hit("Authority=SBX000000000000000000000000&Status=NOK");
    const noAuth = await hit("Status=NOK");
    const missing = await fetch(`${TEST_BASE_URL}/api/billing/callback/sandbox?pid=99999999&Authority=SBX0&Status=NOK`, { redirect: "manual", headers: ipHeaders() });
    // existing and non-existing payment ids look identical to a prober
    expect(forged.headers.get("location")).toBe(noAuth.headers.get("location"));
    expect(new URL(forged.headers.get("location")).pathname).toBe("/pay/invalid");
    expect(new URL(missing.headers.get("location")).pathname).toBe("/pay/invalid");
    // wrong gateway name
    const wrongGw = await fetch(`${TEST_BASE_URL}/api/billing/callback/zarinpal?pid=${pid}&Authority=${authority}&Status=OK`, { redirect: "manual", headers: ipHeaders() });
    expect(new URL(wrongGw.headers.get("location")).pathname).toBe("/pay/invalid");
    const still = await salon.client.get(`/api/billing/payments/${pid}`);
    expect(still.payload.data.payment.status).toBe("pending");
    // "paid" can't be forced by anyone without the bank's answer: callback with the right authority but nobody pressed pay
    const legit = await hit(`Authority=${authority}&Status=OK`);
    const token = new URL(legit.headers.get("location")).pathname.split("/pay/")[1];
    const result = await createClient().get(`/api/billing/return/${token}`);
    expect(result.payload.data.payment.status).not.toBe("paid");
    // the return page must not reveal owner identity
    expect(JSON.stringify(result.payload)).not.toContain(salon.phone);
    // a client or artist cannot buy / read a salon's payments
    const client = await newClient("Not billed");
    expect((await client.client.get(`/api/billing/payments/${pid}`)).status).toBe(404);
    expect((await client.client.post("/api/billing/checkout", { plan: "salon_1m" })).status).toBe(403);
    // the pretend bank answers once only
    const sb = createClient();
    expect((await sb.post(`/api/billing/sandbox/${authority}`, { action: "cancel" })).ok).toBe(true);
    expect((await sb.post(`/api/billing/sandbox/${authority}`, { action: "pay" })).status).toBe(409);
  });

  it("a salon cannot pay for (or read the account of) an artist outside its team", async () => {
    const salon = await newSalon("Not My Team");
    const artist = await newArtist("Outsider Artist");
    const res = await salon.client.post("/api/billing/checkout", { plan: "artist_1m", forUserId: artist.user.id });
    expect(res.status).toBe(403);
    const asClient = await (await newClient("Payer Client")).client.post("/api/billing/checkout", { plan: "artist_1m", forUserId: artist.user.id });
    expect(asClient.status).toBe(403);
  });
});
