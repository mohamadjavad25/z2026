import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";

const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

const SERVICE = "کوتاهی صبر";

async function salonWith(name, services = [SERVICE]) {
  const client = createClient();
  const salon = await registerUser(client, { type: "salon", name });
  await client.get("/api/salon-hours");
  for (const service of services) {
    expect((await client.post("/api/salon-services", { name: service, price: "300", duration: "۳۰ دقیقه" })).ok).toBe(true);
  }
  return { client, salon };
}

async function customer(name = "Wait Client") {
  const client = createClient();
  const account = await registerUser(client, { type: "client", name });
  return { client, ...account };
}

const sweep = async () => (await (await fetch(`${TEST_BASE_URL}/api/cron/expire-bookings`, {
  method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` }
})).json()).data;

const sendBack = (id, minutes) => db.query(`UPDATE salon_bookings SET created_at = NOW() - ($2::int * INTERVAL '1 minute') WHERE id = $1`, [id, minutes]);

describe("the client chooses how long a request waits", () => {
  it("«صبر می‌کنم» never times out; the hour does", async () => {
    await connected;
    const { salon } = await salonWith("Wait Salon A");
    const me = await customer();
    const day = futureBookingDay(2);
    const open = await me.client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: SERVICE, bookingDate: day, time: "۱۰:۰۰", waitMinutes: null });
    const hour = await me.client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: SERVICE, bookingDate: day, time: "۱۲:۰۰", waitMinutes: 60 });
    expect(open.status).toBe(201);
    expect(open.payload.data.booking.wait_minutes).toBeNull();
    expect(hour.payload.data.booking.wait_minutes).toBe(60);
    await sendBack(open.payload.data.booking.id, 600);
    await sendBack(hour.payload.data.booking.id, 61);
    await sweep();
    const mine = (await me.client.get("/api/salon-bookings")).payload.data.bookings;
    expect(mine.find((row) => row.id === open.payload.data.booking.id).status).toBe("درخواست");
    expect(mine.find((row) => row.id === hour.payload.data.booking.id).status).toBe("منقضی شده");
  });

  it("a request sent without a choice keeps the old hour, and a bad value is refused", async () => {
    const { salon } = await salonWith("Wait Salon B");
    const me = await customer();
    const plain = await me.client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: SERVICE, bookingDate: futureBookingDay(2), time: "۱۰:۰۰" });
    expect(plain.payload.data.booking.wait_minutes).toBe(60);
    const bad = await me.client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: SERVICE, bookingDate: futureBookingDay(2), time: "۱۱:۰۰", waitMinutes: 5 });
    expect(bad.status).toBe(400);
  });
});

describe("the backup salon", () => {
  it("is offered only among followed salons that do every service", async () => {
    const { salon: first } = await salonWith("Backup First", [SERVICE, "رنگ صبر"]);
    const { salon: both } = await salonWith("Backup Both", [SERVICE, "رنگ صبر"]);
    const { salon: half } = await salonWith("Backup Half", [SERVICE]);
    const { salon: stranger } = await salonWith("Backup Stranger", [SERVICE, "رنگ صبر"]);
    const me = await customer();
    for (const target of [both, half]) expect((await me.client.post("/api/follows", { targetUserId: target.user.id, follow: true })).ok).toBe(true);
    const day = futureBookingDay(2);
    const query = (services) => {
      const params = new URLSearchParams({ salonUserId: String(first.user.id), day, time: "۱۰:۰۰" });
      services.forEach((service) => params.append("service", service));
      return `/api/salon-bookings/fallbacks?${params}`;
    };
    const ids = (res) => res.payload.data.salons.map((salon) => salon.id);
    expect(ids(await me.client.get(query([SERVICE, "رنگ صبر"])))).toEqual([both.user.id]);
    expect(ids(await me.client.get(query([SERVICE]))).sort()).toEqual([both.user.id, half.user.id].sort());
    expect(ids(await me.client.get(query([SERVICE])))).not.toContain(stranger.user.id);

    // A salon the client doesn't follow is never stored as the backup, even if sent.
    const sneaky = await me.client.post("/api/salon-bookings", { salonUserId: first.user.id, service: SERVICE, bookingDate: day, time: "۱۱:۰۰", waitMinutes: 60, fallbackSalonUserId: stranger.user.id });
    expect(sneaky.payload.data.booking.fallback_salon_user_id).toBeNull();
  });

  it("gets the same request when the hour runs out, and the first salon never sees which one", async () => {
    await connected;
    const { client: firstClient, salon: first } = await salonWith("Move First");
    const { client: secondClient, salon: second } = await salonWith("Move Second");
    const me = await customer("Move Client");
    await me.client.post("/api/follows", { targetUserId: second.user.id, follow: true });
    const day = futureBookingDay(2);
    const created = await me.client.post("/api/salon-bookings", {
      salonUserId: first.user.id, service: SERVICE, bookingDate: day, time: "۱۰:۰۰", waitMinutes: 60, fallbackSalonUserId: second.user.id
    });
    expect(created.status).toBe(201);
    const id = created.payload.data.booking.id;
    const firstView = (await firstClient.get("/api/salon-bookings")).payload.data.bookings.find((row) => row.id === id);
    expect(firstView).toBeTruthy();
    expect(firstView.fallback_salon_user_id).toBeUndefined();

    await sendBack(id, 61);
    expect((await sweep()).salonMoved).toBeGreaterThanOrEqual(1);

    const mine = (await me.client.get("/api/salon-bookings")).payload.data.bookings;
    const old = mine.find((row) => row.id === id);
    expect(old.status).toBe("منقضی شده");
    expect(old.moved_to_name).toBe("Move Second");
    const moved = mine.find((row) => row.id === old.moved_to_booking_id);
    expect(moved).toMatchObject({ status: "درخواست", salon_user_id: second.user.id, service: SERVICE, booking_date: day, wait_minutes: 60, fallback_salon_user_id: null, moved_from_name: "Move First" });
    const secondView = (await secondClient.get("/api/salon-bookings")).payload.data.bookings;
    expect(secondView.some((row) => row.id === moved.id)).toBe(true);
  });

  it("is not used when the second salon is no longer free: the request just expires", async () => {
    await connected;
    const { salon: first } = await salonWith("Full First");
    const { salon: second } = await salonWith("Full Second");
    const me = await customer();
    const other = await customer("Other Client");
    await me.client.post("/api/follows", { targetUserId: second.user.id, follow: true });
    const day = futureBookingDay(2);
    const created = await me.client.post("/api/salon-bookings", {
      salonUserId: first.user.id, service: SERVICE, bookingDate: day, time: "۱۰:۰۰", waitMinutes: 60, fallbackSalonUserId: second.user.id
    });
    // Someone else takes that time at the second salon, and it confirms them.
    const taken = await other.client.post("/api/salon-bookings", { salonUserId: second.user.id, service: SERVICE, bookingDate: day, time: "۱۰:۰۰" });
    expect(taken.status).toBe(201);
    await sendBack(created.payload.data.booking.id, 61);
    await sweep();
    const old = (await me.client.get("/api/salon-bookings")).payload.data.bookings.find((row) => row.id === created.payload.data.booking.id);
    expect(old.status).toBe("منقضی شده");
    expect(old.moved_to_booking_id).toBeNull();
  });
});

describe("a client's booking answer never carries other customers", () => {
  it("the salon's full list goes back to the salon only", async () => {
    const { client: salonClient, salon } = await salonWith("Privacy Salon");
    const first = await customer("Privacy First");
    const second = await customer("Privacy Second");
    const day = futureBookingDay(2);
    expect((await first.client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: SERVICE, bookingDate: day, time: "۱۰:۰۰" })).status).toBe(201);
    const mine = await second.client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: SERVICE, bookingDate: day, time: "۱۲:۰۰" });
    expect(mine.status).toBe(201);
    expect(mine.payload.data.bookings).toBeUndefined();
    expect(JSON.stringify(mine.payload)).not.toContain("Privacy First");
    expect(JSON.stringify(mine.payload)).not.toContain(first.phone);
    // A refused request doesn't hand the list over either.
    const refused = await second.client.post("/api/salon-bookings", { salonUserId: salon.user.id, service: SERVICE, bookingDate: day, time: "۱۰:۰۰" });
    expect(refused.status).toBe(409);
    expect(JSON.stringify(refused.payload)).not.toContain("Privacy First");
    // The salon's own entry still gets its list back.
    const own = await salonClient.post("/api/salon-bookings", { service: SERVICE, bookingDate: day, time: "۱۴:۰۰", client: "حضوری" });
    expect(own.payload.data.bookings.length).toBeGreaterThanOrEqual(3);
  });
});

describe("the backup artist, for a request made straight to an artist", () => {
  const ARTIST_SERVICE = "کاشت صبر";
  async function artistWith(name, service = ARTIST_SERVICE) {
    const client = createClient();
    const artist = await registerUser(client, { type: "artist", name });
    expect((await client.post("/api/artist/me", { name: service, price: "100", duration: "۶۰ دقیقه" })).ok).toBe(true);
    return { client, artist };
  }
  const artistSweepBack = (id, minutes) => db.query(`UPDATE artist_bookings SET created_at = NOW() - ($2::int * INTERVAL '1 minute') WHERE id = $1`, [id, minutes]);

  it("is offered among followed artists doing the service, and gets the request when the hour runs out", async () => {
    await connected;
    const { client: firstClient, artist: first } = await artistWith("Artist Wait First");
    const { client: secondClient, artist: second } = await artistWith("Artist Wait Second");
    const { artist: other } = await artistWith("Artist Wait Other", "خدمت دیگر صبر");
    const me = await customer("Artist Wait Client");
    for (const target of [second, other]) await me.client.post("/api/follows", { targetUserId: target.user.id, follow: true });
    const day = futureBookingDay(2);
    const offered = await me.client.get(`/api/artist-bookings/fallbacks?${new URLSearchParams({ artistUserId: String(first.user.id), service: ARTIST_SERVICE, day, time: "۱۰:۰۰" })}`);
    expect(offered.payload.data.artists.map((item) => item.id)).toEqual([second.user.id]);

    const created = await me.client.post("/api/artist/bookings", {
      artistUserId: first.user.id, service: ARTIST_SERVICE, bookingDate: day, time: "۱۰:۰۰", waitMinutes: 60, fallbackArtistUserId: second.user.id
    });
    expect(created.status).toBe(201);
    const id = created.payload.data.booking.id;
    expect(created.payload.data.booking.fallback_artist_user_id).toBe(second.user.id);
    // The first artist never sees which artist was the backup.
    const firstView = (await firstClient.get("/api/artist/me")).payload.data.bookings.find((row) => row.id === id);
    expect(firstView.fallback_artist_user_id).toBeUndefined();

    await artistSweepBack(id, 61);
    expect((await sweep()).artistMoved).toBeGreaterThanOrEqual(1);
    const mine = (await me.client.get("/api/artist-bookings")).payload.data.bookings;
    const old = mine.find((row) => row.id === id);
    expect(old.status).toBe("منقضی شده");
    expect(old.moved_to_name).toBe("Artist Wait Second");
    const moved = mine.find((row) => row.id === old.moved_to_booking_id);
    expect(moved).toMatchObject({ artist_user_id: second.user.id, service: ARTIST_SERVICE, booking_date: day, wait_minutes: 60, fallback_artist_user_id: null, moved_from_name: "Artist Wait First" });
    expect((await secondClient.get("/api/artist/me")).payload.data.bookings.some((row) => row.id === moved.id)).toBe(true);
  });

  it("a backup the client doesn't follow is never stored, and «صبر می‌کنم» never times out", async () => {
    await connected;
    const { artist: first } = await artistWith("Artist Open First");
    const { artist: stranger } = await artistWith("Artist Open Stranger");
    const me = await customer();
    const day = futureBookingDay(2);
    const sneaky = await me.client.post("/api/artist/bookings", { artistUserId: first.user.id, service: ARTIST_SERVICE, bookingDate: day, time: "۱۰:۰۰", waitMinutes: 60, fallbackArtistUserId: stranger.user.id });
    expect(sneaky.payload.data.booking.fallback_artist_user_id).toBeNull();
    const open = await me.client.post("/api/artist/bookings", { artistUserId: first.user.id, service: ARTIST_SERVICE, bookingDate: day, time: "۱۴:۰۰", waitMinutes: null });
    expect(open.payload.data.booking.wait_minutes).toBeNull();
    await artistSweepBack(open.payload.data.booking.id, 600);
    await sweep();
    const row = (await me.client.get("/api/artist-bookings")).payload.data.bookings.find((item) => item.id === open.payload.data.booking.id);
    expect(row.status).toBe("تازه");
  });
});
