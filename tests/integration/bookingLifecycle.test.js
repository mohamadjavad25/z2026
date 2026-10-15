import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { createClient, registerUser, joinSalonAsArtist, futureBookingDay } from "./helpers.js";
import { formatPersianDateKey } from "../../app/shared/lib/persianCalendar.js";
import { getTehranClockMinutes, minutesToPersianTime } from "../../app/shared/lib/time.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";

/**
 * Every booking direction, start to finish: client -> salon, client -> salon artist (mirror),
 * client -> independent artist, and the answers coming back (salon / artist -> client).
 * Time is faked in the database (created_at / booking_date) because the sweep runs on real clocks.
 */
const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

const EXPIRED = "منقضی شده";
const PENDING = "درخواست";
const today = () => formatPersianDateKey(new Date());
const clockAgo = (minutes) => minutesToPersianTime(getTehranClockMinutes(new Date()) - minutes);
const canFakeStartedSlot = () => getTehranClockMinutes(new Date()) >= 10;

async function sweep() {
  const res = await fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
  expect(res.status).toBe(200);
  return (await res.json()).data;
}
const age = async (table, id, minutes) => { await connected; await db.query(`UPDATE ${table} SET created_at = NOW() - ($2 || ' minutes')::interval WHERE id = $1`, [id, String(minutes)]); };
const startedFiveMinutesAgo = async (table, id) => { await connected; await db.query(`UPDATE ${table} SET booking_date = $2, time = $3 WHERE id = $1`, [id, today(), clockAgo(5)]); };

async function newSalon(name, { withArtist = false } = {}) {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: `${name} Salon` });
  await salonClient.get("/api/salon-hours");
  const ctx = { salonClient, salon };
  if (withArtist) {
    ctx.artistClient = createClient();
    ctx.artist = await registerUser(ctx.artistClient, { type: "artist", name: `${name} Staff` });
    expect((await joinSalonAsArtist(ctx.artistClient, salonClient, salon.user.id)).ok).toBe(true);
    ctx.staffName = (await salonClient.get("/api/salon-staff")).payload.data.staff[0].name;
  }
  return ctx;
}
async function newClient(name) {
  const api = createClient();
  const user = await registerUser(api, { type: "client", name });
  return { api, user: user.user, phone: user.phone };
}
async function requestSalon(ctx, who, { day = futureBookingDay(2), time = "10:00", staff } = {}) {
  const res = await who.api.post("/api/salon-bookings", {
    salonUserId: ctx.salon.user.id, service: "کوتاهی مو", bookingDate: day, time, staff, client: who.user.name, phone: who.phone
  });
  expect(res.status).toBe(201);
  return res.payload.data.booking;
}
const salonRow = async (ctx, id) => (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id);
const clientSalonRow = async (who, id) => (await who.api.get("/api/salon-bookings")).payload.data.bookings.find((b) => b.id === id);

async function newDirectArtist(name, settings = {}) {
  const artistClient = createClient();
  const artist = await registerUser(artistClient, { type: "artist", name });
  if (Object.keys(settings).length) await artistClient.post("/api/profile/settings", { settings });
  return { artistClient, artist };
}
async function requestArtist(a, who, { day = futureBookingDay(2), time = "10:00" } = {}) {
  const res = await who.api.post("/api/artist/bookings", { artistUserId: a.artist.user.id, service: "ناخن", bookingDate: day, time });
  expect(res.status).toBe(201);
  return res.payload.data.booking;
}
const artistRow = async (a, id) => (await a.artistClient.get("/api/artist/me")).payload.data.bookings.find((b) => b.id === id);
const clientArtistRow = async (who, id) => (await who.api.get("/api/artist-bookings")).payload.data.bookings.find((b) => b.id === id);

