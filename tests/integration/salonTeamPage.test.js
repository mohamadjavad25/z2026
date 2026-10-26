import { describe, it, expect } from "vitest";
import { createClient, joinSalonAsArtist, registerUser, futureBookingDay } from "./helpers.js";
import { toLatinDigits } from "../../app/shared/lib/digits.js";

// The salon page's team cards and «رزرو با …» (owner's decision 2026-10-26).
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const S = "کوتاهی تیمی"; // 30 min, both artists do it

async function setup() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Team Page Salon" });
  await salonClient.get("/api/salon-hours");
  const joinAs = async (name) => {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name });
    expect((await joinSalonAsArtist(client, salonClient, salon.user.id)).ok).toBe(true);
    return { client, user };
  };
  const negar = await joinAs("Team Negar");
  const sahar = await joinAs("Team Sahar");
  const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
  negar.staff = staff.find((person) => Number(person.artist_user_id) === Number(negar.user.id));
  sahar.staff = staff.find((person) => Number(person.artist_user_id) === Number(sahar.user.id));
  const created = await salonClient.post("/api/salon-services", { name: S, price: "300000", duration: "۳۰ دقیقه" });
  expect(created.ok).toBe(true);
  const linked = await salonClient.patch("/api/salon-services", { id: created.payload.data.service.id, name: S, staff_ids: [String(negar.staff.id), String(sahar.staff.id)] });
  expect(linked.ok).toBe(true);
  const clientClient = createClient();
  const client = await registerUser(clientClient, { type: "client", name: "Team Page Client" });
  return { salonClient, salon, negar, sahar, clientClient, client };
}

function timesUrl(ctx, day, prefer = "") {
  const query = new URLSearchParams({ salonUserId: String(ctx.salon.user.id), day, service: S });
  if (prefer) query.set("prefer", prefer);
  return `/api/salon-bookings/availability?${query}`;
}

const request = (ctx, { day, time, preferStaff }) => ctx.clientClient.post("/api/salon-bookings", {
  salonUserId: ctx.salon.user.id, service: S, bookingDate: day, time, client: ctx.client.user.name, phone: ctx.client.phone,
  ...(preferStaff ? { preferStaff } : {})
});

describe("salon page team: «رزرو با …»", () => {
  it("offers only the times the chosen artist is free, and books with them", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    // The salon books Negar at 10:00 itself.
    const busy = await ctx.salonClient.post("/api/salon-bookings", { service: S, staff: ctx.negar.staff.name, bookingDate: day, time: "10:00", client: "حضوری", phone: "09120000091" });
    expect(busy.ok).toBe(true);

    const times = async (prefer) => (await ctx.clientClient.get(timesUrl(ctx, day, prefer))).payload.data.times.map(toLatinDigits);
    const anyone = await times();
    const withNegar = await times(ctx.negar.staff.name);
    const withSahar = await times(ctx.sahar.staff.name);
    expect(anyone).toContain("10:00");
    expect(withSahar).toContain("10:00");
    expect(withNegar).not.toContain("10:00");
    expect(withNegar.length).toBeGreaterThan(0);

    // With Negar at 10:00 is refused even though Sahar is free then; with Sahar it goes through, to Sahar.
    const refused = await request(ctx, { day, time: "10:00", preferStaff: ctx.negar.staff.name });
    expect(refused.status).toBe(409);
    const booked = await request(ctx, { day, time: "10:00", preferStaff: ctx.sahar.staff.name });
    expect(booked.ok).toBe(true);
    expect(booked.payload.data.booking.staff).toBe(ctx.sahar.staff.name);
  });

  it("two clients at the same time each get the artist they asked for", async () => {
    const ctx = await setup();
    const day = futureBookingDay(3);
    const other = createClient();
    const second = await registerUser(other, { type: "client", name: "Team Page Client 2" });
    const first = await request(ctx, { day, time: "11:00", preferStaff: ctx.sahar.staff.name });
    expect(first.ok).toBe(true);
    expect(first.payload.data.booking.staff).toBe(ctx.sahar.staff.name);
    const res = await other.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: S, bookingDate: day, time: "11:00", client: second.user.name, phone: second.phone, preferStaff: ctx.negar.staff.name });
    expect(res.ok).toBe(true);
    expect(res.payload.data.booking.staff).toBe(ctx.negar.staff.name);
  });

  it("an unknown name is never booked with someone else", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const times = (await ctx.clientClient.get(timesUrl(ctx, day, "Nobody Here"))).payload.data.times;
    expect(times).toEqual([]);
    expect((await request(ctx, { day, time: "12:00", preferStaff: "Nobody Here" })).status).toBe(409);
  });
});

