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

describe("salon page team: cards and posts", () => {
  it("lists the team with each artist's public posts and nothing private; the artist can take their posts off", async () => {
    const ctx = await setup();
    expect((await ctx.negar.client.post("/api/posts", { title: "ناخن نگار", tag: "ناخن", image: PNG })).ok).toBe(true);
    expect((await ctx.negar.client.post("/api/posts", { title: "خصوصی", tag: "ناخن", image: PNG, isPublic: false })).ok).toBe(true);

    const page = async () => (await ctx.clientClient.get(`/api/salons/${ctx.salon.user.id}`)).payload.data.salon;
    let salon = await page();
    const negar = salon.team.find((member) => member.artistId === ctx.negar.user.id);
    const sahar = salon.team.find((member) => member.artistId === ctx.sahar.user.id);
    expect(negar.posts.map((post) => post.title)).toEqual(["ناخن نگار"]);
    expect(negar.bookingName).toBe(ctx.negar.staff.name);
    expect(sahar.posts).toEqual([]);
    expect(JSON.stringify(salon.team)).not.toMatch(/phone/);

    // Off for this salon: gone from its page, still on the artist's own.
    const off = await ctx.negar.client.patch("/api/artist/teams", { salonUserId: ctx.salon.user.id, postsOnSalon: false });
    expect(off.ok).toBe(true);
    expect(off.payload.data.teams.find((team) => team.salonId === ctx.salon.user.id).postsOnSalon).toBe(false);
    salon = await page();
    expect(salon.team.find((member) => member.artistId === ctx.negar.user.id).posts).toEqual([]);
    const own = (await ctx.clientClient.get(`/api/artists/${ctx.negar.user.id}`)).payload.data.artist;
    expect(JSON.stringify(own)).toContain("ناخن نگار");

    // Back on.
    expect((await ctx.negar.client.patch("/api/artist/teams", { salonUserId: ctx.salon.user.id, postsOnSalon: true })).ok).toBe(true);
    salon = await page();
    expect(salon.team.find((member) => member.artistId === ctx.negar.user.id).posts).toHaveLength(1);
  });

  it("only a member changes the switch, and only for their own team", async () => {
    const ctx = await setup();
    const stranger = createClient();
    await registerUser(stranger, { type: "artist", name: "Not On Team" });
    expect((await stranger.patch("/api/artist/teams", { salonUserId: ctx.salon.user.id, postsOnSalon: false })).status).toBe(404);
    expect((await ctx.clientClient.patch("/api/artist/teams", { salonUserId: ctx.salon.user.id, postsOnSalon: false })).status).toBe(403);
    expect((await ctx.negar.client.patch("/api/artist/teams", { salonUserId: ctx.salon.user.id, postsOnSalon: "no" })).status).toBe(400);
  });

  it("an artist who leaves the team leaves the salon's page with their posts", async () => {
    const ctx = await setup();
    expect((await ctx.sahar.client.post("/api/posts", { title: "کار سحر", tag: "مو", image: PNG })).ok).toBe(true);
    expect((await ctx.sahar.client.delete("/api/artist/teams", { salonUserId: ctx.salon.user.id })).ok).toBe(true);
    const salon = (await ctx.clientClient.get(`/api/salons/${ctx.salon.user.id}`)).payload.data.salon;
    expect(salon.team.some((member) => member.artistId === ctx.sahar.user.id)).toBe(false);
    expect(JSON.stringify(salon.team)).not.toContain("کار سحر");
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
