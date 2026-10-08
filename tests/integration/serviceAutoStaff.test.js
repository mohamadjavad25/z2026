import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

async function joinAs(salonUserId, name, field) {
  const client = createClient();
  await registerUser(client, { type: "artist", name });
  expect((await client.post("/api/profile", { service: field })).ok).toBe(true);
  expect((await client.post("/api/artist/join-salon", { salonUserId })).ok).toBe(true);
}

describe("services linked to artists by their skills", () => {
  it("links automatically, keeps the salon's own choices, and picks up artists who join later", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Auto Salon" });
    await joinAs(salon.user.id, "Nail Artist A", "ناخن");
    await joinAs(salon.user.id, "Colour Artist", "رنگ مو");

    const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
    const byName = (name) => staff.find((person) => person.name === name || person.artist_name === name);
    const nailA = byName("Nail Artist A");
    const colour = byName("Colour Artist");

    const created = await salonClient.post("/api/salon-services", { name: "مانیکور", price: "300", duration: "۴۵ دقیقه" });
    expect(created.ok).toBe(true);
    const service = created.payload.data.service;
    expect(service.staff_ids).toEqual([String(nailA.id)]);
    expect(service.staff_auto_ids).toEqual([String(nailA.id)]);

    // The salon swaps the nail artist for the colourist by hand.
    const changed = await salonClient.patch("/api/salon-services", { id: service.id, name: service.name, staff_ids: [String(colour.id)] });
    expect(changed.ok).toBe(true);
    expect(changed.payload.data.service.staff_ids).toEqual([String(colour.id)]);

    // A second nail artist joins: linked automatically, the removed one stays removed.
    await joinAs(salon.user.id, "Nail Artist B", "ناخن، طراحی ناخن");
    const services = (await salonClient.get("/api/salon-services")).payload.data.services;
    const nailB = (await salonClient.get("/api/salon-staff")).payload.data.staff.find((p) => (p.artist_name || p.name) === "Nail Artist B");
    const now = services.find((item) => item.id === service.id);
    expect(now.staff_ids.sort()).toEqual([String(colour.id), String(nailB.id)].sort());
    expect(now.staff_ids).not.toContain(String(nailA.id));

  });
});