describe("client -> salon", () => {
  it("approve: the client sees it confirmed and nothing later turns it into expired", async () => {
    const ctx = await newSalon("Approve");
    const client = await newClient("C Approve");
    const booking = await requestSalon(ctx, client);
    expect(booking.status).toBe(PENDING);
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, status: "تایید شده" })).ok).toBe(true);
    expect((await clientSalonRow(client, booking.id)).status).toBe("تایید شده");
    await age("salon_bookings", booking.id, 600);
    await sweep();
    expect((await salonRow(ctx, booking.id)).status).toBe("تایید شده");
  });

  it("decline: the client sees لغو, the time is free again, and expiry never overwrites it", async () => {
    const ctx = await newSalon("Decline");
    const client = await newClient("C Decline");
    const day = futureBookingDay(2);
    const booking = await requestSalon(ctx, client, { day });
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, status: "لغو" })).ok).toBe(true);
    expect((await clientSalonRow(client, booking.id)).status).toBe("لغو");
    await age("salon_bookings", booking.id, 600);
    await sweep();
    expect((await salonRow(ctx, booking.id)).status).toBe("لغو");
    const other = await newClient("C Decline Other");
    await requestSalon(ctx, other, { day });
  });

  it("nobody answers: expires after an hour (not before), frees the time, and can no longer be approved", async () => {
    const ctx = await newSalon("Ignore");
    const client = await newClient("C Ignore");
    const day = futureBookingDay(2);
    const booking = await requestSalon(ctx, client, { day });
    await age("salon_bookings", booking.id, 59);
    await sweep();
    expect((await salonRow(ctx, booking.id)).status).toBe(PENDING);
    await age("salon_bookings", booking.id, 61);
    const first = await sweep();
    expect(first.salonExpired).toBeGreaterThanOrEqual(1);
    expect((await clientSalonRow(client, booking.id)).status).toBe(EXPIRED);
    expect((await salonRow(ctx, booking.id)).status).toBe(EXPIRED);
    // Running again does nothing more to it.
    await sweep();
    expect((await salonRow(ctx, booking.id)).status).toBe(EXPIRED);

    const late = await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, status: "تایید شده" });
    expect(late.status).toBe(409);
    expect(late.payload.code).toBe("BOOKING_EXPIRED");
    expect((await clientSalonRow(client, booking.id)).status).toBe(EXPIRED);
    // The client can't cancel what is already over, but can ask again for the same time.
    expect((await client.api.post(`/api/salon-bookings/${booking.id}/cancel`, {})).status).toBe(409);
    const again = await requestSalon(ctx, client, { day });
    expect(again.status).toBe(PENDING);
  });

  it("the appointment time passing closes the request even if it was just sent", async () => {
    if (!canFakeStartedSlot()) return;
    const ctx = await newSalon("Started");
    const client = await newClient("C Started");
    const booking = await requestSalon(ctx, client);
    await startedFiveMinutesAgo("salon_bookings", booking.id);
    await sweep();
    expect((await clientSalonRow(client, booking.id)).status).toBe(EXPIRED);
  });

  it("the client cancels while it waits: the salon sees لغو and the sweep leaves it alone", async () => {
    const ctx = await newSalon("ClientCancel");
    const client = await newClient("C Cancel");
    const booking = await requestSalon(ctx, client);
    expect((await client.api.post(`/api/salon-bookings/${booking.id}/cancel`, {})).ok).toBe(true);
    await age("salon_bookings", booking.id, 600);
    await sweep();
    expect((await salonRow(ctx, booking.id)).status).toBe("لغو");
  });

  it("only the salon's own status choices are accepted", async () => {
    const ctx = await newSalon("Whitelist");
    const client = await newClient("C Whitelist");
    const booking = await requestSalon(ctx, client);
    for (const status of [EXPIRED, "تازه", "foo"]) {
      expect((await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, status })).status).toBe(400);
    }
    expect((await salonRow(ctx, booking.id)).status).toBe(PENDING);
  });

  it("a stranger and another salon can't see or answer it", async () => {
    const ctx = await newSalon("Private");
    const other = await newSalon("PrivateOther");
    const client = await newClient("C Private");
    const stranger = await newClient("C Stranger");
    const booking = await requestSalon(ctx, client);
    expect((await other.salonClient.patch("/api/salon-bookings", { id: booking.id, status: "تایید شده" })).status).toBe(404);
    expect(await clientSalonRow(stranger, booking.id)).toBeUndefined();
    expect(await salonRow(other, booking.id)).toBeUndefined();
    expect((await salonRow(ctx, booking.id)).status).toBe(PENDING);
  });
});

