import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

const pin = { lat: 35.7301, lng: 51.4112 };

describe("«کجاست؟»: a salon's or artist's map pin on their public page", () => {
  it("a salon saves its pin and plate / floor, and the public page carries them", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Location Salon" });
    const saved = await salonClient.post("/api/profile", {
      data: { area: "تهران، یوسف‌آباد، خیابان اسدآبادی", geo: pin, addressDetail: "پلاک ۸، طبقه ۲" }
    });
    expect(saved.ok).toBe(true);
    expect(saved.payload.data.user.location).toEqual({
      address: "تهران، یوسف‌آباد، خیابان اسدآبادی", detail: "پلاک ۸، طبقه ۲", ...pin
    });

    // The owner's own session (what تنظیمات reads) carries the pin too.
    const me = await salonClient.get("/api/auth/me");
    expect(me.payload.data.user.location).toEqual({ address: "تهران، یوسف‌آباد، خیابان اسدآبادی", detail: "پلاک ۸، طبقه ۲", ...pin });

    const visitor = createClient();
    const page = await visitor.get(`/api/salons/${salon.user.id}`);
    const shown = page.payload.data?.salon || page.payload.salon;
    expect(shown.location).toEqual({ address: "تهران، یوسف‌آباد، خیابان اسدآبادی", detail: "پلاک ۸، طبقه ۲", ...pin });
  });

  it("an artist's pin shows on the artist page; a profile edit without geo keeps it; null removes it", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Location Artist" });
    await artistClient.post("/api/profile", { data: { area: "تهران، ونک", geo: pin, addressDetail: "واحد ۳" } });

    // Editing the name (the edit-profile form never sends geo) must not lose the pin.
    await artistClient.post("/api/profile", { data: { name: "Location Artist 2" } });
    const visitor = createClient();
    let page = await visitor.get(`/api/artists/${artist.user.id}`);
    let shown = page.payload.data?.artist || page.payload.artist;
    expect(shown.location).toEqual({ address: "تهران، ونک", detail: "واحد ۳", ...pin });

    await artistClient.post("/api/profile", { data: { area: "", geo: null, addressDetail: "" } });
    page = await visitor.get(`/api/artists/${artist.user.id}`);
    shown = page.payload.data?.artist || page.payload.artist;
    expect(shown.location).toBeNull();
  });

  it("an address without a pin is shown as text only", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Text Only Salon" });
    await salonClient.post("/api/profile", { data: { area: "شیراز، معالی‌آباد" } });
    const page = await createClient().get(`/api/salons/${salon.user.id}`);
    const shown = page.payload.data?.salon || page.payload.salon;
    expect(shown.location).toEqual({ address: "شیراز، معالی‌آباد", detail: "", lat: null, lng: null });
  });

  it("rejects a pin off the globe or half a pin", async () => {
    const c = createClient();
    await registerUser(c, { type: "salon", name: "Bad Pin Salon" });
    expect((await c.post("/api/profile", { data: { area: "تهران", geo: { lat: 135, lng: 51 } } })).status).toBe(400);
    expect((await c.post("/api/profile", { data: { area: "تهران", geo: { lat: 35.7 } } })).status).toBe(400);
    expect((await c.post("/api/profile", { data: { area: "تهران", geo: { lat: "35.7", lng: "51.4" } } })).status).toBe(400);
  });
});
