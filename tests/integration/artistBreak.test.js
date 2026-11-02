import { describe, it, expect } from "vitest";
import { createClient, registerUser, futureBookingDay } from "./helpers.js";
import { weekdayOfDateKey } from "../../app/shared/lib/artistBreak.js";

// The artist's break (owner's decision 2026-11-02): the daily window holds only on the days switched on, and
// «الان استراحت می‌کنم» holds from now, today only. The server refuses a booking inside either.
describe("artist break days and «now»", () => {
  const book = (client, date, time) => client.post("/api/artist/me", {
    kind: "booking", client: "Break Customer", phone: "09120000001", service: "کوتاهی مو", date, time
  });

  it("the daily window keeps bookings out only on its days", async () => {
    const artist = createClient();
    await registerUser(artist, { type: "artist", name: "Break Days Artist" });
    const day = futureBookingDay(2);
    const other = futureBookingDay(3);
    const saved = await artist.post("/api/artist/me", { kind: "break", startTime: "13:00", endTime: "14:00", days: [weekdayOfDateKey(day)] });
    expect(saved.ok).toBe(true);
    expect(saved.payload.data.breakTime.days).toEqual([weekdayOfDateKey(day)]);
    expect((await book(artist, day, "13:00")).status).toBe(409);
    expect((await book(artist, other, "13:00")).ok).toBe(true);

    // No day switched on is refused with a plain sentence.
    const none = await artist.post("/api/artist/me", { kind: "break", startTime: "13:00", endTime: "14:00", days: [] });
    expect(none.status).toBe(400);
  });

  it("«now» holds today only; ending it frees the time; clearing the window keeps it", async () => {
    const artist = createClient();
    await registerUser(artist, { type: "artist", name: "Break Now Artist" });
    expect((await artist.post("/api/artist/me", { kind: "break-now", minutes: 45 })).status).toBe(400);
    const started = await artist.post("/api/artist/me", { kind: "break-now", minutes: 30 });
    expect(started.ok).toBe(true);
    const now = started.payload.data.breakTime.now;
    expect(now.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(started.payload.data.breakTime.start).toBe("");

    // Clearing the (absent) daily window leaves the «now» break running.
    const cleared = await artist.post("/api/artist/me", { kind: "break", clear: true });
    expect(cleared.payload.data.breakTime?.now).toEqual(now);

    const ended = await artist.post("/api/artist/me", { kind: "break-now", minutes: 0 });
    expect(ended.ok).toBe(true);
    expect(ended.payload.data.breakTime).toBeNull();
    expect((await artist.get("/api/artist/me")).payload.data.breakTime).toBeNull();
  });
});