describe("client -> salon artist (the artist holds a mirror copy)", () => {
  const mirrorOf = async (ctx, client) => (await ctx.artistClient.get("/api/artist/me")).payload.data.bookings.find((b) => b.client_name === client.user.name);

  it("expiry closes the salon booking and the artist's copy together, counted once, artist can't revive it", async () => {
    const ctx = await newSalon("Mirror", { withArtist: true });
    const client = await newClient("C Mirror");
    const booking = await requestSalon(ctx, client, { staff: ctx.staffName });
    const mirror = await mirrorOf(ctx, client);
    expect(mirror.status).toBe(PENDING);
    await age("salon_bookings", booking.id, 61);
    await age("artist_bookings", mirror.id, 61);
    const result = await sweep();
    expect(result.artistExpired).toBe(0);
    expect((await clientSalonRow(client, booking.id)).status).toBe(EXPIRED);
    expect((await mirrorOf(ctx, client)).status).toBe(EXPIRED);
    const revive = await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id: mirror.id, status: "تایید شده" });
    expect(revive.status).toBe(409);
    const decline = await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id: mirror.id, status: "لغو" });
    expect(decline.status).toBe(409);
    expect((await salonRow(ctx, booking.id)).status).toBe(EXPIRED);
  });

  it("artist answers first: confirm reaches salon and client; the hour no longer matters", async () => {
    const ctx = await newSalon("MirrorOk", { withArtist: true });
    const client = await newClient("C MirrorOk");
    const booking = await requestSalon(ctx, client, { staff: ctx.staffName });
    const mirror = await mirrorOf(ctx, client);
    expect((await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id: mirror.id, status: "تایید شده" })).ok).toBe(true);
    await age("salon_bookings", booking.id, 600);
    await age("artist_bookings", mirror.id, 600);
    await sweep();
    expect((await clientSalonRow(client, booking.id)).status).toBe("تایید شده");
    expect((await mirrorOf(ctx, client)).status).toBe("تایید شده");
  });

  it("artist declines: salon and client see لغو and the time is free", async () => {
    const ctx = await newSalon("MirrorNo", { withArtist: true });
    const client = await newClient("C MirrorNo");
    const day = futureBookingDay(2);
    const booking = await requestSalon(ctx, client, { staff: ctx.staffName, day });
    const mirror = await mirrorOf(ctx, client);
    expect((await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id: mirror.id, status: "لغو" })).ok).toBe(true);
    expect((await clientSalonRow(client, booking.id)).status).toBe("لغو");
    const other = await newClient("C MirrorNo Other");
    await requestSalon(ctx, other, { staff: ctx.staffName, day });
  });

  it("salon cancels / client cancels: the artist's copy follows", async () => {
    const ctx = await newSalon("MirrorCancel", { withArtist: true });
    const a = await newClient("C MirrorCancelA");
    const b = await newClient("C MirrorCancelB");
    const first = await requestSalon(ctx, a, { staff: ctx.staffName, day: futureBookingDay(2) });
    const second = await requestSalon(ctx, b, { staff: ctx.staffName, day: futureBookingDay(3) });
    expect((await ctx.salonClient.patch("/api/salon-bookings", { id: first.id, status: "لغو" })).ok).toBe(true);
    expect((await mirrorOf(ctx, a)).status).toBe("لغو");
    expect((await b.api.post(`/api/salon-bookings/${second.id}/cancel`, {})).ok).toBe(true);
    expect((await mirrorOf(ctx, b)).status).toBe("لغو");
  });

  it("a request whose time started expires on both sides", async () => {
    if (!canFakeStartedSlot()) return;
    const ctx = await newSalon("MirrorStarted", { withArtist: true });
    const client = await newClient("C MirrorStarted");
    const booking = await requestSalon(ctx, client, { staff: ctx.staffName });
    const mirror = await mirrorOf(ctx, client);
    await startedFiveMinutesAgo("salon_bookings", booking.id);
    await startedFiveMinutesAgo("artist_bookings", mirror.id);
    await sweep();
    expect((await clientSalonRow(client, booking.id)).status).toBe(EXPIRED);
    expect((await mirrorOf(ctx, client)).status).toBe(EXPIRED);
  });
});

