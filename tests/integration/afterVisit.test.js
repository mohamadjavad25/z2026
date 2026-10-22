import { describe, it, expect, afterAll } from "vitest";
import {
  CONFIRMED, CANCELLED, PENDING_SALON, openDb, daysAgoKey, moveBooking, tehranMinutes, expirySweep, reminderSweep,
  newSalon, newDirectArtist, newClient, requestSalon, requestArtist, confirmSalon, confirmArtist,
  cancelBySalon, cancelByArtist, cancelByClient, salonRow, clientSalonRow, artistRow, clientArtistRow,
  moveToDaysAgo, moveToStartedAgo, answerSmsTo
} from "./afterVisitKit.js";

/**
 * What happens to a confirmed booking once its time comes and goes (the visit happens, or doesn't, in the salon).
 * These tests pin down TODAY's behaviour so a later change is a conscious one. Tests named "gap:" describe
 * behaviour that is probably not what the product wants; they are listed in docs/ROADMAP.md («۱۴») and
 * should be flipped to the new rule when the owner decides it.
 */
const db = openDb();
afterAll(() => db.end());

async function confirmedSalonVisit(name, { withArtist = false } = {}) {
  const ctx = await newSalon(name, { withArtist });
  const client = await newClient(`C ${name}`);
  const created = await requestSalon(ctx, client, { staff: withArtist ? ctx.staffName : undefined });
  expect(created.status).toBe(201);
  const booking = created.payload.data.booking;
  expect((await confirmSalon(ctx, booking.id)).ok).toBe(true);
  return { ctx, client, booking };
}

async function confirmedArtistVisit(name) {
  const a = await newDirectArtist(name);
  const client = await newClient(`C ${name}`);
  const created = await requestArtist(a, client);
  expect(created.status).toBe(201);
  const booking = created.payload.data.booking;
  expect((await confirmArtist(a, booking.id)).ok).toBe(true);
  return { a, client, booking };
}

describe("after the visit: what the system knows", () => {
  it("a confirmed visit three days ago is still just «تایید شده» on both sides; no sweep touches it", async () => {
    const { ctx, client, booking } = await confirmedSalonVisit("Past3");
    await moveToDaysAgo(db, "salon_bookings", booking.id, 3);
    await expirySweep();
    await reminderSweep();
    const seenBySalon = await salonRow(ctx, booking.id);
    const seenByClient = await clientSalonRow(client, booking.id);
    expect(seenBySalon.status).toBe(CONFIRMED);
    expect(seenByClient.status).toBe(CONFIRMED);
    // Nothing on the row says whether the visit really happened (no done / no-show / finished time).
    for (const row of [seenBySalon, seenByClient]) {
      for (const key of ["completed_at", "completedAt", "attended", "no_show", "noShow", "done_at"]) {
        expect(row[key]).toBeUndefined();
      }
    }
  });

  it("there is no way to mark a visit done or no-show: any other status is refused", async () => {
    const { ctx, booking } = await confirmedSalonVisit("NoDone");
    await moveToDaysAgo(db, "salon_bookings", booking.id, 1);
    for (const status of ["انجام شد", "نیامد", "done", "no_show"]) {
      expect((await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, status })).status).toBe(400);
    }
  });

  it("no reminder is claimed for a visit that already started", async () => {
    const { booking } = await confirmedSalonVisit("NoLateReminder");
    await moveToDaysAgo(db, "salon_bookings", booking.id, 1);
    await reminderSweep();
    const { rows } = await db.query("SELECT kind FROM booking_reminders WHERE source = 'salon' AND booking_id = $1", [booking.id]);
    expect(rows).toEqual([]);
  });

  it("nobody hears anything after the visit: no text goes to the client once it is over", async () => {
    const { client, booking } = await confirmedSalonVisit("Silence");
    const before = (await answerSmsTo(db, client.phone)).length; // the «تأیید شد» text
    await moveToDaysAgo(db, "salon_bookings", booking.id, 1);
    await expirySweep();
    await reminderSweep();
    expect((await answerSmsTo(db, client.phone)).length).toBe(before);
  });
});

