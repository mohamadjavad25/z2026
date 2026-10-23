import { describe, it, expect } from "vitest";
import { createClient, joinSalonAsArtist, registerUser, futureBookingDay } from "./helpers.js";
import { TEST_BASE_URL } from "../globalSetup.js";

describe("salon manager working on their own team", () => {
  it("joins as a member, gets services and bookings, and is never linked to a same-named artist", async () => {
    // An artist account that happens to share the manager's name must not be attached to their row.
    const artistClient = createClient();
    await registerUser(artistClient, { type: "artist", name: "Maryam Owner" });

    const salonClient = createClient();
    await registerUser(salonClient, { type: "salon", name: "Owner Salon" });
    await salonClient.get("/api/salon-hours");

    const joined = await salonClient.post("/api/salon-staff/self", { name: "Maryam Owner", role: "ناخن‌کار، میکاپ آرتیست" });
    expect(joined.ok).toBe(true);
    const me = joined.payload.data.person;
    expect(me.is_owner).toBe(true);
    expect(me.artist_user_id).toBeNull();
    expect(me.role).toBe("ناخن‌کار، میکاپ آرتیست");
    const staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
    expect(staff.filter((person) => person.is_owner)).toHaveLength(1);
    expect(staff.find((person) => person.is_owner).artist_user_id).toBeNull();

    // Joining again updates the same row instead of adding a second one.
    expect((await salonClient.post("/api/salon-staff/self", { name: "Maryam Owner" })).ok).toBe(true);
    expect((await salonClient.get("/api/salon-staff")).payload.data.staff.filter((p) => p.is_owner)).toHaveLength(1);

    // A service can be given to the manager.
    const service = await salonClient.post("/api/salon-services", { name: "مانیکور", price: "200", duration: "۶۰ دقیقه", staff_ids: [String(me.id)] });
    expect(service.ok).toBe(true);
    const services = (await salonClient.get("/api/salon-services")).payload.data.services;
    expect(services.find((item) => item.name === "مانیکور").staff_members.map((p) => p.name)).toContain("Maryam Owner");

    // Booking for the manager, and their time is then taken.
    const day = futureBookingDay(2);
    const first = await salonClient.post("/api/salon-bookings", { service: "مانیکور", staff: "Maryam Owner", bookingDate: day, time: "۱۱:۰۰", client: "A" });
    expect(first.ok).toBe(true);
    const clash = await salonClient.post("/api/salon-bookings", { service: "مانیکور", staff: "Maryam Owner", bookingDate: day, time: "۱۱:۳۰", client: "B" });
    expect(clash.status).toBe(409);

    // Renaming keeps the bookings on the manager.
    const renamed = await salonClient.patch("/api/salon-staff", { id: me.id, name: "Maryam" });
    expect(renamed.ok).toBe(true);
    const bookings = (await salonClient.get("/api/salon-bookings")).payload.data.bookings;
    expect(bookings.find((b) => b.client === "A").staff).toBe("Maryam");

    // Leaving the team is the usual delete, but a confirmed booking still ahead is never dropped silently (owner's rules of
    // 2026-10-22): the server asks for a choice first, and «لغو همهٔ نوبت‌ها» settles all of them with notice.
    const asked = await salonClient.delete("/api/salon-staff", { id: me.id });
    expect(asked.status).toBe(409);
    expect(asked.payload.code).toBe("HAS_BOOKINGS");
    expect((await salonClient.delete("/api/salon-staff", { id: me.id, cancelAll: true })).ok).toBe(true);
    expect((await salonClient.get("/api/salon-staff")).payload.data.staff.some((p) => p.is_owner)).toBe(false);
  });

  it("remembers the manager's card after leaving, so switching back on is one tap, and serves their own photo", async () => {
    const salonClient = createClient();
    await registerUser(salonClient, { type: "salon", name: "Remember Salon" });
    expect((await salonClient.get("/api/salon-staff/self")).payload.data.profile.saved).toBe(false);

    // A 1x1 PNG as the manager's own photo.
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const joined = await salonClient.post("/api/salon-staff/self", { name: "Sara", role: "ناخن‌کار", photo: png });
    expect(joined.ok).toBe(true);
    const me = joined.payload.data.person;
    expect(me.avatar).toMatch(/^\/api\/media\/team-photo\/\d+\?v=\d+$/);
    const photo = await fetch(`${TEST_BASE_URL}${me.avatar}`);
    expect(photo.status).toBe(200);
    expect(photo.headers.get("content-type")).toBe("image/png");

    expect((await salonClient.delete("/api/salon-staff", { id: me.id })).ok).toBe(true);
    const kept = (await salonClient.get("/api/salon-staff/self")).payload.data.profile;
    expect(kept).toMatchObject({ saved: true, name: "Sara", role: "ناخن‌کار", useOwnPhoto: true });

    // Switching back on sends nothing: the saved name, fields and photo come back.
    const back = await salonClient.post("/api/salon-staff/self", {});
    expect(back.ok).toBe(true);
    expect(back.payload.data.person).toMatchObject({ name: "Sara", role: "ناخن‌کار" });
    expect(back.payload.data.person.avatar).toContain("/api/media/team-photo/");

    // Back to the salon's picture (the salon has none here, so no avatar), and a non-image is refused.
    const salonPic = await salonClient.post("/api/salon-staff/self", { photo: "salon" });
    expect(salonPic.payload.data.person.avatar).toBe("");
    expect((await salonClient.post("/api/salon-staff/self", { photo: "data:text/html;base64,PGI+" })).status).toBe(400);
  });

  it("refuses a name another member already has, and is for salons only", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Clash Salon" });
    const artistClient = createClient();
    await registerUser(artistClient, { type: "artist", name: "Taken Name" });
    expect((await joinSalonAsArtist(artistClient, salonClient, salon.user.id)).ok).toBe(true);
    const memberName = (await salonClient.get("/api/salon-staff")).payload.data.staff[0].name;
    const clash = await salonClient.post("/api/salon-staff/self", { name: memberName });
    expect(clash.status).toBe(409);

    const clientClient = createClient();
    await registerUser(clientClient, { type: "client", name: "Not A Salon" });
    expect((await clientClient.post("/api/salon-staff/self", { name: "x" })).ok).toBe(false);
  });
});
