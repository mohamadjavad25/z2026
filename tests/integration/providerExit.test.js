import { describe, it, expect } from "vitest";
import { adminClient } from "./helpers.js";
import {
  FAR_DAY, answer, artistRow, confirmedAt, counter, deleteMe, directConfirmed, exitCancel, exitPlan, moveArtistBookingNear,
  moveSalonBookingNear, newArtist, newClient, newSalon, propose, q, salonRow, smsEventually, teamSalon
} from "./exitHelpers.js";

/**
 * The owner's rules of 2026-10-22 (docs/DECISIONS.md): a confirmed booking is never broken without the client being told.
 * Q1 24-hour block on deleting / leaving, Q3 cancelling with notice, Q4 the counter, Q5 hand-over, Q6 deleting a whole salon.
 */
describe("a salon or artist cannot walk away from a confirmed booking within 24 hours", () => {
  it("a salon with a booking in 10 hours is refused with the list, and only a cancel with notice clears it", async () => {
    const salon = await newSalon("Block Salon");
    const client = await newClient("Block Client");
    const id = await confirmedAt(salon, client);
    await moveSalonBookingNear(id, 600);

    const refused = await deleteMe(salon);
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("NEAR_BOOKINGS");
    expect(refused.payload.error).toContain("تا ۲۴ ساعت دیگر نوبت دارند");
    const near = refused.payload.data.plan.near;
    expect(near).toHaveLength(1);
    expect(near[0]).toMatchObject({ id, clientPhone: client.phone, clientName: client.user.name, near: true });
    // still there: the account can log in and work
    expect((await salon.api.get("/api/salon-bookings")).ok).toBe(true);

    // the same list is what GET /api/provider-exit shows
    const plan = (await exitPlan(salon, { scope: "account" })).payload.data.plan;
    expect(plan.blocked).toBe(true);

    // «لغو با اطلاع مشتری»: the client is told, the counter counts it, who cancelled is recorded
    const cancelled = await exitCancel(salon, { scope: "account", kind: "salon", id });
    expect(cancelled.ok).toBe(true);
    expect(cancelled.payload.data.plan.blocked).toBe(false);
    expect(await counter(salon.id)).toBe(1);
    expect((await salonRow(id)).cancelled_by).toBe("provider");
    const mine = (await client.api.get("/api/client-bookings")).payload.data.salonBookings.find((b) => b.id === id);
    expect(mine.status).toBe("لغو");
    expect(mine.cancelled_by).toBe("provider");
    expect(mine.placeGone).toBe(false);
    const texts = await smsEventually(client.phone, "booking_cancelled_by_provider", 1);
    expect(texts).toHaveLength(1);
    expect(texts[0].body).toContain("لغو کرد");

    // cancelling it again changes nothing and counts nothing
    expect((await exitCancel(salon, { scope: "account", kind: "salon", id })).status).toBe(404);
    expect(await counter(salon.id)).toBe(1);

    // nothing near is left: the account can go
    expect((await deleteMe(salon)).ok).toBe(true);
  });

  it("an independent artist with a direct booking in 6 hours is refused the same way", async () => {
    const artist = await newArtist("Block Artist");
    const client = await newClient("Block Direct Client");
    const id = await directConfirmed(artist, client);
    await moveArtistBookingNear(id, 360);
    const refused = await deleteMe(artist);
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("NEAR_BOOKINGS");
    expect(refused.payload.data.plan.near[0]).toMatchObject({ kind: "artist", id, clientPhone: client.phone });
    expect((await exitCancel(artist, { scope: "account", kind: "artist", id })).ok).toBe(true);
    expect((await artistRow(id)).cancelled_by).toBe("provider");
    expect(await counter(artist.id)).toBe(1);
    expect((await deleteMe(artist)).ok).toBe(true);
  });

  it("a booking that is not confirmed yet, or already over, does not block", async () => {
    const salon = await newSalon("Soft Salon");
    const client = await newClient("Soft Client");
    const made = await client.api.post("/api/salon-bookings", { salonUserId: salon.id, service: "کوتاهی مو", bookingDate: FAR_DAY(2), time: "10:00", client: client.user.name, phone: client.phone });
    expect(made.status).toBe(201);
    expect((await deleteMe(salon)).ok).toBe(true);
    // the waiting request was closed with notice («سالن دیگر در فرفرو نیست»), not left hanging
    const row = (await q("SELECT status, cancelled_by FROM salon_bookings WHERE id = $1", [made.payload.data.booking.id]))[0];
    expect(row).toMatchObject({ status: "لغو", cancelled_by: "gone" });
  });
});