describe("after the visit: who may still change it", () => {
  it("the client can't cancel once it started", async () => {
    const { client, booking } = await confirmedSalonVisit("ClientLate");
    await moveToDaysAgo(db, "salon_bookings", booking.id, 1);
    expect((await cancelByClient(client, "salon_bookings", booking.id)).status).toBe(409);
    const artistSide = await confirmedArtistVisit("ClientLateArtist");
    await moveToDaysAgo(db, "artist_bookings", artistSide.booking.id, 1);
    expect((await cancelByClient(artistSide.client, "artist_bookings", artistSide.booking.id)).status).toBe(409);
  });

  it("the salon can't cancel a visit from an earlier day", async () => {
    const { ctx, booking } = await confirmedSalonVisit("SalonPastDay");
    await moveToDaysAgo(db, "salon_bookings", booking.id, 2);
    expect((await cancelBySalon(ctx, booking.id)).status).toBe(409);
    expect((await salonRow(ctx, booking.id)).status).toBe(CONFIRMED);
  });

  it("gap: the salon CAN cancel today's visit after it ended, and the client is texted «لغو شد»", async () => {
    if (tehranMinutes() < 150) return; // needs a visit that ended earlier today
    const { ctx, client, booking } = await confirmedSalonVisit("SalonSameDay");
    await moveToStartedAgo(db, "salon_bookings", booking.id, 120);
    const textsBefore = (await answerSmsTo(db, client.phone)).length;
    expect((await cancelBySalon(ctx, booking.id)).ok).toBe(true);
    expect((await clientSalonRow(client, booking.id)).status).toBe(CANCELLED);
    const texts = await answerSmsTo(db, client.phone);
    expect(texts.length).toBe(textsBefore + 1);
    expect(texts.at(-1)).toContain("لغو شد");
  });

  it("gap: an independent artist CAN cancel a visit from three days ago, and the client is texted «لغو شد»", async () => {
    const { a, client, booking } = await confirmedArtistVisit("ArtistPast");
    await moveToDaysAgo(db, "artist_bookings", booking.id, 3);
    const textsBefore = (await answerSmsTo(db, client.phone)).length;
    expect((await cancelByArtist(a, booking.id)).ok).toBe(true);
    expect((await clientArtistRow(client, booking.id)).status).toBe(CANCELLED);
    expect((await artistRow(a, booking.id)).status).toBe(CANCELLED);
    const texts = await answerSmsTo(db, client.phone);
    expect(texts.length).toBe(textsBefore + 1);
    expect(texts.at(-1)).toContain("لغو شد");
  });

  it("gap: a salon's team artist CAN cancel last week's salon visit, and the salon's booking flips to «لغو» too", async () => {
    const { ctx, client, booking } = await confirmedSalonVisit("TeamPast", { withArtist: true });
    await moveToDaysAgo(db, "salon_bookings", booking.id, 7);
    const mirror = (await ctx.artistClient.get("/api/artist/me")).payload.data.bookings
      .find((b) => b.client_name === client.user.name && b.status === CONFIRMED);
    expect(mirror).toBeTruthy();
    expect((await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id: mirror.id, status: CANCELLED })).ok).toBe(true);
    expect((await salonRow(ctx, booking.id)).status).toBe(CANCELLED);
    expect((await clientSalonRow(client, booking.id)).status).toBe(CANCELLED);
  });

  it("gap (rare): a team-artist request whose time is taken on the artist's calendar never closes; every sweep retries it", async () => {
    const ctx = await newSalon("Stuck", { withArtist: true });
    const first = await newClient("C Stuck 1");
    const second = await newClient("C Stuck 2");
    const waiting = (await requestSalon(ctx, first, { time: "10:00", staff: ctx.staffName })).payload.data.booking;
    const approved = (await requestSalon(ctx, second, { time: "12:00", staff: ctx.staffName })).payload.data.booking;
    expect((await confirmSalon(ctx, approved.id)).ok).toBe(true);
    // Both end up on the same past hour (the app itself never lets this happen; old or hand-fixed data could).
    await moveBooking(db, "salon_bookings", approved.id, { date: daysAgoKey(2), time: "12:00" });
    await moveBooking(db, "salon_bookings", waiting.id, { date: daysAgoKey(2), time: "12:00" });
    await expirySweep();
    await expirySweep();
    expect((await salonRow(ctx, waiting.id)).status).toBe(PENDING_SALON);
  });

  it("gap: a request nobody answered can still be approved after its time started, until the next sweep", async () => {
    if (tehranMinutes() < 40) return;
    const ctx = await newSalon("LateApprove");
    const client = await newClient("C LateApprove");
    const booking = (await requestSalon(ctx, client)).payload.data.booking;
    await moveToStartedAgo(db, "salon_bookings", booking.id, 30);
    expect((await confirmSalon(ctx, booking.id)).ok).toBe(true);
    expect((await clientSalonRow(client, booking.id)).status).toBe(CONFIRMED);
    // and once approved, the sweep leaves it confirmed
    await expirySweep();
    expect((await clientSalonRow(client, booking.id)).status).toBe(CONFIRMED);
  });
});