describe("salon page team: posts need the salon's yes", () => {
  const post = async (artist, title, extra = {}) => {
    const res = await artist.client.post("/api/posts", { title, tag: "ناخن", image: PNG, ...extra });
    expect(res.ok).toBe(true);
    return res.payload.data.post.id;
  };
  const send = (ctx, artist, postId, action = "send") => artist.client.post("/api/artist/team-posts", { postId, salonUserId: ctx.salon.user.id, action });
  const decide = (ctx, postId, action) => ctx.salonClient.post("/api/salon-team-posts", { postId, action });
  const pagePosts = async (ctx, artist) => {
    const salon = (await ctx.clientClient.get(`/api/salons/${ctx.salon.user.id}`)).payload.data.salon;
    return (salon.team.find((member) => member.artistId === artist.user.id)?.posts || []).map((item) => item.title);
  };

  it("shows a post on the salon's page only after the salon adds it; a no stays a no", async () => {
    const ctx = await setup();
    const kept = await post(ctx.negar, "ناخن نگار");
    const refusedPost = await post(ctx.negar, "طرح دوم");
    const secret = await post(ctx.negar, "خصوصی", { isPublic: false });
    expect(await pagePosts(ctx, ctx.negar)).toEqual([]);

    expect((await send(ctx, ctx.negar, secret)).status).toBe(400);
    const sent = await send(ctx, ctx.negar, kept);
    expect(sent.ok).toBe(true);
    expect(sent.payload.data.statuses[kept][ctx.salon.user.id]).toBe("pending");
    expect((await send(ctx, ctx.negar, refusedPost)).ok).toBe(true);
    expect(await pagePosts(ctx, ctx.negar)).toEqual([]);

    const waiting = (await ctx.salonClient.get("/api/salon-team-posts")).payload.data;
    expect(waiting.requests.map((item) => item.postId).sort()).toEqual([kept, refusedPost].sort());
    expect(waiting.requests[0].artistName).toBeTruthy();

    expect((await decide(ctx, kept, "approve")).ok).toBe(true);
    expect((await decide(ctx, refusedPost, "decline")).ok).toBe(true);
    expect(await pagePosts(ctx, ctx.negar)).toEqual(["ناخن نگار"]);
    // The same answer twice is refused; a declined post cannot be sent again.
    expect((await decide(ctx, kept, "approve")).status).toBe(409);
    expect((await send(ctx, ctx.negar, refusedPost)).status).toBe(409);

    const salon = (await ctx.clientClient.get(`/api/salons/${ctx.salon.user.id}`)).payload.data.salon;
    expect(salon.team.find((member) => member.artistId === ctx.negar.user.id).bookingName).toBe(ctx.negar.staff.name);
    expect(JSON.stringify(salon.team)).not.toMatch(/phone|خصوصی|طرح دوم/);
  });

  it("the salon can take an added post off; the artist can take theirs back; the post itself stays", async () => {
    const ctx = await setup();
    const one = await post(ctx.negar, "اولی");
    const two = await post(ctx.negar, "دومی");
    for (const id of [one, two]) {
      await send(ctx, ctx.negar, id);
      await decide(ctx, id, "approve");
    }
    expect((await pagePosts(ctx, ctx.negar)).sort()).toEqual(["اولی", "دومی"].sort());
    expect((await decide(ctx, one, "remove")).ok).toBe(true);
    expect((await send(ctx, ctx.negar, two, "withdraw")).ok).toBe(true);
    expect(await pagePosts(ctx, ctx.negar)).toEqual([]);
    const own = (await ctx.clientClient.get(`/api/artists/${ctx.negar.user.id}`)).payload.data.artist;
    expect(JSON.stringify(own)).toContain("اولی");
    // Taken off by the salon counts as a no; taken back by the artist can be sent again.
    expect((await send(ctx, ctx.negar, one)).status).toBe(409);
    expect((await send(ctx, ctx.negar, two)).ok).toBe(true);
  });

  it("a new picture sends an added post back to the salon", async () => {
    const ctx = await setup();
    const id = await post(ctx.negar, "عکس عوض‌شده");
    await send(ctx, ctx.negar, id);
    await decide(ctx, id, "approve");
    expect((await ctx.negar.client.patch(`/api/posts/${id}`, { title: "عکس عوض‌شده", tag: "ناخن", image: PNG })).ok).toBe(true);
    expect(await pagePosts(ctx, ctx.negar)).toEqual([]);
    const waiting = (await ctx.salonClient.get("/api/salon-team-posts")).payload.data;
    expect(waiting.requests.map((item) => item.postId)).toEqual([id]);
    // A title-only edit keeps it on the page.
    await decide(ctx, id, "approve");
    expect((await ctx.negar.client.patch(`/api/posts/${id}`, { title: "تیتر تازه", tag: "ناخن" })).ok).toBe(true);
    expect(await pagePosts(ctx, ctx.negar)).toEqual(["تیتر تازه"]);
  });

  it("only a member sends, only their own posts, and only this salon answers", async () => {
    const ctx = await setup();
    const id = await post(ctx.negar, "مال نگار");
    const stranger = createClient();
    await registerUser(stranger, { type: "artist", name: "Not On Team" });
    const strangerPost = (await stranger.post("/api/posts", { title: "غریبه", tag: "ناخن", image: PNG })).payload.data.post.id;
    expect((await stranger.post("/api/artist/team-posts", { postId: strangerPost, salonUserId: ctx.salon.user.id, action: "send" })).status).toBe(404);
    expect((await send(ctx, ctx.sahar, id)).status).toBe(404); // someone else's post
    expect((await ctx.clientClient.post("/api/artist/team-posts", { postId: id, salonUserId: ctx.salon.user.id, action: "send" })).status).toBe(403);
    expect((await ctx.negar.client.post("/api/artist/team-posts", { postId: id, salonUserId: ctx.salon.user.id, action: "maybe" })).status).toBe(400);

    expect((await send(ctx, ctx.negar, id)).ok).toBe(true);
    const otherSalon = createClient();
    await registerUser(otherSalon, { type: "salon", name: "Other Team Salon" });
    expect((await otherSalon.post("/api/salon-team-posts", { postId: id, action: "approve" })).status).toBe(409);
    expect((await ctx.negar.client.post("/api/salon-team-posts", { postId: id, action: "approve" })).status).toBe(403);
    expect(await pagePosts(ctx, ctx.negar)).toEqual([]);
  });

  it("keeps at most ten waiting per salon, even when two are sent at once", async () => {
    const ctx = await setup();
    const ids = [];
    for (let i = 0; i < 11; i += 1) ids.push(await post(ctx.negar, `کار ${i}`));
    for (const id of ids.slice(0, 9)) expect((await send(ctx, ctx.negar, id)).ok).toBe(true);
    const both = await Promise.all([send(ctx, ctx.negar, ids[9]), send(ctx, ctx.negar, ids[10])]);
    expect(both.filter((res) => res.ok)).toHaveLength(1);
    expect(both.find((res) => !res.ok).status).toBe(429);
    // Once the salon answers one, there is room again.
    await decide(ctx, ids[0], "approve");
    const late = both[0].ok ? ids[10] : ids[9];
    expect((await send(ctx, ctx.negar, late)).ok).toBe(true);
  });

  it("an artist who leaves takes their posts off the salon's page, and a return starts over", async () => {
    const ctx = await setup();
    const id = await post(ctx.sahar, "کار سحر");
    await send(ctx, ctx.sahar, id);
    await decide(ctx, id, "approve");
    expect(await pagePosts(ctx, ctx.sahar)).toEqual(["کار سحر"]);
    expect((await ctx.sahar.client.delete("/api/artist/teams", { salonUserId: ctx.salon.user.id })).ok).toBe(true);
    const salon = (await ctx.clientClient.get(`/api/salons/${ctx.salon.user.id}`)).payload.data.salon;
    expect(salon.team.some((member) => member.artistId === ctx.sahar.user.id)).toBe(false);
    expect(JSON.stringify(salon.team)).not.toContain("کار سحر");
    expect((await ctx.salonClient.get("/api/salon-team-posts")).payload.data.approved).toEqual([]);
    expect((await send(ctx, ctx.sahar, id)).status).toBe(404);

    expect((await joinSalonAsArtist(ctx.sahar.client, ctx.salonClient, ctx.salon.user.id)).ok).toBe(true);
    expect(await pagePosts(ctx, ctx.sahar)).toEqual([]);
    expect((await ctx.sahar.client.get("/api/artist/team-posts")).payload.data.statuses).toEqual({});
    expect((await send(ctx, ctx.sahar, id)).ok).toBe(true);
  });

  it("a deleted post leaves the salon's page and its waiting list", async () => {
    const ctx = await setup();
    const shown = await post(ctx.negar, "پاک‌شدنی");
    const waiting = await post(ctx.negar, "منتظر");
    await send(ctx, ctx.negar, shown);
    await decide(ctx, shown, "approve");
    await send(ctx, ctx.negar, waiting);
    expect((await ctx.negar.client.delete(`/api/posts/${shown}`)).ok).toBe(true);
    expect((await ctx.negar.client.delete(`/api/posts/${waiting}`)).ok).toBe(true);
    expect(await pagePosts(ctx, ctx.negar)).toEqual([]);
    expect((await ctx.salonClient.get("/api/salon-team-posts")).payload.data).toEqual({ requests: [], approved: [] });
  });
});

