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
});
