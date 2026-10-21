import { describe, it, expect, afterAll } from "vitest";
import { newSalon, newClient, bookSalon, settledSmsCount, hhmm, db, connected, futureBookingDay } from "./angle3Helpers.js";
afterAll(async () => { await connected; await db.end(); });
describe("explore", () => {
  it("abuse probes", async () => {
    const salon = await newSalon();
    const c = await newClient();
    const day = futureBookingDay(2);
    const r = await bookSalon(c, salon, { day, time: hhmm(10), service: "هرچی", extra: { durationMinutes: 600 } });
    console.log("unlisted 600min", r.status, JSON.stringify(r.payload).slice(0, 300));
    const c2 = await newClient();
    const r2 = await bookSalon(c2, salon, { day, time: hhmm(15) });
    console.log("second client afternoon", r2.status, JSON.stringify(r2.payload).slice(0, 200));
    const far = await bookSalon(c2, salon, { day: "1450-01-02", time: hhmm(15) });
    console.log("far future", far.status, JSON.stringify(far.payload).slice(0, 200));
    const far2 = await bookSalon(c2, salon, { day: "1406-01-02", time: hhmm(15) });
    console.log("next year", far2.status, JSON.stringify(far2.payload).slice(0, 200));
    const spoof = await bookSalon(c2, salon, { day: futureBookingDay(3), time: hhmm(15), extra: { phone: "09121111111", client: "رئیس جمهور" } });
    console.log("spoof", spoof.status, JSON.stringify(spoof.payload).slice(0, 300));
    // approve twice
    const list = await salon.client.get("/api/salon-bookings");
    const id = list.payload.data.bookings[0].id;
    const a1 = await salon.client.patch("/api/salon-bookings", { id, status: "تایید شده" });
    const a2 = await salon.client.patch("/api/salon-bookings", { id, status: "تایید شده" });
    const a3 = await salon.client.patch("/api/salon-bookings", { id, status: "تایید شده" });
    console.log("approve", a1.status, a2.status, a3.status, JSON.stringify(a2.payload).slice(0,200));
    console.log("answer sms", await settledSmsCount({ purpose: "booking_answer" }));
    const c1 = await salon.client.patch("/api/salon-bookings", { id, status: "لغو" });
    const c1b = await salon.client.patch("/api/salon-bookings", { id, status: "لغو" });
    console.log("cancel twice", c1.status, c1b.status, JSON.stringify(c1b.payload).slice(0,200));
    console.log("answer sms after", await settledSmsCount({ purpose: "booking_answer" }));
  });
});