describe("deleting a whole salon with farther bookings (Q6)", () => {
  it("asks for a choice, then «لغو همهٔ نوبت‌ها» cancels all with notice; the client sees the salon is gone; the admin still lists them", async () => {
    const salon = await newSalon("Gone Salon");
    const clientA = await newClient("Gone Client A");
    const clientB = await newClient("Gone Client B");
    const a = await confirmedAt(salon, clientA, { day: FAR_DAY(3), time: "10:00" });
    const b = await confirmedAt(salon, clientB, { day: FAR_DAY(4), time: "12:00" });

    const asked = await deleteMe(salon);
    expect(asked.status).toBe(409);
    expect(asked.payload.code).toBe("HAS_BOOKINGS");
    expect(asked.payload.data.plan.farConfirmed.map((item) => item.id).sort()).toEqual([a, b].sort());
    expect(asked.payload.data.plan.needsChoice).toBe(true);
    // refused: nothing was cancelled yet
    expect((await salonRow(a)).status).toBe("تایید شده");

    const done = await deleteMe(salon, { cancelAll: true });
    expect(done.ok).toBe(true);
    expect((await salonRow(a)).cancelled_by).toBe("gone");

    const list = (await clientA.api.get("/api/client-bookings")).payload.data.salonBookings.find((item) => item.id === a);
    expect(list.status).toBe("لغو");
    expect(list.placeGone).toBe(true);
    expect((await smsEventually(clientA.phone, "booking_cancelled_gone", 1)).length).toBeGreaterThanOrEqual(0);

    const admin = await adminClient();
    const rows = (await admin.get("/api/admin/bookings?deleted=1&limit=200")).payload.data.bookings;
    expect(rows.some((row) => row.kind === "salon" && row.id === a)).toBe(true);
    expect(rows.every((row) => row.provider_id === null)).toBe(true);
  });
});

describe("a team artist leaves (Q5): hand-over or cancel, one booking at a time", () => {
  it("is refused while a booking is near, and farther ones need a choice; the other artist is offered", async () => {
    const { salon, members } = await teamSalon("Team Exit Salon", 2);
    const [leaving, taking] = members;
    const client = await newClient("Team Client");
    const far = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00", staff: leaving.staff.name });

    const asked = await leaving.api.delete("/api/artist/teams", { salonUserId: salon.id });
    expect(asked.status).toBe(409);
    expect(asked.payload.code).toBe("HAS_BOOKINGS");
    const item = asked.payload.data.plan.farConfirmed.find((entry) => entry.id === far);
    expect(item.canHandover).toBe(true);
    expect(item.candidates).toContain(taking.staff.name);
    expect(item.candidates).not.toContain(leaving.staff.name);

    // a booking in 5 hours blocks outright
    const nearId = await confirmedAt(salon, client, { day: FAR_DAY(5), time: "15:00", staff: leaving.staff.name });
    await moveSalonBookingNear(nearId, 300);
    const blocked = await leaving.api.delete("/api/artist/teams", { salonUserId: salon.id });
    expect(blocked.status).toBe(409);
    expect(blocked.payload.code).toBe("NEAR_BOOKINGS");
    expect(blocked.payload.error).toContain("از تیم بیرون رفت");
    // nobody left yet
    expect((await q("SELECT 1 FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2", [salon.id, leaving.id]))).toHaveLength(1);
  });

  it("a hand-over is a proposal: the booking stays with the first artist until the client accepts", async () => {
    const { salon, members } = await teamSalon("Handover Salon", 2);
    const [leaving, taking] = members;
    const client = await newClient("Handover Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00", staff: leaving.staff.name });

    const wrong = await propose(leaving, { kind: "salon", id, toStaff: leaving.staff.name, salonUserId: salon.id });
    expect(wrong.status).toBe(409);
    const made = await propose(leaving, { kind: "salon", id, toStaff: taking.staff.name, salonUserId: salon.id });
    expect(made.ok).toBe(true);
    let row = await salonRow(id);
    expect(row.staff).toBe(leaving.staff.name);
    expect(row.proposal_staff).toBe(taking.staff.name);
    expect(row.status).toBe("تایید شده");
    // the client sees the open proposal on the booking
    const seen = (await client.api.get("/api/client-bookings")).payload.data.salonBookings.find((b) => b.id === id);
    expect(seen.proposal).toMatchObject({ staff: taking.staff.name });

    // a pending hand-over means the choice is made: the artist can leave
    const left = await leaving.api.delete("/api/artist/teams", { salonUserId: salon.id });
    expect(left.ok).toBe(true);

    const accepted = await answer(client, { kind: "salon", id, action: "accept" });
    expect(accepted.ok).toBe(true);
    row = await salonRow(id);
    expect(row.staff).toBe(taking.staff.name);
    expect(row.status).toBe("تایید شده");
    expect(row.proposal_at).toBeNull();
    // the new artist's calendar has it
    const copies = await q("SELECT id FROM artist_bookings WHERE artist_user_id = $1 AND source_salon_user_id = $2", [taking.id, salon.id]);
    expect(copies.length).toBeGreaterThan(0);
  });

  it("«لغو با اطلاع مشتری» per booking, then the artist leaves; their calendar copy is gone at once", async () => {
    const { salon, members } = await teamSalon("Cancel Exit Salon", 2);
    const [leaving] = members;
    const client = await newClient("Cancel Exit Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00", staff: leaving.staff.name });
    const cancelled = await exitCancel(leaving, { scope: "team", salonUserId: salon.id, kind: "salon", id });
    expect(cancelled.ok).toBe(true);
    expect((await salonRow(id)).status).toBe("لغو");
    expect(await counter(leaving.id)).toBe(1);
    expect((await leaving.api.delete("/api/artist/teams", { salonUserId: salon.id })).ok).toBe(true);
    expect(await q("SELECT 1 FROM artist_bookings WHERE artist_user_id = $1 AND source_salon_user_id = $2 AND status <> 'لغو'", [leaving.id, salon.id])).toHaveLength(0);
  });

  it("the salon removing a member follows the same rules", async () => {
    const { salon, members } = await teamSalon("Remove Salon", 2);
    const [leaving] = members;
    const client = await newClient("Remove Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00", staff: leaving.staff.name });
    await moveSalonBookingNear(id, 400);
    const blocked = await salon.api.delete("/api/salon-staff", { id: leaving.staff.id });
    expect(blocked.status).toBe(409);
    expect(blocked.payload.code).toBe("NEAR_BOOKINGS");
    expect(blocked.payload.error).toContain("از تیم برداشت");
    expect((await exitCancel(salon, { scope: "staff", staffId: leaving.staff.id, kind: "salon", id })).ok).toBe(true);
    expect((await salon.api.delete("/api/salon-staff", { id: leaving.staff.id })).ok).toBe(true);
    expect(await counter(salon.id)).toBe(1);
  });
});

