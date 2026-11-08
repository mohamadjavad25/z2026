import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";

const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

const clientOf = async (id) => {
  await connected;
  const { rows } = await db.query("SELECT client_user_id FROM artist_bookings WHERE id = $1", [Number(id)]);
  return rows[0]?.client_user_id ?? null;
};

// 2026-11-08: an artist booked themself on their own page and the admin panel showed them as the client too
// (luce nail as both «مشتری» and «آرتیست»): the own entry stored the artist's account as the client's.
describe("an artist's own entry never names the artist (or a forged id) as the client account", () => {
  it("own page and own calendar leave the client account empty; a real client's request keeps theirs", async () => {
    const artistApi = createClient();
    const artist = await registerUser(artistApi, { type: "artist", menu: true, name: "Own Entry Artist" });
    const clientApi = createClient();
    const client = await registerUser(clientApi, { type: "client", name: "Own Entry Client" });
    const day = futureBookingDay(3);

    // Through the booking door, as the artist on their own page (a walk-in with no name).
    const own = await artistApi.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: day, time: "۱۰:۰۰" });
    expect(own.status, JSON.stringify(own.payload)).toBe(201);
    expect(await clientOf(own.payload.data.booking.id)).toBeNull();

    // Through the artist's own calendar, with a client account id slipped into the body.
    const hand = await artistApi.post("/api/artist/me", { kind: "booking", date: day, time: "۱۲:۰۰", service: "ناخن", client: "حضوری", clientUserId: client.user.id, client_user_id: client.user.id });
    expect(hand.status, JSON.stringify(hand.payload)).toBe(201);
    expect(await clientOf(hand.payload.data.booking.id)).toBeNull();

    // A client's own request still belongs to the client.
    const asked = await clientApi.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: day, time: "۱۴:۰۰" });
    expect(asked.status, JSON.stringify(asked.payload)).toBe(201);
    expect(Number(await clientOf(asked.payload.data.booking.id))).toBe(Number(client.user.id));
  }, 60_000);

  it("migration 077 clears the rows already saved that way, and leaves real clients alone", async () => {
    const artistApi = createClient();
    const artist = await registerUser(artistApi, { type: "artist", menu: true, name: "Old Entry Artist" });
    const clientApi = createClient();
    const client = await registerUser(clientApi, { type: "client", name: "Old Entry Client" });
    const day = futureBookingDay(4);
    const own = await artistApi.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: day, time: "۱۰:۰۰" });
    const asked = await clientApi.post("/api/artist/bookings", { artistUserId: artist.user.id, service: "ناخن", bookingDate: day, time: "۱۴:۰۰" });
    await connected;
    // As the old code saved it.
    await db.query("UPDATE artist_bookings SET client_user_id = artist_user_id WHERE id = $1", [own.payload.data.booking.id]);
    const sql = readFileSync(new URL("../../migrations/077_artist_own_entry_no_client.sql", import.meta.url), "utf8");
    await db.query(sql);
    await db.query(sql);
    expect(await clientOf(own.payload.data.booking.id)).toBeNull();
    expect(Number(await clientOf(asked.payload.data.booking.id))).toBe(Number(client.user.id));
  }, 60_000);
});