describe("salon page team: «رزرو با …» only for that person's services", () => {
  it("refuses a service given to someone else, and takes one given to nobody", async () => {
    const ctx = await setup();
    const day = futureBookingDay(2);
    const only = "رنگ فقط سحر";
    const made = await ctx.salonClient.post("/api/salon-services", { name: only, price: "500000", duration: "۶۰ دقیقه" });
    await ctx.salonClient.patch("/api/salon-services", { id: made.payload.data.service.id, name: only, staff_ids: [String(ctx.sahar.staff.id)] });
    const ask = async (prefer) => {
      const query = new URLSearchParams({ salonUserId: String(ctx.salon.user.id), day, service: only, prefer });
      return (await ctx.clientClient.get(`/api/salon-bookings/availability?${query}`)).payload.data.times;
    };
    expect(await ask(ctx.negar.staff.name)).toEqual([]);
    expect((await ask(ctx.sahar.staff.name)).length).toBeGreaterThan(0);
    const refused = await ctx.clientClient.post("/api/salon-bookings", { salonUserId: ctx.salon.user.id, service: only, bookingDate: day, time: "12:00", client: ctx.client.user.name, phone: ctx.client.phone, preferStaff: ctx.negar.staff.name });
    expect(refused.status).toBe(409);
  });
});
