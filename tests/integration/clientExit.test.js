import { describe, it, expect } from "vitest";
import { adminClient } from "./helpers.js";
import { TEST_ADMIN_PASSWORD } from "../globalSetup.js";
import {
  q, newSalon, newClient, newArtist, confirmedAt, directConfirmed, moveSalonBookingNear, moveArtistBookingNear,
  salonRow, artistRow, smsEventually, FAR_DAY, createClient, registerUser
} from "./exitHelpers.js";

// A client deleting their account while bookings are open (owner's decision 2026-10-26).
const remove = (client, body = {}) => client.api.delete("/api/profile", { currentPassword: "testpass123", ...body });
const userExists = async (id) => (await q("SELECT 1 FROM users WHERE id = $1", [id])).length > 0;

async function requestAt(salon, client, { day = FAR_DAY(4), time = "15:00" } = {}) {
  const made = await client.api.post("/api/salon-bookings", { salonUserId: salon.id, service: "کوتاهی مو", bookingDate: day, time, client: client.user.name, phone: client.phone });
  if (made.status !== 201) throw new Error(`request failed ${JSON.stringify(made.payload)}`);
  return made.payload.data.booking.id;
}

describe("client deletes their account", () => {
  it("with nothing open: deleted at once", async () => {
    const client = await newClient("بی‌نوبت");
    const plan = await client.api.get("/api/client-exit");
    expect(plan.payload.data.plan).toMatchObject({ blocked: false, needsChoice: false, near: [], rest: [] });
    expect((await remove(client)).ok).toBe(true);
    expect(await userExists(client.id)).toBe(false);
  });

  it("a confirmed booking within 24 hours blocks it, even with «لغو همه»; after the client cancels it, the account goes", async () => {
    const salon = await newSalon("سالن نزدیک");
    const client = await newClient("صدف نزدیک");
    const id = await confirmedAt(salon, client);
    await moveSalonBookingNear(id, 180);

    const plan = (await client.api.get("/api/client-exit")).payload.data.plan;
    expect(plan.blocked).toBe(true);
    expect(plan.near).toHaveLength(1);
    expect(plan.near[0]).toMatchObject({ kind: "salon", id, providerName: salon.user.name });
    expect(plan.near[0].providerPhone).toBeTruthy();

    const refused = await remove(client);
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("NEAR_BOOKINGS");
    expect(refused.payload.error).toContain("۲۴ ساعت");
    const forced = await remove(client, { cancelAll: true });
    expect(forced.status).toBe(409);
    expect(await userExists(client.id)).toBe(true);
    expect((await salonRow(id)).status).toBe("تایید شده");

    expect((await client.api.post(`/api/salon-bookings/${id}/cancel`, {})).ok).toBe(true);
    expect((await remove(client)).ok).toBe(true);
    expect(await userExists(client.id)).toBe(false);
    const row = await salonRow(id);
    expect(row.status).toBe("لغو");
    expect(row.cancelled_by).toBe("client");
    expect(row.client_account_deleted_at).toBeTruthy();
  });

  it("farther bookings and requests (salon and artist) ask first, then «لغو همه» cancels them all and tells each provider", async () => {
    const salon = await newSalon("سالن دور");
    const artist = await newArtist("آرتیست دور");
    const client = await newClient("مریم دور");
    const confirmed = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    const request = await requestAt(salon, client, { day: FAR_DAY(4), time: "15:00" });
    const direct = await directConfirmed(artist, client, { day: FAR_DAY(3), time: "16:00" });

    const plan = (await client.api.get("/api/client-exit")).payload.data.plan;
    expect(plan.blocked).toBe(false);
    expect(plan.needsChoice).toBe(true);
    expect(plan.rest.map((item) => `${item.kind}-${item.id}`).sort()).toEqual([`artist-${direct}`, `salon-${confirmed}`, `salon-${request}`].sort());

    const asked = await remove(client);
    expect(asked.status).toBe(409);
    expect(asked.payload.code).toBe("HAS_BOOKINGS");
    expect(asked.payload.error).toContain("۲ نوبت و ۱ درخواست");
    expect(await userExists(client.id)).toBe(true);

    expect((await remove(client, { cancelAll: true })).ok).toBe(true);
    expect(await userExists(client.id)).toBe(false);
    for (const id of [confirmed, request]) {
      const row = await salonRow(id);
      expect(row.status).toBe("لغو");
      expect(row.client_account_deleted_at).toBeTruthy();
      expect(row.phone).toBe("");
    }
    expect((await artistRow(direct)).status).toBe("لغو");
    // The salon and the artist are told (the SMS goes when they have no app push).
    expect((await smsEventually(salon.phone, "booking_cancelled", 2)).length).toBeGreaterThanOrEqual(2);
    expect((await smsEventually(artist.phone, "booking_cancelled", 1)).length).toBeGreaterThanOrEqual(1);
  });

  it("a near booking at an independent artist blocks too", async () => {
    const artist = await newArtist("آرتیست نزدیک");
    const client = await newClient("نازنین نزدیک");
    const id = await directConfirmed(artist, client);
    await moveArtistBookingNear(id, 120);
    const refused = await remove(client, { cancelAll: true });
    expect(refused.status).toBe(409);
    expect(refused.payload.data.plan.near[0]).toMatchObject({ kind: "artist", id });
  });

  it("a booking the salon typed for the client's proved number counts as theirs", async () => {
    const salon = await newSalon("سالن حضوری");
    const api = createClient();
    const reg = await registerUser(api, { type: "client", name: "حضوری ثبت‌شده", verified: true });
    const client = { api, ...reg, id: reg.user.id };
    const made = await salon.api.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: FAR_DAY(3), time: "12:00", client: "حضوری", phone: client.phone });
    expect(made.ok).toBe(true);
    const id = made.payload.data.booking.id;
    expect((await salonRow(id)).client_user_id).toBeNull();

    const plan = (await client.api.get("/api/client-exit")).payload.data.plan;
    expect(plan.rest.map((item) => item.id)).toContain(id);
    await moveSalonBookingNear(id, 300);
    expect((await remove(client)).status).toBe(409);
  });

  it("past bookings and other clients' bookings are left alone", async () => {
    const salon = await newSalon("سالن گذشته");
    const client = await newClient("گذشته");
    const other = await newClient("دیگری");
    const past = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "10:00" });
    await moveSalonBookingNear(past, -600);
    const theirs = await confirmedAt(salon, other, { day: FAR_DAY(3), time: "13:00" });
    const plan = (await client.api.get("/api/client-exit")).payload.data.plan;
    expect(plan.near).toHaveLength(0);
    expect(plan.rest).toHaveLength(0);
    expect((await remove(client)).ok).toBe(true);
    expect((await salonRow(past)).status).toBe("تایید شده");
    expect((await salonRow(theirs)).status).toBe("تایید شده");
  });

  it("only a client may ask for this plan", async () => {
    const salon = await newSalon("سالن نپرس");
    expect((await salon.api.get("/api/client-exit")).status).toBe(400);
  });

  it("the admin is not blocked, but every open booking is cancelled with notice", async () => {
    const salon = await newSalon("سالن مدیر");
    const client = await newClient("حذف با مدیر");
    const near = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    await moveSalonBookingNear(near, 240);
    const far = await requestAt(salon, client, { day: FAR_DAY(4), time: "16:00" });
    const admin = await adminClient();
    await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD });
    const gone = await admin.delete(`/api/admin/users/${client.id}`, { confirmPhone: client.phone });
    expect(gone.ok).toBe(true);
    expect(await userExists(client.id)).toBe(false);
    expect((await salonRow(near)).status).toBe("لغو");
    expect((await salonRow(far)).status).toBe("لغو");
  });
});
