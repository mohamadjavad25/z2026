import { describe, it, expect } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser, joinSalonAsArtist, futureBookingDay } from "./helpers.js";

// «نمایش قیمت‌ها» (owner's decision 2026-11-01): off = nobody but the provider sees a price of theirs.
// A salon's menu follows the salon's switch (also with a team artist on the page); an artist's own menu follows the artist's.

const hideMyPrices = async (client) => {
  const res = await client.post("/api/profile/settings", { settings: { showPrices: false } });
  expect(res.ok).toBe(true);
};
const priceOf = (services, name) => (services || []).find((service) => service.name === name)?.price;
const pageHtml = async (path) => (await fetch(`${TEST_BASE_URL}${path}`)).text();

describe("showPrices switch", () => {
  it("artist off: guests, clients and connected cards get no price; the artist still sees it", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Hidden Price Artist" });
    const made = await artistClient.post("/api/artist/me", { name: "ناخن قیمت‌دار", price: "245000", duration: "60 دقیقه" });
    expect(made.ok).toBe(true);
    await hideMyPrices(artistClient);
    const id = artist.user.id;

    const guest = (await createClient().get(`/api/artists/${id}`)).payload.data.artist;
    expect(priceOf(guest.services, "ناخن قیمت‌دار")).toBe("");
    expect(guest.services[0].priceHidden).toBe(true);
    expect(guest.services[0].duration).toBe("60 دقیقه");

    const clientClient = createClient();
    await registerUser(clientClient, { type: "client", name: "Price Peeker" });
    expect(priceOf((await clientClient.get(`/api/artists/${id}`)).payload.data.artist.services, "ناخن قیمت‌دار")).toBe("");
    expect((await clientClient.post("/api/connections", { targetUserId: id })).ok).toBe(true);
    const card = (await clientClient.get("/api/connections?services=1")).payload.data.connections.find((item) => item.id === id);
    expect(priceOf(card.services, "ناخن قیمت‌دار")).toBe("");

    // The web page (SSR) does not carry it either.
    const html = await pageHtml(`/artists/${id}`);
    expect(html).toContain("ناخن قیمت‌دار");
    expect(html).not.toContain("245000");

    // The artist's own workspace and own page view keep the price.
    expect(priceOf((await artistClient.get("/api/artist/me")).payload.data.services, "ناخن قیمت‌دار")).toBe("245000");
    expect(priceOf((await artistClient.get(`/api/artists/${id}`)).payload.data.artist.services, "ناخن قیمت‌دار")).toBe("245000");

    // Booking still works with the price hidden.
    const booked = await clientClient.post("/api/artist/bookings", { artistUserId: id, service: "ناخن قیمت‌دار", bookingDate: futureBookingDay(2), time: "11:00" });
    expect(booked.status).toBe(201);
  });

  it("salon off: page, directory and connected cards get no price; the salon still sees it", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Hidden Price Salon" });
    expect((await salonClient.post("/api/salon-services", { name: "رنگ قیمت‌دار", price: "377000", duration: "90 دقیقه" })).ok).toBe(true);
    await hideMyPrices(salonClient);
    const id = salon.user.id;

    const guest = (await createClient().get(`/api/salons/${id}`)).payload.data.salon;
    expect(priceOf(guest.services, "رنگ قیمت‌دار")).toBe("");
    expect(guest.services[0].priceHidden).toBe(true);
    expect(guest.price).toBe("");

    const listed = (await createClient().get("/api/salons?limit=50")).payload.data.salons.find((item) => item.id === id);
    expect(listed).toBeTruthy();
    expect(priceOf(listed.services, "رنگ قیمت‌دار")).toBe("");

    const clientClient = createClient();
    await registerUser(clientClient, { type: "client", name: "Salon Price Peeker" });
    expect(priceOf((await clientClient.get(`/api/salons/${id}`)).payload.data.salon.services, "رنگ قیمت‌دار")).toBe("");
    expect((await clientClient.post("/api/connections", { targetUserId: id })).ok).toBe(true);
    const card = (await clientClient.get("/api/connections?services=1")).payload.data.connections.find((item) => item.id === id);
    expect(priceOf(card.services, "رنگ قیمت‌دار")).toBe("");

    const html = await pageHtml(`/salons/${id}`);
    expect(html).toContain("رنگ قیمت‌دار");
    expect(html).not.toContain("377000");

    expect(priceOf((await salonClient.get("/api/salon-services")).payload.data.services, "رنگ قیمت‌دار")).toBe("377000");
    expect(priceOf((await salonClient.get(`/api/salons/${id}`)).payload.data.salon.services, "رنگ قیمت‌دار")).toBe("377000");
  });

  it("salon on, team artist off: the salon page keeps the salon's prices; the artist's own page hides hers", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Shown Price Salon" });
    await salonClient.get("/api/salon-hours");
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Own Hidden Artist" });
    expect((await joinSalonAsArtist(artistClient, salonClient, salon.user.id)).ok).toBe(true);
    expect((await salonClient.post("/api/salon-services", { name: "کوتاهی سالن", price: "388000", duration: "30 دقیقه" })).ok).toBe(true);
    expect((await artistClient.post("/api/artist/me", { name: "کار خودم", price: "199000", duration: "30 دقیقه" })).ok).toBe(true);
    await hideMyPrices(artistClient);

    const clientClient = createClient();
    await registerUser(clientClient, { type: "client", name: "Team Price Client" });
    const page = (await clientClient.get(`/api/salons/${salon.user.id}`)).payload.data.salon;
    expect(priceOf(page.services, "کوتاهی سالن")).toBe("388000");
    expect(page.services.every((service) => !service.priceHidden)).toBe(true);
    expect(priceOf((await clientClient.get(`/api/artists/${artist.user.id}`)).payload.data.artist.services, "کار خودم")).toBe("");
  });
});
