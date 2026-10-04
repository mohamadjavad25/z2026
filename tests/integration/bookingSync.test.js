import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

async function setup() {
  const salonClient = createClient();
  const salon = await registerUser(salonClient, { type: "salon", name: "Sync Salon" });
  await salonClient.get("/api/salon-hours");
  const artistClient = createClient();
  const artist = await registerUser(artistClient, { type: "artist", name: "Rojan Staff" });
  const join = await artistClient.post("/api/artist/join-salon", { salonUserId: salon.user.id });
  expect(join.ok).toBe(true);
  const clientClient = createClient();
  const client = await registerUser(clientClient, { type: "client", name: "Sync Client" });
  return { salonClient, salon, artistClient, artist, clientClient, client };
}

async function bookSalonWithStaff(ctx, bookingDate = "شنبه", time = "۱۰:۰۰") {
  const staff = (await ctx.salonClient.get("/api/salon-staff")).payload.data.staff;
  const created = await ctx.clientClient.post("/api/salon-bookings", {
    salonUserId: ctx.salon.user.id,
    service: "کوتاهی مو",
    staff: staff[0].name,
    bookingDate,
    time,
    client: ctx.client.user.name,
    phone: ctx.client.phone
  });
  expect(created.ok).toBe(true);
  return created.payload.data.booking;
}

describe("salon booking assigned to a staff artist", () => {
  it("shows the client ONE booking, and the artist's confirm updates the salon booking too", async () => {
    const ctx = await setup();
    const booking = await bookSalonWithStaff(ctx);

    // The artist sees the mirrored request and confirms it.
    const mine = await ctx.artistClient.get("/api/artist/me");
    const mirror = mine.payload.data.bookings.find((b) => b.client_name === ctx.client.user.name);
    expect(mirror).toBeTruthy();
    const confirmed = await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id: mirror.id, status: "تایید شده" });
    expect(confirmed.ok).toBe(true);
    // ...and it is still in the artist's list afterwards, confirmed.
    const after = confirmed.payload.data.bookings.find((b) => b.id === mirror.id);
    expect(after.status).toBe("تایید شده");

    // The salon's own row follows.
    const salonList = (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings;
    expect(salonList.find((b) => b.id === booking.id).status).toBe("تایید شده");

    // The client sees one booking (not the salon row + its artist mirror), confirmed.
    const salonSide = (await ctx.clientClient.get("/api/salon-bookings")).payload.data.bookings;
    const artistSide = (await ctx.clientClient.get("/api/artist-bookings")).payload.data.bookings;
    expect(salonSide.filter((b) => b.id === booking.id).map((b) => b.status)).toEqual(["تایید شده"]);
    expect(artistSide).toHaveLength(0);
  });

  it("the salon's confirm shows on the artist's side and the artist's decline cancels the salon booking", async () => {
    const ctx = await setup();
    const booking = await bookSalonWithStaff(ctx, "یکشنبه", "۱۱:۰۰");
    await ctx.artistClient.get("/api/artist/me");
    const salonConfirm = await ctx.salonClient.patch("/api/salon-bookings", { id: booking.id, status: "تایید شده" });
    expect(salonConfirm.ok).toBe(true);
    const mine = (await ctx.artistClient.get("/api/artist/me")).payload.data.bookings;
    expect(mine.find((b) => b.client_name === ctx.client.user.name).status).toBe("تایید شده");

    const mirror = mine.find((b) => b.client_name === ctx.client.user.name);
    const declined = await ctx.artistClient.patch("/api/artist/me", { kind: "booking", id: mirror.id, status: "لغو", action: "cancel" });
    expect(declined.ok).toBe(true);
    const salonList = (await ctx.salonClient.get("/api/salon-bookings")).payload.data.bookings;
    expect(salonList.find((b) => b.id === booking.id).status).toBe("لغو");
  });
});

describe("client booking lists", () => {
  it("never shows a client someone else's booking that only shares their name", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Name Salon" });
    await salonClient.get("/api/salon-hours");
    const a = createClient();
    const b = createClient();
    const userA = await registerUser(a, { type: "client", name: "مریم همنام" });
    await registerUser(b, { type: "client", name: "مریم همنام" });
    const created = await a.post("/api/salon-bookings", {
      salonUserId: salon.user.id, service: "کوتاهی مو", bookingDate: "شنبه", time: "۱۰:۰۰",
      client: userA.user.name, phone: userA.phone
    });
    expect(created.ok).toBe(true);
    expect(created.payload.data.booking.status).toBe("درخواست");
    expect((await a.get("/api/salon-bookings")).payload.data.bookings).toHaveLength(1);
    expect((await b.get("/api/salon-bookings")).payload.data.bookings).toHaveLength(0);
  });

  it("a request made by a client is pending for the salon; the salon's own entry is settled", async () => {
    const ctx = await setup();
    const booking = await bookSalonWithStaff(ctx, "دوشنبه", "۱۲:۰۰");
    expect(booking.status).toBe("درخواست");
    const own = await ctx.salonClient.post("/api/salon-bookings", {
      service: "کوتاهی مو", bookingDate: "سه‌شنبه", time: "۱۳:۰۰", client: "حضوری", phone: "09120000001"
    });
    expect(own.ok).toBe(true);
    expect(own.payload.data.booking.status).toBe("تازه");
  });
});
