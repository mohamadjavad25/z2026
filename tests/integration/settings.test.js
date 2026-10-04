import { describe, it, expect } from "vitest";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";

describe("profile settings", () => {
  it("saves toggles, keeps unrelated keys, and ignores unknown ones", async () => {
    const c = createClient();
    await registerUser(c, { type: "artist", name: "Settings Artist" });
    const first = await c.post("/api/profile/settings", { settings: { showPrices: false } });
    expect(first.ok).toBe(true);
    const second = await c.post("/api/profile/settings", { settings: { vacationMode: true, bogus: true } });
    expect(second.payload.data.settings.vacationMode).toBe(true);
    expect(second.payload.data.settings.showPrices).toBe(false);
    expect(second.payload.data.settings.bogus).toBeUndefined();
  });

  it("parallel saves of different keys don't overwrite each other", async () => {
    const c = createClient();
    await registerUser(c, { type: "client", name: "Parallel" });
    await Promise.all([
      c.post("/api/profile/settings", { settings: { showPrices: false } }),
      c.post("/api/profile/settings", { settings: { orderAlerts: false } }),
      c.post("/api/profile/settings", { settings: { publicPortfolio: false } })
    ]);
    const { settings } = (await c.get("/api/profile/settings")).payload.data;
    expect(settings.showPrices).toBe(false);
    expect(settings.orderAlerts).toBe(false);
    expect(settings.publicPortfolio).toBe(false);
  });

  it("a bad value gets a Persian error, not an English validation message", async () => {
    const c = createClient();
    await registerUser(c, { type: "client", name: "Bad" });
    const res = await c.post("/api/profile/settings", { settings: { showPrices: null } });
    expect(res.status).toBe(400);
    expect(res.payload.error).toMatch(/[؀-ۿ]/);
  });

  it("vacation mode / closed direct booking stop new artist bookings; autoConfirm confirms", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Vacation Artist" });
    const clientClient = createClient();
    await registerUser(clientClient, { type: "client", name: "Booker" });
    const body = (time) => ({
      artistUserId: artist.user.id, service: "ناخن", bookingDate: futureBookingDay(2), time
    });
    await artistClient.post("/api/profile/settings", { settings: { vacationMode: true } });
    expect((await clientClient.post("/api/artist/bookings", body("۱۰:۰۰"))).status).toBe(403);
    await artistClient.post("/api/profile/settings", { settings: { vacationMode: false, directBooking: false } });
    expect((await clientClient.post("/api/artist/bookings", body("۱۰:۰۰"))).status).toBe(403);
    await artistClient.post("/api/profile/settings", { settings: { directBooking: true, autoConfirm: true } });
    const ok = await clientClient.post("/api/artist/bookings", body("۱۱:۰۰"));
    expect(ok.status).toBe(201);
    expect(ok.payload.data.booking.status).toBe("تایید شده");
  });
});
