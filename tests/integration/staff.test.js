import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

describe("salon staff", () => {
  it("cannot be created by hand: there is no POST /api/salon-staff", async () => {
    const salonClient = createClient();
    await registerUser(salonClient, { type: "salon", name: "Staff Test Salon" });
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Some Artist" });

    // Neither a free-text member nor attaching a real artist's account without their consent.
    const manual = await salonClient.post("/api/salon-staff", { name: "عضو دستی", role: "آرتیست" });
    expect(manual.ok).toBe(false);
    expect(manual.status).toBe(405);

    const attach = await salonClient.post("/api/salon-staff", { artistUserId: artist.user.id, name: "x" });
    expect(attach.ok).toBe(false);

    const list = await salonClient.get("/api/salon-staff");
    expect(list.ok).toBe(true);
    expect(list.payload.data.staff).toEqual([]);
  });

  it("the artist owns their field of activity; the salon cannot change it", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Owner Salon" });
    const artistClient = createClient();
    await registerUser(artistClient, { type: "artist", name: "Field Artist" });

    const join = await artistClient.post("/api/artist/join-salon", { salonUserId: salon.user.id });
    expect(join.ok).toBe(true);

    const set = await artistClient.post("/api/profile", { data: { service: "ناخن‌کار، میکاپ آرتیست" } });
    expect(set.ok).toBe(true);

    let staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
    expect(staff).toHaveLength(1);
    expect(staff[0].role).toBe("ناخن‌کار، میکاپ آرتیست");

    // The salon tries to overwrite the field, the identity and the phone: all ignored.
    const patch = await salonClient.patch("/api/salon-staff", {
      id: staff[0].id, role: "رنگ و لایت", name: "نام جعلی", phone: "09120000000", state: "غیرفعال"
    });
    expect(patch.ok).toBe(true);
    staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
    expect(staff[0].role).toBe("ناخن‌کار، میکاپ آرتیست");
    expect(staff[0].name).not.toBe("نام جعلی");
    expect(staff[0].phone).not.toBe("09120000000");
    // ...but state is the salon's to manage.
    expect(staff[0].state).toBe("غیرفعال");

    // The artist changes their own field and the salon sees it.
    await artistClient.post("/api/profile", { data: { service: "رنگ و لایت" } });
    staff = (await salonClient.get("/api/salon-staff")).payload.data.staff;
    expect(staff[0].role).toBe("رنگ و لایت");
  });
});
