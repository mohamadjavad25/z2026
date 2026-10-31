import { describe, it, expect, afterAll } from "vitest";
import {
  CONFIRMED, CANCELLED, EXPIRED, openDb, daysAgoKey, moveBooking, tehranMinutes, clockAgo, expirySweep, reminderSweep,
  newSalon, newDirectArtist, newClient, requestSalon, requestArtist, confirmSalon, confirmArtist,
  cancelBySalon, cancelByArtist, cancelByClient, salonRow, clientSalonRow, clientArtistRow,
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

async function apologySmsTo(phone) {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const { rows } = await db.query("SELECT body FROM sms_log WHERE phone = $1 AND purpose = 'booking_cancelled_by_provider' ORDER BY id", [phone]);
  return rows.map((row) => row.body);
}

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

  // Since the owner's decision of 2026-10-25 a confirmed visit that has started is no longer its salon's or artist's to
  // cancel: «نیومد» (POST /api/booking-no-show) takes its place, and the client gets no text.
  it("fixed: the salon can't cancel today's visit once it started; the client hears nothing", async () => {
    if (tehranMinutes() < 150) return; // needs a visit that started earlier today
    const { ctx, client, booking } = await confirmedSalonVisit("SalonSameDay");
    await moveToStartedAgo(db, "salon_bookings", booking.id, 120);
    const apologiesBefore = (await apologySmsTo(client.phone)).length;
    const refused = await cancelBySalon(ctx, booking.id);
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("BOOKING_STARTED");
    expect((await clientSalonRow(client, booking.id)).status).toBe(CONFIRMED);
    expect((await apologySmsTo(client.phone)).length).toBe(apologiesBefore);
  });

  it("fixed: an independent artist can't cancel a visit from three days ago", async () => {
    const { a, client, booking } = await confirmedArtistVisit("ArtistPast");
    await moveToDaysAgo(db, "artist_bookings", booking.id, 3);
    const refused = await cancelByArtist(a, booking.id);
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("BOOKING_STARTED");
    expect((await clientArtistRow(client, booking.id)).status).toBe(CONFIRMED);
  });

  it("fixed: a salon's team artist can't cancel last week's salon visit", async () => {
    const { ctx, client, booking } = await confirmedSalonVisit("TeamPast", { withArtist: true });
    await moveToDaysAgo(db, "salon_bookings", booking.id, 7);
    const mirror = (await ctx.artistClient.get("/api/artist/me")).payload.data.bookings
      .find((b) => b.client_name === client.user.name && b.status === CONFIRMED);
    expect(mirror).toBeTruthy();
    const refused = await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id: mirror.id, status: CANCELLED });
    expect(refused.status).toBe(409);
    expect((await salonRow(ctx, booking.id)).status).toBe(CONFIRMED);
    expect((await clientSalonRow(client, booking.id)).status).toBe(CONFIRMED);
  });

  it("fixed (rare): a team-artist request whose time is taken on the artist's calendar is closed by the sweep", async () => {
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
    expect((await salonRow(ctx, waiting.id)).status).toBe(EXPIRED);
  });

  it("fixed: a request nobody answered can no longer be approved once its time started", async () => {
    if (tehranMinutes() < 40) return;
    const ctx = await newSalon("LateApprove");
    const client = await newClient("C LateApprove");
    const booking = (await requestSalon(ctx, client)).payload.data.booking;
    await moveToStartedAgo(db, "salon_bookings", booking.id, 30);
    expect((await confirmSalon(ctx, booking.id)).ok).toBe(false);
    expect((await clientSalonRow(client, booking.id)).status).not.toBe(CONFIRMED);
  });
});

/** Puts a booking `hours` hours behind now (yesterday when needed), so «نیومد» windows can be tested at any time of day. */
async function moveToHoursAgo(table, id, hours) {
  const minutes = Math.round(hours * 60);
  const now = tehranMinutes();
  if (now >= minutes) return moveToStartedAgo(db, table, id, minutes);
  return moveBooking(db, table, id, { date: daysAgoKey(1), time: clockAgo(minutes - 1440) });
}

const noShow = (api, kind, id, value = true) => api.post("/api/booking-no-show", { kind, id, noShow: value });

describe("«نیومد» (owner's decision of 2026-10-25)", () => {
  it("the salon marks a visit that started; the client sees it, nobody is texted, the customers count follows", async () => {
    const { ctx, client, booking } = await confirmedSalonVisit("NoShowSalon", { withArtist: true });
    const textsBefore = (await answerSmsTo(db, client.phone)).length;
    await moveToHoursAgo("salon_bookings", booking.id, 3);
    const marked = await noShow(ctx.salonClient, "salon", booking.id);
    expect(marked.status).toBe(200);
    const salonSide = marked.payload.data.bookings.find((b) => b.id === booking.id);
    expect(salonSide.no_show_at).toBeTruthy();
    expect(salonSide.status).toBe(CONFIRMED);
    expect((await clientSalonRow(client, booking.id)).no_show_at).toBeTruthy();
    // The team artist's calendar copy carries the mark too.
    const mirror = (await ctx.artistClient.get("/api/artist/me")).payload.data.bookings.find((b) => b.client_name === client.user.name);
    expect(mirror.no_show_at).toBeTruthy();
    expect((await answerSmsTo(db, client.phone)).length).toBe(textsBefore);
    // Taken back: the mark goes, on both sides.
    expect((await noShow(ctx.salonClient, "salon", booking.id, false)).status).toBe(200);
    expect((await clientSalonRow(client, booking.id)).no_show_at).toBeFalsy();
  });

  it("not before the visit starts, and not more than 24 hours after", async () => {
    const { ctx, booking } = await confirmedSalonVisit("NoShowWindow");
    const early = await noShow(ctx.salonClient, "salon", booking.id);
    expect(early.status).toBe(409);
    await moveToDaysAgo(db, "salon_bookings", booking.id, 2);
    const late = await noShow(ctx.salonClient, "salon", booking.id);
    expect(late.status).toBe(409);
    expect((await salonRow(ctx, booking.id)).no_show_at).toBeFalsy();
  });

  it("only a confirmed booking, only its own salon or artist", async () => {
    const ctx = await newSalon("NoShowRequest");
    const client = await newClient("C NoShowRequest");
    const waiting = (await requestSalon(ctx, client)).payload.data.booking;
    expect((await noShow(ctx.salonClient, "salon", waiting.id)).status).toBe(409);
    const { booking } = await confirmedSalonVisit("NoShowOther");
    await moveToHoursAgo("salon_bookings", booking.id, 2);
    expect((await noShow(ctx.salonClient, "salon", booking.id)).status).toBe(404);
    expect((await noShow(client.api, "salon", booking.id)).status).toBe(403);
  });

  it("an independent artist marks their own direct visit", async () => {
    const { a, client, booking } = await confirmedArtistVisit("NoShowArtist");
    await moveToHoursAgo("artist_bookings", booking.id, 5);
    expect((await noShow(a.artistClient, "artist", booking.id)).status).toBe(200);
    expect((await clientArtistRow(client, booking.id)).no_show_at).toBeTruthy();
  });
});
