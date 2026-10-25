import { describe, it, expect } from "vitest";
import { createClient, joinSalonAsArtist, registerUser } from "./helpers.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";
import { dateKeyAfter } from "../../app/shared/lib/artistPlace.js";

// Owner's decision of 2026-10-25: an artist's own clients go to one place at a time, the artist's «محل کار» (a salon whose
// team they are on, or their own place), set "from this day on". A client sees where before booking and is only offered
// hours both the artist and that salon are open. These tests drive the real server.

const norm = (value) => String(value || "").replace(/[\s‌]/g, "");

/** A Persian date key, at least two days ahead, that falls on the named weekday. */
function dayOn(weekday, skip = 0) {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  let seen = 0;
  for (let guard = 0; guard < 40; guard += 1) {
    if (norm(getPersianWeekday(date)) === norm(weekday)) {
      if (seen === skip) return formatPersianDateKey(date);
      seen += 1;
    }
    date.setDate(date.getDate() + 1);
  }
  throw new Error(`no ${weekday}`);
}

const SATURDAY = "شنبه";
const SUNDAY = "یکشنبه";

async function setup({ team = true } = {}) {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", menu: true, name: "Place Salon" });
  await salonClient.get("/api/salon-hours");
  const artistClient = createClient();
  const artist = await registerUser(artistClient, { type: "artist", menu: true, name: "Place Artist" });
  if (team) expect((await joinSalonAsArtist(artistClient, salonClient, salon.user.id)).ok).toBe(true);
  const staff = team
    ? (await salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => Number(person.artist_user_id) === Number(artist.user.id))
    : null;
  return { salonClient, salon, artistClient, artist, staff };
}

async function newClient(name = "Place Client") {
  const client = createClient();
  const user = await registerUser(client, { type: "client", name });
  return { client, user };
}

const book = (ctx, who, day, time, extra = {}) => who.post("/api/artist/bookings", {
  artistUserId: ctx.artist.user.id,
  service: "کوتاهی مو",
  bookingDate: day,
  time,
  ...extra
});

const hourOf = (hours, day) => hours.find((row) => norm(row.day) === norm(day));
const today = () => dateKeyAfter(0);
const putPlace = (ctx, salonId, startsOn = today(), moveBookings = false) => ctx.artistClient.put("/api/artist/place", { salonId, startsOn, moveBookings });
const getPlace = async (ctx) => (await ctx.artistClient.get("/api/artist/place")).payload.data.workplace;
const staffOf = async (ctx) => (await ctx.salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => Number(person.artist_user_id) === Number(ctx.artist.user.id));
const artistRows = async (ctx) => (await ctx.artistClient.get("/api/artist/me")).payload.data.bookings;
const rowOf = async (ctx, id) => (await artistRows(ctx)).find((item) => item.id === id);
const clientRow = async (client, id) => (await client.get("/api/artist-bookings")).payload.data.bookings.find((item) => item.id === id);
const confirm = (ctx, id) => ctx.artistClient.patch("/api/artist/me", { kind: "booking", id, status: "تایید شده" });

async function secondSalon(ctx, name = "Second Salon") {
  const client = createClient();
  const salon = await registerUser(client, { type: "salon", menu: true, name });
  await client.get("/api/salon-hours");
  expect((await joinSalonAsArtist(ctx.artistClient, client, salon.user.id)).ok).toBe(true);
  return { client, salon };
}

