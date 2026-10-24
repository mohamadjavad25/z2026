import { describe, it, expect } from "vitest";
import { createClient, joinSalonAsArtist, registerUser } from "./helpers.js";
import { formatPersianDateKey, getPersianWeekday } from "../../app/shared/lib/persianCalendar.js";

// Owner's idea of 2026-10-24: an artist on a salon team chooses where the clients who book them directly are received
// (their own place, the salon, or a place per weekday) and the salon keeps one switch. These tests drive the real server.

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

const choose = (ctx, mode, days) => ctx.artistClient.put("/api/artist/place", { mode, days });

const publicArtist = async (ctx) => (await createClient().get(`/api/artists/${ctx.artist.user.id}`)).payload.data.artist;
const hourOf = (hours, day) => hours.find((row) => norm(row.day) === norm(day));

describe("where an artist on a salon team receives the clients who book them directly", () => {
  it("an artist on no team has nothing to choose, and books as before", async () => {
    const ctx = await setup({ team: false });
    const place = await ctx.artistClient.get("/api/artist/place");
    expect(place.status).toBe(200);
    expect(place.payload.data.place).toBeNull();
    const { client } = await newClient();
    expect((await book(ctx, client, dayOn(SATURDAY), "10:00")).ok).toBe(true);
    expect((await publicArtist(ctx)).team).toBeNull();
  });

  it("nothing changes until the artist chooses: their own place, the whole of their own hours, no salon on the page", async () => {
    const ctx = await setup();
    const place = (await ctx.artistClient.get("/api/artist/place")).payload.data.place;
    expect(place).toMatchObject({ mode: "own", allowed: true, salonName: ctx.salon.user.name });
    const { client } = await newClient();
    const day = dayOn(SATURDAY);
    const made = await book(ctx, client, day, "19:00");
    expect(made.ok).toBe(true);
    const mine = (await client.get("/api/artist-bookings")).payload.data.bookings.find((item) => item.id === made.payload.data.booking.id);
    expect(mine.placeSalonName || "").toBe("");
    const page = await publicArtist(ctx);
    expect(page.team).toBeNull();
    expect(page.placeDays).toBeNull();
  });

  it("the artist's choice needs a valid mode and days, and a team they are really on", async () => {
    const ctx = await setup();
    const bad = await choose(ctx, "everywhere");
    expect(bad.status).toBe(400);
    const badDays = await choose(ctx, "days", "sosoo");
    expect(badDays.status).toBe(400);
    const stranger = createClient();
    await registerUser(stranger, { type: "artist", menu: true, name: "Lone Artist" });
    const none = await stranger.put("/api/artist/place", { mode: "salon" });
    expect(none.status).toBe(404);
    const client = (await newClient()).client;
    expect((await client.get("/api/artist/place")).status).toBe(403);
    expect((await createClient().get("/api/artist/place")).status).toBe(401);
  });

  it("«توی سالن»: the page names the salon, the hours are the ones both are open, the booking is held at the salon", async () => {
    const ctx = await setup();
    // Salon works 12:00-16:00 on Saturday; the artist's own hours stay 10:00-20:00.
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, openTime: "12:00", closeTime: "16:00" });
    expect((await choose(ctx, "salon")).ok).toBe(true);

    const page = await publicArtist(ctx);
    expect(page.team).toMatchObject({ salonId: ctx.salon.user.id, name: ctx.salon.user.name });
    const saturday = hourOf(page.hours, SATURDAY);
    expect(saturday).toMatchObject({ open_time: "۱۲:۰۰", close_time: "۱۶:۰۰", active: true });
    expect(page.placeDays.find((row) => norm(row.day) === norm(SATURDAY)).kind).toBe("salon");
    // Friday: the artist does not work it.
    expect(hourOf(page.hours, FRIDAY).active).toBe(false);

    const { client, user } = await newClient();
    const day = dayOn(SATURDAY);
    const early = await book(ctx, client, day, "10:00");
    expect(early.status).toBe(409);
    expect(early.payload.error).toBe(`${ctx.salon.user.name} از ساعت ۱۲:۰۰ باز می‌شه. یکی از ساعت‌های فهرست رو بزن.`);
    const late = await book(ctx, client, day, "16:00");
    expect(late.status).toBe(409);
    expect(late.payload.error).toBe(`${ctx.salon.user.name} ساعت ۱۶:۰۰ می‌بنده. یکی از ساعت‌های فهرست رو بزن.`);
    const ok = await book(ctx, client, day, "13:00");
    expect(ok.ok).toBe(true);
    const row = (await client.get("/api/artist-bookings")).payload.data.bookings.find((item) => item.id === ok.payload.data.booking.id);
    expect(row.placeSalonName).toBe(ctx.salon.user.name);
    expect(Number(row.placeSalonUserId)).toBe(ctx.salon.user.id);
    expect(row.salonName).toBe(ctx.artist.user.name);
    expect(user.user.id).toBeTruthy();
  });

  it("«جای خودم»: the artist's own hours apply even though they are on a team", async () => {
    const ctx = await setup();
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, openTime: "12:00", closeTime: "16:00" });
    expect((await choose(ctx, "own")).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY), "10:00");
    expect(made.ok).toBe(true);
    expect(made.payload.data.booking.place_salon_user_id ?? null).toBeNull();
  });

  it("«هر روز یه جا»: each weekday has its own place and the booking remembers it", async () => {
    const ctx = await setup();
    // شنبه سالن، یکشنبه خودم، دوشنبه سالن، بقیه خودم.
    expect((await choose(ctx, "days", "sosoooo")).ok).toBe(true);
    const page = await publicArtist(ctx);
    const kinds = Object.fromEntries(page.placeDays.map((row) => [norm(row.day), row.kind]));
    expect(kinds[norm(SATURDAY)]).toBe("salon");
    expect(kinds[norm(SUNDAY)]).toBe("own");
    expect(kinds[norm(MONDAY)]).toBe("salon");
    const { client } = await newClient();
    const atSalon = await book(ctx, client, dayOn(SATURDAY), "10:00");
    const atOwn = await book(ctx, client, dayOn(SUNDAY), "10:00");
    expect(atSalon.ok && atOwn.ok).toBe(true);
    const list = (await client.get("/api/artist-bookings")).payload.data.bookings;
    expect(list.find((item) => item.id === atSalon.payload.data.booking.id).placeSalonName).toBe(ctx.salon.user.name);
    expect(list.find((item) => item.id === atOwn.payload.data.booking.id).placeSalonName).toBe("");
  });

  it("a day the salon is closed refuses a booking in plain words, and shows as closed on the page", async () => {
    const ctx = await setup();
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, active: false });
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const page = await publicArtist(ctx);
    expect(hourOf(page.hours, SATURDAY).active).toBe(false);
    expect(page.placeDays.find((row) => norm(row.day) === norm(SATURDAY)).kind).toBe("closed");
    const { client } = await newClient();
    const refused = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect(refused.status).toBe(409);
    expect(refused.payload.error).toBe("این روز سالن تعطیله. روز دیگه‌ای انتخاب کن.");
    // The same artist's other days still work.
    expect((await book(ctx, client, dayOn(SUNDAY), "11:00")).ok).toBe(true);
  });

  it("the salon's switch: off closes the salon days for new clients, keeps what was booked, and the artist is told no", async () => {
    const ctx = await setup();
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const { client } = await newClient();
    const before = await book(ctx, client, dayOn(SATURDAY), "10:00");
    expect(before.ok).toBe(true);

    const off = await ctx.salonClient.patch("/api/salon-staff", { id: ctx.staff.id, directAllowed: false });
    expect(off.ok).toBe(true);
    expect(off.payload.data.staff.find((person) => person.id === ctx.staff.id).direct_allowed).toBe(false);

    const second = (await newClient("Second")).client;
    const refused = await book(ctx, second, dayOn(SATURDAY), "12:00");
    expect(refused.status).toBe(409);
    expect(refused.payload.error).toBe(`${ctx.salon.user.name} نوبت مستقیم رو بسته. از خود سالن رزرو کن.`);
    const page = await publicArtist(ctx);
    expect(page.placeDays.find((row) => norm(row.day) === norm(SATURDAY)).kind).toBe("blocked");
    // What was booked stays.
    const stays = (await client.get("/api/artist-bookings")).payload.data.bookings.find((item) => item.id === before.payload.data.booking.id);
    expect(stays.status).not.toBe("لغو");
    expect(stays.placeSalonName).toBe(ctx.salon.user.name);

    // The artist cannot pick the salon again while it is closed to them, but their own place is always theirs.
    const again = await choose(ctx, "salon");
    expect(again.status).toBe(409);
    expect(again.payload.error).toBe(`${ctx.salon.user.name} نوبت مستقیم توی سالن رو بسته. با سالن هماهنگ کن.`);
    expect((await ctx.artistClient.get("/api/artist/place")).payload.data.place.allowed).toBe(false);
    expect((await choose(ctx, "own")).ok).toBe(true);
    expect((await book(ctx, second, dayOn(SATURDAY), "12:00")).ok).toBe(true);

    // Switched back on: the salon days open again.
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: ctx.staff.id, directAllowed: true })).ok).toBe(true);
    expect((await choose(ctx, "salon")).ok).toBe(true);
    expect((await book(ctx, second, dayOn(SATURDAY, 1), "12:00")).ok).toBe(true);
  });

  it("a member on leave or switched off in the team is not at the salon: the salon days refuse, the artist's own days work", async () => {
    const ctx = await setup();
    expect((await choose(ctx, "days", "soooooo")).ok).toBe(true);
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: ctx.staff.id, state: "مرخصی" })).ok).toBe(true);
    const { client } = await newClient();
    const refused = await book(ctx, client, dayOn(SATURDAY), "11:00");
    expect(refused.status).toBe(409);
    expect(refused.payload.error).toBe(`${ctx.artist.user.name} این روز توی ${ctx.salon.user.name} نیست. روز دیگه‌ای انتخاب کن.`);
    expect((await book(ctx, client, dayOn(SUNDAY), "11:00")).ok).toBe(true);
    expect((await ctx.salonClient.patch("/api/salon-staff", { id: ctx.staff.id, state: "فعال" })).ok).toBe(true);
    expect((await book(ctx, client, dayOn(SATURDAY), "11:00")).ok).toBe(true);
  });

  it("the artist's own entry for a walk-in on a salon day is never refused, and is held at the salon", async () => {
    const ctx = await setup();
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, active: false });
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const own = await ctx.artistClient.post("/api/artist/me", {
      kind: "booking", service: "کوتاهی مو", bookingDate: dayOn(SATURDAY), time: "18:00", client: "حضوری", phone: "09120000555"
    });
    expect(own.ok).toBe(true);
  });

  it("a direct booking and a salon booking share the artist's calendar at the salon", async () => {
    const ctx = await setup();
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const { client } = await newClient();
    const day = dayOn(SATURDAY);
    expect((await book(ctx, client, day, "11:00")).ok).toBe(true);
    const other = (await newClient("Other")).client;
    const clash = await book(ctx, other, day, "11:30");
    expect(clash.status).toBe(409);
    expect(clash.payload.code).toBe("SLOT_TAKEN");
    const viaSalon = await other.post("/api/salon-bookings", {
      salonUserId: ctx.salon.user.id, service: "کوتاهی مو", staff: ctx.staff.name, bookingDate: day, time: "11:00", client: "Other", phone: "09120000777"
    });
    expect(viaSalon.status).toBe(409);
  });

  it("two clients at the same hour: one gets it, the other is told it was just taken", async () => {
    const ctx = await setup();
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const day = dayOn(SATURDAY);
    const clients = await Promise.all([newClient("R1"), newClient("R2"), newClient("R3")]);
    const results = await Promise.all(clients.map(({ client }) => book(ctx, client, day, "14:00")));
    expect(results.filter((item) => item.ok)).toHaveLength(1);
    expect(results.filter((item) => item.status === 409)).toHaveLength(2);
  });

  it("the salon sees how many clients its member brings, never who they are", async () => {
    const ctx = await setup();
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const a = await newClient("Brought A");
    const b = await newClient("Brought B");
    const day = dayOn(SATURDAY);
    expect((await book(ctx, a.client, day, "10:00")).ok).toBe(true);
    expect((await book(ctx, b.client, day, "12:00")).ok).toBe(true);
    // One of them connects to the salon afterwards.
    expect((await a.client.post("/api/follows", { targetUserId: ctx.salon.user.id })).ok).toBe(true);

    const staff = (await ctx.salonClient.get("/api/salon-staff")).payload.data.staff.find((person) => person.id === ctx.staff.id);
    expect(staff.direct_stats).toMatchObject({ live: 2, clientsThisMonth: 2, connected: 1 });

    const direct = await ctx.salonClient.get("/api/salon-staff/direct");
    expect(direct.ok).toBe(true);
    const visits = direct.payload.data.visits;
    expect(visits).toHaveLength(2);
    expect(Object.keys(visits[0]).sort()).toEqual(["artistName", "date", "id", "minutes", "service", "time"]);
    expect(JSON.stringify(visits)).not.toContain("Brought");
    expect((await a.client.get("/api/salon-staff/direct")).status).toBe(403);
  });

  it("an artist leaving the team keeps every booking, now at their own place, and forgets the choice", async () => {
    const ctx = await setup();
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY, 2), "10:00");
    expect(made.ok).toBe(true);
    const left = await ctx.artistClient.delete("/api/artist/teams", { salonUserId: ctx.salon.user.id });
    expect(left.ok).toBe(true);
    const row = (await client.get("/api/artist-bookings")).payload.data.bookings.find((item) => item.id === made.payload.data.booking.id);
    expect(row.status).not.toBe("لغو");
    expect(row.placeSalonName).toBe("");
    expect((await ctx.artistClient.get("/api/artist/place")).payload.data.place).toBeNull();
    expect((await publicArtist(ctx)).team).toBeNull();
    // Joining again starts from their own place.
    expect((await joinSalonAsArtist(ctx.artistClient, ctx.salonClient, ctx.salon.user.id)).ok).toBe(true);
    expect((await ctx.artistClient.get("/api/artist/place")).payload.data.place.mode).toBe("own");
  });

  it("a salon removing the member does the same", async () => {
    const ctx = await setup();
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY, 2), "10:00");
    const removed = await ctx.salonClient.delete("/api/salon-staff", { id: ctx.staff.id });
    expect(removed.ok).toBe(true);
    const row = (await client.get("/api/artist-bookings")).payload.data.bookings.find((item) => item.id === made.payload.data.booking.id);
    expect(row.status).not.toBe("لغو");
    expect(row.placeSalonName).toBe("");
  });

  it("a salon that leaves frfro hands its direct bookings back to each artist's own place", async () => {
    const ctx = await setup();
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const { client } = await newClient();
    const made = await book(ctx, client, dayOn(SATURDAY, 2), "10:00");
    expect(made.ok).toBe(true);
    const gone = await ctx.salonClient.delete("/api/profile", { currentPassword: "testpass123", cancelAll: true });
    expect(gone.ok).toBe(true);
    const row = (await client.get("/api/artist-bookings")).payload.data.bookings.find((item) => item.id === made.payload.data.booking.id);
    expect(row.status).not.toBe("لغو");
    expect(row.placeSalonName).toBe("");
  });

  it("someone on two teams chooses for one salon; the other is untouched", async () => {
    const ctx = await setup();
    const secondSalonClient = createClient();
    const secondSalon = await registerUser(secondSalonClient, { type: "salon", menu: true, name: "Second Salon" });
    await secondSalonClient.get("/api/salon-hours");
    expect((await joinSalonAsArtist(ctx.artistClient, secondSalonClient, secondSalon.user.id)).ok).toBe(true);
    const place = (await ctx.artistClient.get("/api/artist/place")).payload.data.place;
    expect(place.salonName).toBe(secondSalon.user.name);
    expect((await choose(ctx, "salon")).ok).toBe(true);
    const page = await publicArtist(ctx);
    expect(page.team.name).toBe(secondSalon.user.name);
  });

  it("a stale or foreign salon id in the choice is refused", async () => {
    const ctx = await setup();
    const other = createClient();
    const otherSalon = await registerUser(other, { type: "salon", name: "Foreign Salon" });
    const wrong = await ctx.artistClient.put("/api/artist/place", { mode: "salon", salonUserId: otherSalon.user.id });
    expect(wrong.status).toBe(404);
  });

  it("the page's hours follow the salon when it changes its hours, within moments", async () => {
    const ctx = await setup();
    expect((await choose(ctx, "salon")).ok).toBe(true);
    expect(hourOf((await publicArtist(ctx)).hours, SATURDAY).open_time).toBe("۱۰:۰۰");
    await ctx.salonClient.patch("/api/salon-hours", { day: SATURDAY, openTime: "13:00" });
    expect(hourOf((await publicArtist(ctx)).hours, SATURDAY).open_time).toBe("۱۳:۰۰");
  });
});
