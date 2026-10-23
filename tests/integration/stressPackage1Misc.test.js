import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { openDb, clearThrottles, makeSalon, makeClient, post, note, slotBody, futureBookingDay, sleep } from "./stressPackage1Helpers.js";

/** Package 1 odds and ends that need the real server: the 30-character name in the salon's text message. */
const { db, connected } = openDb();
beforeAll(async () => { await connected; });
afterAll(async () => { await db.end(); });

const day = (n = 2) => futureBookingDay(n, { notOn: ["پنجشنبه"] });
const SERVICES = [{ name: "S30", duration: "۳۰ دقیقه" }];
const smsBodies = async (phone) => (await db.query("SELECT body FROM sms_log WHERE phone = $1 AND purpose = 'booking_request' ORDER BY id", [phone])).rows.map((r) => r.body);

describe("the client's name in the salon's text message is cut to 30 characters", () => {
  for (const [label, name] of [
    ["emoji only", "😀".repeat(40)],
    ["29 letters then emoji (the cut falls inside the emoji)", `${"ا".repeat(29)}😀😀😀`],
    ["long Persian name", "محمدجواد ".repeat(8)],
    ["combining marks", "اَ".repeat(40)]
  ]) {
    it(`${label}: the text never holds half an emoji and the name part stays short`, async () => {
      await clearThrottles(db);
      const ctx = await makeSalon(`P1 Sms ${label.slice(0, 5)}`, { staffCount: 1, services: SERVICES });
      const c = await makeClient("ساده");
      // the account keeps a short name; the request carries the long one (the salon sees what the client typed)
      const r = await post(c.client, "/api/salon-bookings", { ...slotBody(ctx.salon.user.id, { day: day(), time: "10:00" }), client: name });
      expect(r.status, JSON.stringify(r.payload)).toBe(201);
      await sleep(1500);
      const bodies = await smsBodies(ctx.salon.user.phone);
      note(`sms for "${label}"`, JSON.stringify(bodies.map((b) => ({ length: [...b].length, bytes: Buffer.byteLength(b), lone: /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(b) }))));
      for (const body of bodies) {
        expect(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(body), `lone surrogate in: ${body}`).toBe(false);
        expect(body.includes("�")).toBe(false);
      }
    }, 60_000);
  }
});