describe("client -> independent artist", () => {
  it("confirm and decline reach the client", async () => {
    const a = await newDirectArtist("Direct Answer");
    const client = await newClient("C Direct");
    const first = await requestArtist(a, client, { day: futureBookingDay(2) });
    const second = await requestArtist(a, client, { day: futureBookingDay(3) });
    expect(first.status).toBe("تازه");
    expect((await a.artistClient.patch("/api/artist/me", { kind: "booking", id: first.id, status: "تایید شده" })).ok).toBe(true);
    expect((await a.artistClient.patch("/api/artist/me", { kind: "booking", id: second.id, status: "لغو" })).ok).toBe(true);
    expect((await clientArtistRow(client, first.id)).status).toBe("تایید شده");
    expect((await clientArtistRow(client, second.id)).status).toBe("لغو");
  });

  it("nobody answers: expires after an hour, frees the time, can't be confirmed or declined later", async () => {
    const a = await newDirectArtist("Direct Ignore");
    const client = await newClient("C Direct Ignore");
    const day = futureBookingDay(2);
    const booking = await requestArtist(a, client, { day });
    await age("artist_bookings", booking.id, 59);
    await sweep();
    expect((await clientArtistRow(client, booking.id)).status).toBe("تازه");
    await age("artist_bookings", booking.id, 61);
    expect((await sweep()).artistExpired).toBeGreaterThanOrEqual(1);
    expect((await clientArtistRow(client, booking.id)).status).toBe(EXPIRED);
    expect((await a.artistClient.patch("/api/artist/me", { kind: "booking", id: booking.id, status: "تایید شده" })).status).toBe(409);
    expect((await a.artistClient.patch("/api/artist/me", { kind: "booking", id: booking.id, status: "لغو" })).status).toBe(409);
    expect((await client.api.post(`/api/artist-bookings/${booking.id}/cancel`, {})).status).toBe(409);
    await requestArtist(a, client, { day });
  });

  it("a request whose time started expires", async () => {
    if (!canFakeStartedSlot()) return;
    const a = await newDirectArtist("Direct Started");
    const client = await newClient("C Direct Started");
    const booking = await requestArtist(a, client);
    await startedFiveMinutesAgo("artist_bookings", booking.id);
    await sweep();
    expect((await clientArtistRow(client, booking.id)).status).toBe(EXPIRED);
  });

  it("client cancels: the artist sees لغو; a stranger can't cancel it; confirmed ones never expire", async () => {
    const a = await newDirectArtist("Direct Cancel");
    const client = await newClient("C Direct Cancel");
    const stranger = await newClient("C Direct Stranger");
    const cancelled = await requestArtist(a, client, { day: futureBookingDay(2) });
    const confirmed = await requestArtist(a, client, { day: futureBookingDay(3) });
    expect((await stranger.api.post(`/api/artist-bookings/${cancelled.id}/cancel`, {})).status).toBe(404);
    expect((await client.api.post(`/api/artist-bookings/${cancelled.id}/cancel`, {})).ok).toBe(true);
    expect((await artistRow(a, cancelled.id)).status).toBe("لغو");
    await a.artistClient.patch("/api/artist/me", { kind: "booking", id: confirmed.id, status: "تایید شده" });
    await age("artist_bookings", confirmed.id, 600);
    await age("artist_bookings", cancelled.id, 600);
    await sweep();
    expect((await artistRow(a, confirmed.id)).status).toBe("تایید شده");
    expect((await artistRow(a, cancelled.id)).status).toBe("لغو");
  });

  it("another artist can't answer it", async () => {
    const a = await newDirectArtist("Direct Owner");
    const other = await newDirectArtist("Direct Other");
    const client = await newClient("C Direct Owner");
    const booking = await requestArtist(a, client);
    expect((await other.artistClient.patch("/api/artist/me", { kind: "booking", id: booking.id, status: "تایید شده" })).status).toBe(404);
  });

  it("autoConfirm: confirmed at once, never expires", async () => {
    const a = await newDirectArtist("Direct Auto", { autoConfirm: true });
    const client = await newClient("C Direct Auto");
    const booking = await requestArtist(a, client);
    expect(booking.status).toBe("تایید شده");
    await age("artist_bookings", booking.id, 600);
    await sweep();
    expect((await clientArtistRow(client, booking.id)).status).toBe("تایید شده");
  });

  it("a guest (not signed in) request also waits and expires", async () => {
    const a = await newDirectArtist("Direct Guest");
    const guest = createClient();
    const res = await guest.post("/api/artist/bookings", {
      artistUserId: a.artist.user.id, service: "ناخن", bookingDate: futureBookingDay(2), time: "10:00", clientName: "Guest", clientPhone: "09120000777"
    });
    expect(res.status).toBe(201);
    await age("artist_bookings", res.payload.data.booking.id, 61);
    await sweep();
    expect((await artistRow(a, res.payload.data.booking.id)).status).toBe(EXPIRED);
  });
});