describe("the admin accounts list shows «لغو توسط سالن» (Q4)", () => {
  it("counts cancellations of CONFIRMED bookings only, and can be sorted by it", async () => {
    const salon = await newSalon("Counter Salon");
    const client = await newClient("Counter Client");
    // a request that was never confirmed does not count when declined
    const pending = await client.api.post("/api/salon-bookings", { salonUserId: salon.id, service: "کوتاهی مو", bookingDate: FAR_DAY(2), time: "10:00", client: client.user.name, phone: client.phone });
    expect((await salon.api.patch("/api/salon-bookings", { id: pending.payload.data.booking.id, status: "لغو", action: "cancel" })).ok).toBe(true);
    expect(await counter(salon.id)).toBe(0);
    // a confirmed one does
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "13:00" });
    expect((await salon.api.patch("/api/salon-bookings", { id, status: "لغو", action: "cancel" })).ok).toBe(true);
    expect(await counter(salon.id)).toBe(1);
    // the client cancelling their own never counts against the salon
    const mine = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "15:00" });
    expect((await client.api.post(`/api/salon-bookings/${mine}/cancel`, {})).ok).toBe(true);
    expect(await counter(salon.id)).toBe(1);

    const admin = await adminClient();
    const list = (await admin.get(`/api/admin/users?q=${encodeURIComponent(salon.user.name)}`)).payload.data.users;
    expect(list.find((user) => user.id === salon.id).provider_cancel_count).toBe(1);
    const sorted = (await admin.get("/api/admin/users?sort=cancels&limit=5")).payload.data.users;
    expect(sorted[0].provider_cancel_count).toBeGreaterThanOrEqual(1);
    const counts = sorted.map((user) => user.provider_cancel_count);
    expect(counts).toEqual([...counts].sort((x, y) => y - x));
    const detail = (await admin.get(`/api/admin/users/${salon.id}`)).payload.data.user;
    expect(detail.provider_cancel_count).toBe(1);
  });
});