describe("where an artist's clients are received: one workplace at a time", () => {
  it("an artist on no team has no workplace, and books exactly as before", async () => {
    const ctx = await setup({ team: false });
    const place = await getPlace(ctx);
    expect(place).toMatchObject({ current: null, next: null, teams: [] });
    const page = (await createClient().get(`/api/artists/${ctx.artist.user.id}`)).payload.data.artist;
    expect(page.workplaces).toEqual([]);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "10:00");
    expect(made.ok).toBe(true);
    expect((await rowOf(ctx, made.payload.data.booking.id)).placeSalon).toBeNull();
  });

  it("joining a team changes nothing until the artist says yes: clients still come to the artist's own place", async () => {
    const ctx = await setup();
    const place = await getPlace(ctx);
    expect(place.current).toBeNull();
    expect(place.teams).toEqual([{ salonId: ctx.salon.user.id, name: ctx.salon.user.name, allowed: true, away: false, weekCount: 0 }]);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect((await rowOf(ctx, made.payload.data.booking.id)).placeSalon).toBeNull();
  });

  it("the switch is checked: only a salon they are on, a day from today to two months ahead, artists only", async () => {
    const ctx = await setup();
    const other = createClient();
    const foreign = await registerUser(other, { type: "salon", name: "Foreign Salon" });
    expect((await putPlace(ctx, foreign.user.id)).status).toBe(404);
    expect((await putPlace(ctx, ctx.salon.user.id, dateKeyAfter(-1))).status).toBe(400);
    expect((await putPlace(ctx, ctx.salon.user.id, dateKeyAfter(61))).status).toBe(400);
    expect((await putPlace(ctx, ctx.salon.user.id, "tomorrow")).status).toBe(400);
    const client = (await newClient()).client;
    expect((await client.get("/api/artist/place")).status).toBe(403);
    expect((await client.put("/api/artist/place", { salonId: ctx.salon.user.id })).status).toBe(403);
    expect((await createClient().get("/api/artist/place")).status).toBe(401);
    const saved = await putPlace(ctx, ctx.salon.user.id);
    expect(saved.ok).toBe(true);
    expect(saved.payload.data.workplace.current).toBe(ctx.salon.user.id);
  });

  it("at the salon: the page says where, offers only the salon's hours, and the server refuses the rest", async () => {
    const ctx = await setup();
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, openTime: "12:00", closeTime: "16:00" });
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    const page = (await createClient().get(`/api/artists/${ctx.artist.user.id}`)).payload.data.artist;
    expect(page.workplaces).toHaveLength(1);
    expect(page.workplaces[0].from).toBe(today());
    expect(page.workplaces[0].salon).toMatchObject({ id: ctx.salon.user.id, name: ctx.salon.user.name });
    expect(page.workplaces[0].salon.phone).toBeUndefined();
    expect(hourOf(page.workplaces[0].salon.hours, SATURDAY)).toMatchObject({ open_time: "۱۲:۰۰", close_time: "۱۶:۰۰" });
    const { client } = await newClient();
    const day = dayOn(SATURDAY);
    const inside = await book(ctx, client, day, "13:00");
    expect(inside.ok).toBe(true);
    expect((await rowOf(ctx, inside.payload.data.booking.id)).placeSalon).toMatchObject({ id: ctx.salon.user.id, name: ctx.salon.user.name });
    for (const time of ["10:00", "15:30"]) { // before it opens; a 60-minute visit ending after 16:00
      const refused = await book(ctx, client, day, time);
      expect(refused.status).toBe(409);
      expect(refused.payload.code).toBe("SALON_CLOSED");
    }
    // The artist's own entry for their own customer may still go anywhere in their hours; it is held at their own place.
    const own = await ctx.artistClient.post("/api/artist/bookings", { artistUserId: ctx.artist.user.id, service: "کوتاهی مو", bookingDate: day, time: "10:00", client: "Walk In" });
    expect(own.ok).toBe(true);
    expect((await rowOf(ctx, own.payload.data.booking.id)).placeSalon).toBeNull();
  });

  it("the client sees the salon from the start, before the artist answers", async () => {
    const ctx = await setup();
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "13:00");
    const row = await clientRow(client, made.payload.data.booking.id);
    expect(row.status).toBe("تازه");
    expect(row.placeSalonName).toBe(ctx.salon.user.name);
  });

  it("a switch for a later day: earlier bookings stay, later ones move when asked, and it can be cancelled", async () => {
    const ctx = await setup();
    const two = await secondSalon(ctx, "Nilufar Salon");
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    const { client } = await newClient();
    const before = await book(ctx, client, dayOn(SATURDAY, 0), "11:00");
    const after = await book(ctx, client, dayOn(SATURDAY, 1), "11:00");
    expect([before.ok, after.ok]).toEqual([true, true]);
    const from = dayOn(SATURDAY, 1);
    const moved = await putPlace(ctx, two.salon.user.id, from, true);
    expect(moved.ok).toBe(true);
    expect(moved.payload.data).toMatchObject({ moved: 1, kept: 0 });
    expect(moved.payload.data.workplace).toMatchObject({ current: ctx.salon.user.id, next: { from, salonId: two.salon.user.id } });
    expect((await rowOf(ctx, before.payload.data.booking.id)).placeSalon.id).toBe(ctx.salon.user.id);
    expect((await rowOf(ctx, after.payload.data.booking.id)).placeSalon.id).toBe(two.salon.user.id);
    const page = (await createClient().get(`/api/artists/${ctx.artist.user.id}`)).payload.data.artist;
    expect(page.workplaces.map((entry) => entry.salon?.id)).toEqual([ctx.salon.user.id, two.salon.user.id]);
    // A new booking on that later day goes to the new salon.
    const later = await book(ctx, client, dayOn(SATURDAY, 1), "14:00");
    expect((await rowOf(ctx, later.payload.data.booking.id)).placeSalon.id).toBe(two.salon.user.id);
    // Cancelled: the first salon again from that day on; nothing already booked moves.
    const cancelled = await putPlace(ctx, ctx.salon.user.id, from, false);
    expect(cancelled.payload.data.workplace.next).toBeNull();
    expect((await rowOf(ctx, later.payload.data.booking.id)).placeSalon.id).toBe(two.salon.user.id);
  });

  it("moving bookings never sends one to a salon that is closed at its hour", async () => {
    const ctx = await setup();
    const two = await secondSalon(ctx, "Short Salon");
    await two.client.patch("/api/salon-hours", { day: SATURDAY, openTime: "14:00", closeTime: "18:00" });
    const { client } = await newClient();
    const early = await book(ctx, client, dayOn(SATURDAY), "10:00");
    const late = await book(ctx, client, dayOn(SATURDAY), "15:00");
    const result = await putPlace(ctx, two.salon.user.id, today(), true);
    expect(result.payload.data).toMatchObject({ moved: 1, kept: 1 });
    expect((await rowOf(ctx, early.payload.data.booking.id)).placeSalon).toBeNull();
    expect((await rowOf(ctx, late.payload.data.booking.id)).placeSalon.id).toBe(two.salon.user.id);
    const refused = await ctx.artistClient.put(`/api/artist-bookings/${early.payload.data.booking.id}/place`, { salonUserId: two.salon.user.id });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("SALON_CLOSED");
  });

  it("back to the artist's own place: bookings come back with them when asked", async () => {
    const ctx = await setup();
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect((await rowOf(ctx, made.payload.data.booking.id)).placeSalon.id).toBe(ctx.salon.user.id);
    const back = await putPlace(ctx, null, today(), true);
    expect(back.payload.data).toMatchObject({ moved: 1 });
    expect(back.payload.data.workplace.current).toBeNull();
    expect((await rowOf(ctx, made.payload.data.booking.id)).placeSalon).toBeNull();
    expect((await clientRow(client, made.payload.data.booking.id)).placeSalonName).toBe("");
  });

  it("the salon can close it: new clients go to the artist's own place until it opens again", async () => {
    const ctx = await setup();
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    const staff = await staffOf(ctx);
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: staff.id, directAllowed: false })).ok).toBe(true);
    const place = await getPlace(ctx);
    expect(place).toMatchObject({ current: null, savedCurrent: ctx.salon.user.id });
    expect(place.teams[0].allowed).toBe(false);
    expect((await putPlace(ctx, ctx.salon.user.id)).payload.code).toBe("SALON_BLOCKED");
    const { client } = await newClient();
    const closed = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect((await rowOf(ctx, closed.payload.data.booking.id)).placeSalon).toBeNull();
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: staff.id, directAllowed: true })).ok).toBe(true);
    const open = await book(ctx, client, dayOn(SATURDAY), "13:00");
    expect((await rowOf(ctx, open.payload.data.booking.id)).placeSalon.id).toBe(ctx.salon.user.id);
  });

  it("a member on leave: their clients go to their own place; back on duty, to the salon again", async () => {
    const ctx = await setup();
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    const staff = await staffOf(ctx);
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: staff.id, state: "مرخصی" })).ok).toBe(true);
    const { client } = await newClient();
    const away = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect((await rowOf(ctx, away.payload.data.booking.id)).placeSalon).toBeNull();
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: staff.id, state: "فعال" })).ok).toBe(true);
    const back = await book(ctx, client, dayOn(SATURDAY), "13:00");
    expect((await rowOf(ctx, back.payload.data.booking.id)).placeSalon.id).toBe(ctx.salon.user.id);
  });

  it("a direct booking and a salon booking share the artist's calendar; two clients at once: one gets it", async () => {
    const ctx = await setup();
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    const day = dayOn(SATURDAY);
    const { client } = await newClient();
    expect((await book(ctx, client, day, "11:00")).ok).toBe(true);
    const clash = await book(ctx, (await newClient("Other")).client, day, "11:30");
    expect(clash.status).toBe(409);
    expect(clash.payload.code).toBe("SLOT_TAKEN");
    const clients = await Promise.all([newClient("R1"), newClient("R2"), newClient("R3")]);
    const results = await Promise.all(clients.map((item) => book(ctx, item.client, day, "14:00")));
    expect(results.filter((item) => item.ok)).toHaveLength(1);
    expect(results.filter((item) => item.status === 409)).toHaveLength(2);
  });

  it("the salon's day list: its member's clients here with a first name only, and the member's hours elsewhere as busy", async () => {
    const ctx = await setup();
    const { client: atSalon } = await newClient("Maryam Rezaei");
    const { client: atOwn } = await newClient("Sara Ahmadi");
    const day = dayOn(SATURDAY);
    expect((await book(ctx, atOwn, day, "10:00")).ok).toBe(true);
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    expect((await book(ctx, atSalon, day, "12:00")).ok).toBe(true);
    const direct = await ctx.salonClient.get("/api/salon-staff/direct");
    expect(direct.ok).toBe(true);
    const { visits, busy } = direct.payload.data;
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({ clientFirstName: "Maryam", date: day, minutes: 60 });
    expect(Object.keys(visits[0]).sort()).toEqual(["artistName", "clientFirstName", "date", "id", "minutes", "service", "time"]);
    expect(JSON.stringify(direct.payload)).not.toContain("Rezaei");
    expect(busy).toHaveLength(1);
    expect(Object.keys(busy[0]).sort()).toEqual(["artistName", "date", "id", "minutes", "time"]);
    expect(JSON.stringify(busy)).not.toContain("Sara");
    expect((await atSalon.get("/api/salon-staff/direct")).status).toBe(403);
    // Another salon sees nothing of this member.
    const stranger = createClient();
    await registerUser(stranger, { type: "salon", name: "Stranger Salon" });
    expect((await stranger.get("/api/salon-staff/direct")).payload.data).toEqual({ visits: [], busy: [] });
  });

  it("an artist leaving the team: clients go to their own place from today, later switches to it are dropped", async () => {
    const ctx = await setup();
    const two = await secondSalon(ctx, "Later Salon");
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    expect((await putPlace(ctx, two.salon.user.id, dayOn(SATURDAY, 1))).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY, 0), "10:00");
    expect((await ctx.artistClient.delete("/api/artist/teams", { salonUserId: ctx.salon.user.id })).ok).toBe(true);
    const row = await clientRow(client, made.payload.data.booking.id);
    expect(row.status).not.toBe("لغو");
    expect(row.placeSalonName).toBe("");
    expect(await getPlace(ctx)).toMatchObject({ current: null, next: { salonId: two.salon.user.id } });
    expect((await two.client.delete("/api/salon-staff", { id: (await two.client.get("/api/salon-staff")).payload.data.staff.find((p) => Number(p.artist_user_id) === Number(ctx.artist.user.id)).id })).ok).toBe(true);
    expect(await getPlace(ctx)).toMatchObject({ current: null, next: null, teams: [] });
    expect((await createClient().get(`/api/artists/${ctx.artist.user.id}`)).payload.data.artist.workplaces).toEqual([{ from: today(), salon: null }]);
  });

  it("a salon leaving frfro hands the bookings back to the artist's own place", async () => {
    const ctx = await setup();
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    const { client } = await newClient();
    const kept = await book(ctx, client, dayOn(SATURDAY, 2), "10:00");
    expect((await ctx.salonClient.delete("/api/profile", { currentPassword: "testpass123", cancelAll: true })).ok).toBe(true);
    const gone = await clientRow(client, kept.payload.data.booking.id);
    expect(gone.status).not.toBe("لغو");
    expect(gone.placeSalonName).toBe("");
    expect((await getPlace(ctx)).current).toBeNull();
  });
});

