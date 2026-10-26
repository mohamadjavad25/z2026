import { describe, it, expect } from "vitest";
import { FAR_DAY, answer, confirmedAt, counter, cron, directConfirmed, newArtist, newClient, newSalon, propose, q, salonRow, slotAhead, smsEventually, artistRow } from "./exitHelpers.js";
import { moveSalonBookingNear } from "./exitHelpers.js";

/** The owner's rule of 2026-10-22 (Q2): changing the time of a CONFIRMED booking is a proposal the client accepts. */
describe("«پیشنهاد ساعت دیگر» on a confirmed booking", () => {
  it("the salon's time change becomes a proposal; the original stays until the client accepts, then it moves", async () => {
    const salon = await newSalon("Proposal Salon");
    const client = await newClient("Proposal Client");
    const day = FAR_DAY(3);
    const id = await confirmedAt(salon, client, { day, time: "11:00" });

    const patched = await salon.api.patch("/api/salon-bookings", { id, time: "14:00" });
    expect(patched.ok).toBe(true);
    expect(patched.payload.data.proposal).toBe(true);
    let row = await salonRow(id);
    expect(row.time).toBe("11:00");
    expect(row.status).toBe("تایید شده");
    expect(row.proposal_time).toBe("14:00");

    const card = (await client.api.get("/api/client-bookings")).payload.data.salonBookings.find((b) => b.id === id);
    expect(card.time).toBe("11:00");
    expect(card.proposal).toMatchObject({ time: "14:00", date: day });
    expect(card.proposal.expiresAt).toBeTruthy();
    // the salon's own list shows it too (so the screen can say «منتظر جواب مشتری»)
    const own = (await salon.api.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id);
    expect(own.proposal).toMatchObject({ time: "14:00" });

    const accepted = await answer(client, { kind: "salon", id, action: "accept" });
    expect(accepted.ok).toBe(true);
    row = await salonRow(id);
    expect(row).toMatchObject({ time: "14:00", status: "تایید شده", proposal_time: "" });
    expect(row.proposal_at).toBeNull();
    // answering again is refused, nothing moves
    expect((await answer(client, { kind: "salon", id, action: "accept" })).status).toBe(409);
    expect(await counter(salon.id)).toBe(0);
  });

  it("the proposed time must be a free slot inside working hours, never the same time, and not for a client without an account", async () => {
    const salon = await newSalon("Proposal Rules Salon");
    const client = await newClient("Proposal Rules Client");
    const other = await newClient("Proposal Other Client");
    const day = FAR_DAY(3);
    const id = await confirmedAt(salon, client, { day, time: "11:00" });
    await confirmedAt(salon, other, { day, time: "15:00" });

    expect((await propose(salon, { kind: "salon", id, date: day, time: "11:00" })).status).toBe(400); // the same time
    expect((await propose(salon, { kind: "salon", id, date: day, time: "15:00" })).status).toBe(409); // taken
    expect((await propose(salon, { kind: "salon", id, date: day, time: "03:00" })).status).toBe(409); // outside hours
    expect((await salonRow(id)).proposal_at).toBeNull();

    const walkIn = await salon.api.post("/api/salon-bookings", { service: "کوتاهی مو", bookingDate: day, time: "17:00", client: "بدون حساب", phone: "09100000000" });
    expect(walkIn.ok).toBe(true);
    const refused = await propose(salon, { kind: "salon", id: walkIn.payload.data.booking.id, date: day, time: "18:00" });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("NO_ACCOUNT");
    expect(refused.payload.data.phone).toBe("09100000000");
  });

  it("a booking starting in under 2 hours cannot get a proposal: the salon must call", async () => {
    const salon = await newSalon("Late Proposal Salon");
    const client = await newClient("Late Proposal Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    await moveSalonBookingNear(id, 90);
    const refused = await propose(salon, { kind: "salon", id, date: slotAhead(90).date, time: "23:30" });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("TOO_LATE");
  });

  it("the client can cancel instead («لغو نوبت، بدون هیچ مشکلی»): it counts against nobody", async () => {
    const salon = await newSalon("Proposal Cancel Salon");
    const client = await newClient("Proposal Cancel Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "13:00" })).ok).toBe(true);
    const cancelled = await answer(client, { kind: "salon", id, action: "cancel" });
    expect(cancelled.ok).toBe(true);
    const row = await salonRow(id);
    expect(row).toMatchObject({ status: "لغو", cancelled_by: "client" });
    expect(row.proposal_at).toBeNull();
    expect(await counter(salon.id)).toBe(0);
  });

  it("«لغو نوبت، بدون هیچ مشکلی» without an open proposal changes nothing (a stale tap never kills a booking)", async () => {
    const salon = await newSalon("Stale Cancel Salon");
    const client = await newClient("Stale Cancel Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    const stale = await answer(client, { kind: "salon", id, action: "cancel" });
    expect(stale.status).toBe(409);
    expect(stale.payload.code).toBe("NO_PROPOSAL");
    expect((await salonRow(id)).status).toBe("تایید شده");
  });

  it("the salon can take its proposal back; the original is untouched and a later answer is refused", async () => {
    const salon = await newSalon("Withdraw Salon");
    const client = await newClient("Withdraw Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "13:00" })).ok).toBe(true);
    const withdrawn = await salon.api.delete("/api/booking-proposals", { kind: "salon", id });
    expect(withdrawn.ok).toBe(true);
    expect((await salonRow(id)).proposal_at).toBeNull();
    const late = await answer(client, { kind: "salon", id, action: "accept" });
    expect(late.status).toBe(409);
    expect((await salonRow(id)).time).toBe("11:00");
  });

  it("a newer proposal replaces the old one, and only the client of the booking may answer", async () => {
    const salon = await newSalon("Replace Salon");
    const client = await newClient("Replace Client");
    const stranger = await newClient("Replace Stranger");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "13:00" })).ok).toBe(true);
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "14:00" })).ok).toBe(true);
    expect((await salonRow(id)).proposal_time).toBe("14:00");
    expect((await answer(stranger, { kind: "salon", id, action: "accept" })).status).toBe(404);
    expect((await answer(client, { kind: "salon", id, action: "accept" })).ok).toBe(true);
    expect((await salonRow(id)).time).toBe("14:00");
  });

  it("two answers at the same moment end in exactly one result", async () => {
    const salon = await newSalon("Race Salon");
    const client = await newClient("Race Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "13:00" })).ok).toBe(true);
    const results = await Promise.all([
      answer(client, { kind: "salon", id, action: "accept" }),
      answer(client, { kind: "salon", id, action: "cancel" }),
      answer(client, { kind: "salon", id, action: "accept" })
    ]);
    expect(results.filter((r) => r.ok).length).toBe(1);
    const row = await salonRow(id);
    expect(["13:00", "11:00"]).toContain(row.time);
    expect(row.proposal_at).toBeNull();
    if (row.status === "لغو") expect(row.time).toBe("11:00");
    else expect(row.time).toBe("13:00");
  });

  it("no answer in 6 hours: the sweep keeps the original and tells the salon; a late «قبول» is refused", async () => {
    const salon = await newSalon("Timeout Salon");
    const client = await newClient("Timeout Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(5), time: "11:00" });
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "13:00" })).ok).toBe(true);
    // one hour in: still open
    await q("UPDATE salon_bookings SET proposal_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [id]);
    await cron("expire-bookings");
    expect((await salonRow(id)).proposal_at).not.toBeNull();
    // seven hours in: closed by the same job that expires requests
    await q("UPDATE salon_bookings SET proposal_at = NOW() - INTERVAL '7 hours' WHERE id = $1", [id]);
    const swept = await cron("expire-bookings");
    expect(swept.data.proposalsLapsed).toBeGreaterThanOrEqual(1);
    const row = await salonRow(id);
    expect(row).toMatchObject({ time: "11:00", status: "تایید شده", proposal_time: "" });
    expect(row.proposal_at).toBeNull();
    // the client no longer sees an open proposal
    const card = (await client.api.get("/api/client-bookings")).payload.data.salonBookings.find((b) => b.id === id);
    expect(card.proposal).toBeNull();
    // ... but the card carries the line «پیشنهاد سالن … تموم شد. نوبتت همون … سر جاشه.» (owner's decision of 2026-10-25)
    expect(card.proposal_lapsed_at).toBeTruthy();
    expect((await answer(client, { kind: "salon", id, action: "accept" })).status).toBe(409);
    expect((await salonRow(id)).time).toBe("11:00");
    // a new proposal clears the line
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "14:00" })).ok).toBe(true);
    expect((await salonRow(id)).proposal_lapsed_at).toBeNull();
  });

  it("a proposal that ran out is also refused on read, before any sweep: «قبول» after the deadline keeps the original", async () => {
    const salon = await newSalon("Lazy Timeout Salon");
    const client = await newClient("Lazy Timeout Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(5), time: "11:00" });
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "13:00" })).ok).toBe(true);
    await q("UPDATE salon_bookings SET proposal_at = NOW() - INTERVAL '7 hours' WHERE id = $1", [id]);
    const card = (await client.api.get("/api/client-bookings")).payload.data.salonBookings.find((b) => b.id === id);
    expect(card.proposal).toBeNull();
    const late = await answer(client, { kind: "salon", id, action: "accept" });
    expect(late.status).toBe(409);
    expect(late.payload.code).toBe("PROPOSAL_EXPIRED");
    expect((await salonRow(id)).time).toBe("11:00");
  });

  it("the client's phone gets the SMS once per proposal (an unapproved template just sends nothing extra)", async () => {
    const salon = await newSalon("Sms Proposal Salon");
    const client = await newClient("Sms Proposal Client");
    const id = await confirmedAt(salon, client, { day: FAR_DAY(3), time: "11:00" });
    expect((await salon.api.patch("/api/salon-bookings", { id, time: "13:00" })).ok).toBe(true);
    const texts = await smsEventually(client.phone, "booking_time_proposal", 1);
    expect(texts.length).toBe(1);
    expect(texts[0].body).toContain("قبول می‌کنی؟");
  });

  it("an independent artist's direct booking: the same proposal and the same answer", async () => {
    const artist = await newArtist("Proposal Artist");
    const client = await newClient("Proposal Direct Client");
    const id = await directConfirmed(artist, client, { day: FAR_DAY(3), time: "11:00" });
    const made = await propose(artist, { kind: "artist", id, date: FAR_DAY(3), time: "14:00" });
    expect(made.ok).toBe(true);
    let row = await artistRow(id);
    expect(row.time).toBe("11:00");
    expect(row.proposal_time).toBe("14:00");
    const card = (await client.api.get("/api/client-bookings")).payload.data.artistBookings.find((b) => b.id === id);
    expect(card.proposal).toMatchObject({ time: "14:00" });
    expect((await answer(client, { kind: "artist", id, action: "accept" })).ok).toBe(true);
    row = await artistRow(id);
    expect(row.time).toBe("14:00");
    expect(row.proposal_at).toBeNull();
  });
});
