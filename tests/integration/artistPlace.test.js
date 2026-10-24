import { describe, it, expect } from "vitest";
import { createClient, joinSalonAsArtist, registerUser } from "./helpers.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

// Owner's idea of 2026-10-24 (second version): an artist on salon teams keeps an ordered list of their salons. A client only
// picks a day and an hour; the booking goes to the first salon in the list that can take it, else «مثل قبل» (or waits for
// the artist). These tests drive the real server.

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
const MONDAY = "دوشنبه";
const FRIDAY = "جمعه";

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
const putList = (ctx, order, fallback = "own") => ctx.artistClient.put("/api/artist/place", { order, fallback });
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

describe("where an artist's clients are received: an ordered list of salons", () => {
  it("an artist on no team has no list, and books exactly as before", async () => {
    const ctx = await setup({ team: false });
    const place = await ctx.artistClient.get("/api/artist/place");
    expect(place.status).toBe(200);
    expect(place.payload.data.place.teams).toEqual([]);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "10:00");
    expect(made.ok).toBe(true);
    expect((await rowOf(ctx, made.payload.data.booking.id)).placeSalon).toBeNull();
  });

  it("nothing changes until the artist adds a salon: the salon is on offer, not in the list", async () => {
    const ctx = await setup();
    const place = (await ctx.artistClient.get("/api/artist/place")).payload.data.place;
    expect(place.fallback).toBe("own");
    expect(place.teams).toHaveLength(1);
    expect(place.teams[0]).toMatchObject({ salonId: ctx.salon.user.id, name: ctx.salon.user.name, inList: false, allowed: true, note: "" });
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect(made.ok).toBe(true);
    expect((await rowOf(ctx, made.payload.data.booking.id)).placeSalon).toBeNull();
  });

  it("the list is checked: only salons they are on, a known fallback, a real list", async () => {
    const ctx = await setup();
    expect((await putList(ctx, [ctx.salon.user.id], "sometimes")).status).toBe(400);
    expect((await ctx.artistClient.put("/api/artist/place", { order: "x", fallback: "own" })).status).toBe(400);
    const other = createClient();
    const foreign = await registerUser(other, { type: "salon", name: "Foreign Salon" });
    expect((await putList(ctx, [foreign.user.id])).status).toBe(404);
    const client = (await newClient()).client;
    expect((await client.get("/api/artist/place")).status).toBe(403);
    expect((await createClient().get("/api/artist/place")).status).toBe(401);
    const saved = await putList(ctx, [ctx.salon.user.id, ctx.salon.user.id], "ask");
    expect(saved.ok).toBe(true);
    expect(saved.payload.data.place.teams[0]).toMatchObject({ inList: true, position: 0 });
    expect(saved.payload.data.place.fallback).toBe("ask");
  });

  it("the client is never refused or told about places: any hour in the artist's own hours is bookable", async () => {
    const ctx = await setup();
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, openTime: "12:00", closeTime: "16:00" });
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const page = (await createClient().get(`/api/artists/${ctx.artist.user.id}`)).payload.data.artist;
    expect(page.team).toBeUndefined();
    expect(page.placeDays).toBeUndefined();
    expect(hourOf(page.hours, SATURDAY)).toMatchObject({ open_time: "۱۰:۰۰", close_time: "۲۰:۰۰" });
    const { client } = await newClient();
    expect((await book(ctx, client, dayOn(SATURDAY), "10:00")).ok).toBe(true);
    expect((await book(ctx, client, dayOn(SATURDAY), "19:00")).ok).toBe(true);
  });

  it("the first salon that can take the booking gets it; the hours decide, not the client", async () => {
    const ctx = await setup();
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, openTime: "12:00", closeTime: "16:00" });
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const { client } = await newClient();
    const day = dayOn(SATURDAY);
    const early = await book(ctx, client, day, "10:00");
    const inside = await book(ctx, client, day, "13:00");
    const late = await book(ctx, client, day, "15:30"); // a 60-minute visit would end after 16:00
    expect([early.ok, inside.ok, late.ok]).toEqual([true, true, true]);
    expect((await rowOf(ctx, early.payload.data.booking.id)).placeSalon).toBeNull();
    expect((await rowOf(ctx, inside.payload.data.booking.id)).placeSalon).toMatchObject({ id: ctx.salon.user.id, name: ctx.salon.user.name });
    expect((await rowOf(ctx, late.payload.data.booking.id)).placeSalon).toBeNull();
  });

  it("two salons: the next one takes it when the first is closed, full or switched off", async () => {
    const ctx = await setup();
    const second = await secondSalon(ctx);
    expect((await putList(ctx, [ctx.salon.user.id, second.salon.user.id])).ok).toBe(true);
    const { client } = await newClient();
    const day = dayOn(SATURDAY);
    const first = await book(ctx, client, day, "10:00");
    expect((await rowOf(ctx, first.payload.data.booking.id)).placeSalon.id).toBe(ctx.salon.user.id);

    // The first salon is closed that day.
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, active: false });
    const other = (await newClient("Other One")).client;
    const closed = await book(ctx, other, day, "12:00");
    expect((await rowOf(ctx, closed.payload.data.booking.id)).placeSalon.id).toBe(second.salon.user.id);

    // Open again, but full (one place a day, already used by the first booking).
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, active: true, capacity: 1 });
    const full = await book(ctx, other, day, "14:00");
    expect((await rowOf(ctx, full.payload.data.booking.id)).placeSalon.id).toBe(second.salon.user.id);

    // Capacity back up, but the salon switched «نوبت مستقیم» off for this artist.
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, capacity: 8 });
    const staff = (await ctx.salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => Number(person.artist_user_id) === Number(ctx.artist.user.id));
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: staff.id, directAllowed: false })).ok).toBe(true);
    const third = (await newClient("Other Two")).client;
    const blocked = await book(ctx, third, day, "16:00");
    expect((await rowOf(ctx, blocked.payload.data.booking.id)).placeSalon.id).toBe(second.salon.user.id);
    const place = (await ctx.artistClient.get("/api/artist/place")).payload.data.place;
    expect(place.teams.find((team) => team.salonId === ctx.salon.user.id).note).toBe(`${ctx.salon.user.name} نوبت مستقیم رو بسته. نوبتی اونجا نمی‌افته.`);
    // What was already booked at the first salon stays there.
    expect((await rowOf(ctx, first.payload.data.booking.id)).placeSalon.id).toBe(ctx.salon.user.id);
  });

  it("when no salon can: «مثل قبل» holds it at the artist's own place and never refuses", async () => {
    const ctx = await setup();
    expect((await putList(ctx, [ctx.salon.user.id], "own")).ok).toBe(true);
    expect((await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, active: false })).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect(made.ok).toBe(true);
    expect((await rowOf(ctx, made.payload.data.booking.id)).placeSalon).toBeNull();
  });

  it("when no salon can and the artist wants to say: the booking waits for them, even with auto-confirm", async () => {
    const ctx = await setup();
    expect((await ctx.artistClient.post("/api/profile/settings", { settings: { autoConfirm: true } })).ok).toBe(true);
    expect((await putList(ctx, [ctx.salon.user.id], "ask")).ok).toBe(true);
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, active: false });
    const { client } = await newClient();
    const waiting = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect(waiting.status).toBe(201);
    expect(waiting.payload.data.booking.status).toBe("تازه");
    // A salon that can take it still confirms at once.
    const fits = await book(ctx, client, dayOn(SUNDAY), "11:00");
    expect(fits.payload.data.booking.status).toBe("تایید شده");
    expect((await rowOf(ctx, fits.payload.data.booking.id)).placeSalon.id).toBe(ctx.salon.user.id);
  });

  it("the client reads the salon only once the booking is confirmed", async () => {
    const ctx = await setup();
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "11:00");
    const before = await clientRow(client, made.payload.data.booking.id);
    expect(before.placeSalonName).toBe("");
    expect((await confirm(ctx, made.payload.data.booking.id)).ok).toBe(true);
    const after = await clientRow(client, made.payload.data.booking.id);
    expect(after.placeSalonName).toBe(ctx.salon.user.name);
    expect(Number(after.placeSalonUserId)).toBe(ctx.salon.user.id);
    expect(after.salonName).toBe(ctx.artist.user.name);
  });

  it("the artist says where one booking is held: another salon, or back to «مثل قبل»", async () => {
    const ctx = await setup();
    const second = await secondSalon(ctx);
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "11:00");
    const id = made.payload.data.booking.id;
    expect((await confirm(ctx, id)).ok).toBe(true);

    const moved = await ctx.artistClient.put(`/api/artist-bookings/${id}/place`, { salonUserId: second.salon.user.id });
    expect(moved.ok).toBe(true);
    expect((await rowOf(ctx, id)).placeSalon.id).toBe(second.salon.user.id);
    expect((await clientRow(client, id)).placeSalonName).toBe(second.salon.user.name);

    expect((await ctx.artistClient.put(`/api/artist-bookings/${id}/place`, { salonUserId: null })).ok).toBe(true);
    expect((await rowOf(ctx, id)).placeSalon).toBeNull();
    expect((await clientRow(client, id)).placeSalonName).toBe("");

    // Not a salon of theirs, not their booking, not a booking any more.
    const other = createClient();
    const foreign = await registerUser(other, { type: "salon", name: "Foreign Two" });
    expect((await ctx.artistClient.put(`/api/artist-bookings/${id}/place`, { salonUserId: foreign.user.id })).status).toBe(409);
    expect((await client.put(`/api/artist-bookings/${id}/place`, { salonUserId: null })).status).toBe(403);
    const stranger = createClient();
    await registerUser(stranger, { type: "artist", menu: true, name: "Not Theirs" });
    expect((await stranger.put(`/api/artist-bookings/${id}/place`, { salonUserId: null })).status).toBe(404);
    await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id, status: "لغو" });
    expect((await ctx.artistClient.put(`/api/artist-bookings/${id}/place`, { salonUserId: null })).status).toBe(409);
  });

  it("a salon that switched direct bookings off cannot be picked for a booking", async () => {
    const ctx = await setup();
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "11:00");
    const staff = (await ctx.salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => Number(person.artist_user_id) === Number(ctx.artist.user.id));
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: staff.id, directAllowed: false })).ok).toBe(true);
    const refused = await ctx.artistClient.put(`/api/artist-bookings/${made.payload.data.booking.id}/place`, { salonUserId: ctx.salon.user.id });
    expect(refused.status).toBe(409);
    expect(refused.payload.code).toBe("SALON_BLOCKED");
  });

  it("a member on leave is skipped; back on duty the salon takes bookings again", async () => {
    const ctx = await setup();
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const staff = (await ctx.salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => Number(person.artist_user_id) === Number(ctx.artist.user.id));
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: staff.id, state: "مرخصی" })).ok).toBe(true);
    const { client } = await newClient();
    const away = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect((await rowOf(ctx, away.payload.data.booking.id)).placeSalon).toBeNull();
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: staff.id, state: "فعال" })).ok).toBe(true);
    const back = await book(ctx, client, dayOn(SATURDAY), "13:00");
    expect((await rowOf(ctx, back.payload.data.booking.id)).placeSalon.id).toBe(ctx.salon.user.id);
  });

  it("a direct booking and a salon booking share the artist's calendar", async () => {
    const ctx = await setup();
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const { client } = await newClient();
    const day = dayOn(SATURDAY);
    expect((await book(ctx, client, day, "11:00")).ok).toBe(true);
    const other = (await newClient("Other")).client;
    const clash = await book(ctx, other, day, "11:30");
    expect(clash.status).toBe(409);
    expect(clash.payload.code).toBe("SLOT_TAKEN");
  });

  it("two clients at the same hour: one gets it, the others are told it was just taken", async () => {
    const ctx = await setup();
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const day = dayOn(SATURDAY);
    const clients = await Promise.all([newClient("R1"), newClient("R2"), newClient("R3")]);
    const results = await Promise.all(clients.map(({ client }) => book(ctx, client, day, "14:00")));
    expect(results.filter((item) => item.ok)).toHaveLength(1);
    expect(results.filter((item) => item.status === 409)).toHaveLength(2);
  });

  it("the salon sees how many clients its member brings, never who they are", async () => {
    const ctx = await setup();
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const a = await newClient("Brought A");
    const b = await newClient("Brought B");
    const day = dayOn(SATURDAY);
    expect((await book(ctx, a.client, day, "10:00")).ok).toBe(true);
    expect((await book(ctx, b.client, day, "12:00")).ok).toBe(true);
    expect((await a.client.post("/api/follows", { targetUserId: ctx.salon.user.id })).ok).toBe(true);
    const staff = (await ctx.salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => Number(person.artist_user_id) === Number(ctx.artist.user.id));
    expect(staff.direct_stats).toMatchObject({ live: 2, clientsThisMonth: 2, connected: 1 });
    const direct = await ctx.salonClient.get("/api/salon-staff/direct");
    expect(direct.ok).toBe(true);
    const visits = direct.payload.data.visits;
    expect(visits).toHaveLength(2);
    expect(Object.keys(visits[0]).sort()).toEqual(["artistName", "date", "id", "minutes", "service", "time"]);
    expect(JSON.stringify(visits)).not.toContain("Brought");
    expect((await a.client.get("/api/salon-staff/direct")).status).toBe(403);
  });

  it("an artist leaving a team keeps every booking at their own place, and the salon leaves their list", async () => {
    const ctx = await setup();
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY, 2), "10:00");
    expect(made.ok).toBe(true);
    expect((await ctx.artistClient.delete("/api/artist/teams", { salonUserId: ctx.salon.user.id })).ok).toBe(true);
    const row = await clientRow(client, made.payload.data.booking.id);
    expect(row.status).not.toBe("لغو");
    expect(row.placeSalonName).toBe("");
    expect((await ctx.artistClient.get("/api/artist/place")).payload.data.place.teams).toEqual([]);
    // Joining again: on offer, not in the list.
    expect((await joinSalonAsArtist(ctx.artistClient, ctx.salonClient, ctx.salon.user.id)).ok).toBe(true);
    expect((await ctx.artistClient.get("/api/artist/place")).payload.data.place.teams[0].inList).toBe(false);
  });

  it("a salon removing the member, or leaving frfro, hands the bookings back to the artist's own place", async () => {
    const ctx = await setup();
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY, 2), "10:00");
    const staff = (await ctx.salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => Number(person.artist_user_id) === Number(ctx.artist.user.id));
    expect((await ctx.salonClient.delete("/api/salon-staff", { id: staff.id })).ok).toBe(true);
    const row = await clientRow(client, made.payload.data.booking.id);
    expect(row.status).not.toBe("لغو");
    expect(row.placeSalonName).toBe("");

    const again = await setup();
    expect((await putList(again, [again.salon.user.id])).ok).toBe(true);
    const second = await newClient();
    const kept = await book(again, second.client, dayOn(SATURDAY, 2), "10:00");
    expect((await again.salonClient.delete("/api/profile", { currentPassword: "testpass123", cancelAll: true })).ok).toBe(true);
    const gone = await clientRow(second.client, kept.payload.data.booking.id);
    expect(gone.status).not.toBe("لغو");
    expect(gone.placeSalonName).toBe("");
  });
});

describe("where the client is told to go: the artist's own spot, or the salon's once it is held there", () => {
  const SALON_SPOT = { area: "تهران، خیابان گلستان", addressDetail: "پلاک ۱۲", geo: { lat: 35.7219, lng: 51.3347 } };
  const OWN_SPOT = { area: "تهران، خیابان لاله", addressDetail: "واحد ۳", geo: { lat: 35.7007, lng: 51.4041 } };

  it("a confirmed booking shows the salon's pin when it is held there, and the artist's own pin otherwise", async () => {
    const ctx = await setup();
    expect((await ctx.salonClient.post("/api/profile", { data: SALON_SPOT })).ok).toBe(true);
    expect((await ctx.artistClient.post("/api/profile", { data: OWN_SPOT })).ok).toBe(true);
    expect((await putList(ctx, [ctx.salon.user.id])).ok).toBe(true);
    const { client } = await newClient();
    const atSalon = await book(ctx, client, dayOn(SATURDAY), "13:00");
    await ctx.salonClient.patch("/api/salon-hours", { day: SUNDAY, active: false });
    const atOwn = await book(ctx, client, dayOn(SUNDAY), "13:00");
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