describe("where the client is told to go: the artist's own spot, or the salon's when it is held there", () => {
  const SALON_SPOT = { area: "تهران، خیابان گلستان", addressDetail: "پلاک ۱۲", geo: { lat: 35.7219, lng: 51.3347 } };
  const OWN_SPOT = { area: "تهران، خیابان لاله", addressDetail: "واحد ۳", geo: { lat: 35.7007, lng: 51.4041 } };

  it("a booking shows the salon's pin when it is held there, and the artist's own pin otherwise", async () => {
    const ctx = await setup();
    expect((await ctx.salonClient.post("/api/profile", { data: SALON_SPOT })).ok).toBe(true);
    expect((await ctx.artistClient.post("/api/profile", { data: OWN_SPOT })).ok).toBe(true);
    const { client } = await newClient();
    const atOwn = await book(ctx, client, dayOn(SUNDAY), "13:00");
    expect((await putPlace(ctx, ctx.salon.user.id)).ok).toBe(true);
    const atSalon = await book(ctx, client, dayOn(SATURDAY), "13:00");
    const page = (await createClient().get(`/api/artists/${ctx.artist.user.id}`)).payload.data.artist;
    expect(page.workplaces[0].salon.location).toMatchObject({ address: SALON_SPOT.area, lat: 35.7219, lng: 51.3347 });
    expect((await confirm(ctx, atSalon.payload.data.booking.id)).ok).toBe(true);
    expect((await confirm(ctx, atOwn.payload.data.booking.id)).ok).toBe(true);
    const salonRow = await clientRow(client, atSalon.payload.data.booking.id);
    expect(salonRow.placeLocation).toMatchObject({ address: SALON_SPOT.area, detail: SALON_SPOT.addressDetail, lat: 35.7219, lng: 51.3347 });
    expect(salonRow.placeSalonName).toBe(ctx.salon.user.name);
    const ownRow = await clientRow(client, atOwn.payload.data.booking.id);
    expect(ownRow.placeLocation).toMatchObject({ address: OWN_SPOT.area, lat: 35.7007, lng: 51.4041 });
    expect(ownRow.placeSalonName).toBe("");
  });

  it("a saved spot survives profile edits, settings saves and a new login", async () => {
    const ctx = await setup({ team: false });
    expect((await ctx.artistClient.post("/api/profile", { data: OWN_SPOT })).ok).toBe(true);
    const spot = async () => (await ctx.artistClient.get("/api/auth/me")).payload.data.user.location;
    expect(await spot()).toMatchObject({ address: OWN_SPOT.area, detail: OWN_SPOT.addressDetail, lat: 35.7007, lng: 51.4041 });
    expect((await ctx.artistClient.post("/api/profile", { type: "artist", data: { name: ctx.artist.user.name, service: "ناخن", email: "" } })).ok).toBe(true);
    expect((await ctx.artistClient.post("/api/profile/settings", { settings: { vacationMode: false, autoConfirm: true } })).ok).toBe(true);
    expect((await ctx.artistClient.post("/api/artist/me", { name: "کاشت ناخن", price: "800000", duration: "۹۰ دقیقه" })).ok).toBe(true);
    expect(await spot()).toMatchObject({ address: OWN_SPOT.area, lat: 35.7007, lng: 51.4041 });
    const again = createClient();
    expect((await again.post("/api/auth/login", { phone: ctx.artist.phone, password: ctx.artist.password })).ok).toBe(true);
    expect((await again.get("/api/auth/me")).payload.data.user.location).toMatchObject({ lat: 35.7007, lng: 51.4041 });
    // Only an explicit clear removes it.
    expect((await ctx.artistClient.post("/api/profile", { data: { area: "", geo: null, addressDetail: "" } })).ok).toBe(true);
    expect(await spot()).toBeNull();
  });
});