describe("the owner's own entries are never treated as unanswered requests", () => {
  it("a salon walk-in (entered by the salon) stays after the sweep", async () => {
    const ctx = await newSalon("WalkIn");
    const res = await ctx.salonClient.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, service: "کوتاهی مو", bookingDate: futureBookingDay(2), time: "10:00", client: "حضوری", phone: "09120000555"
    });
    expect(res.status).toBe(201);
    const id = res.payload.data.booking.id;
    await age("salon_bookings", id, 600);
    await sweep();
    expect((await salonRow(ctx, id)).status).not.toBe(EXPIRED);
  });

  it("an artist's own entry (their own calendar) stays after the sweep", async () => {
    const a = await newDirectArtist("Own Entry");
    const viaMe = await a.artistClient.post("/api/artist/me", {
      kind: "booking", service: "ناخن", bookingDate: futureBookingDay(2), time: "10:00", client: "حضوری ۱", phone: "09120000556"
    });
    const viaOwner = await a.artistClient.post("/api/artist/bookings", {
      artistUserId: a.artist.user.id, service: "ناخن", bookingDate: futureBookingDay(3), time: "10:00", clientName: "حضوری ۲", clientPhone: "09120000557"
    });
    expect(viaMe.status).toBe(201);
    expect(viaOwner.status).toBe(201);
    for (const id of [viaMe.payload.data.booking.id, viaOwner.payload.data.booking.id]) await age("artist_bookings", id, 600);
    await sweep();
    for (const id of [viaMe.payload.data.booking.id, viaOwner.payload.data.booking.id]) {
      expect((await artistRow(a, id)).status).not.toBe(EXPIRED);
    }
  });
});

describe("expiry doesn't depend on a scheduler or on an owner opening the app", () => {
  it("a client who keeps the app open sees their stale request close by itself", async () => {
    const ctx = await newSalon("Lazy");
    const client = await newClient("C Lazy");
    const a = await newDirectArtist("Lazy Artist");
    const salonBooking = await requestSalon(ctx, client);
    const artistBooking = await requestArtist(a, client);
    await age("salon_bookings", salonBooking.id, 61);
    await age("artist_bookings", artistBooking.id, 61);
    // The on-demand sweep runs at most once a minute per server, so allow for that.
    const deadline = Date.now() + 80_000;
    let seen;
    while (Date.now() < deadline) {
      const { salonBookings, artistBookings } = (await client.api.get("/api/client-bookings")).payload.data;
      seen = [salonBookings.find((b) => b.id === salonBooking.id)?.status, artistBookings.find((b) => b.id === artistBooking.id)?.status];
      if (seen.every((status) => status === EXPIRED)) break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    expect(seen).toEqual([EXPIRED, EXPIRED]);
  }, 100_000);
});

describe("salon -> client: a new time the salon offers", () => {
  const AWAITING = "در انتظار مشتری";
  it("the client accepts or declines it; one that is never answered closes when its time starts", async () => {
    const ctx = await newSalon("Offer");
    const client = await newClient("C Offer");
    const accept = await requestSalon(ctx, client, { day: futureBookingDay(2), time: "10:00" });
    const decline = await requestSalon(ctx, client, { day: futureBookingDay(3), time: "10:00" });
    const ignore = await requestSalon(ctx, client, { day: futureBookingDay(4), time: "10:00" });
    for (const booking of [accept, decline, ignore]) {
      const moved = await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, time: "12:00" });
      expect(moved.payload.data.booking.status).toBe(AWAITING);
    }
    // While it waits on the client, the hour window does not apply.
    await age("salon_bookings", ignore.id, 600);
    await sweep();
    expect((await clientSalonRow(client, ignore.id)).status).toBe(AWAITING);

    expect((await client.api.post(`/api/salon-bookings/${accept.id}/answer`, { accept: true })).payload.data.booking.status).toBe("تایید شده");
    expect((await client.api.post(`/api/salon-bookings/${decline.id}/answer`, { accept: false })).payload.data.booking.status).toBe("لغو");

    if (!canFakeStartedSlot()) return;
    await startedFiveMinutesAgo("salon_bookings", ignore.id);
    await sweep();
    expect((await clientSalonRow(client, ignore.id)).status).toBe(EXPIRED);
    expect((await client.api.post(`/api/salon-bookings/${ignore.id}/answer`, { accept: true })).status).toBe(409);
  });
});

describe("artist -> client: the artist cancels something already confirmed", () => {
  it("direct booking: the client sees لغو and the time is free", async () => {
    const a = await newDirectArtist("Artist Cancels");
    const client = await newClient("C Artist Cancels");
    const day = futureBookingDay(2);
    const booking = await requestArtist(a, client, { day });
    await a.artistClient.patch("/api/artist/me", { kind: "booking", id: booking.id, status: "تایید شده" });
    expect((await a.artistClient.patch("/api/artist/me", { kind: "booking", id: booking.id, status: "لغو" })).ok).toBe(true);
    expect((await clientArtistRow(client, booking.id)).status).toBe("لغو");
    await requestArtist(a, client, { day });
  });
});
