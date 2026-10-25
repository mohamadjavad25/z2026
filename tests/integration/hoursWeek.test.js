import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

// The hours sheet saves the whole week with one «ذخیره» (PATCH { hours: [...] }): all days or none.
describe("saving the working week at once", () => {
  for (const [type, path] of [["salon", "/api/salon-hours"], ["artist", "/api/artist-hours"]]) {
    it(`${type}: several days in one request, and a bad day saves nothing`, async () => {
      const client = createClient();
      await registerUser(client, { type, name: `Hours Week ${type}` });
      const before = (await client.get(path)).payload.data.hours;

      const saved = await client.patch(path, {
        hours: [
          { day: "شنبه", open_time: "۱۲:۰۰", close_time: "۲۱:۰۰", active: true },
          { day: "جمعه", open_time: "۰۹:۰۰", close_time: "۱۴:۰۰", active: true },
          { day: "یکشنبه", active: false }
        ]
      });
      expect(saved.ok).toBe(true);
      const byDay = new Map(saved.payload.data.hours.map((row) => [row.day, row]));
      expect(byDay.get("شنبه")).toMatchObject({ open_time: "۱۲:۰۰", close_time: "۲۱:۰۰", active: true });
      expect(byDay.get("جمعه")).toMatchObject({ open_time: "۰۹:۰۰", close_time: "۱۴:۰۰", active: true });
      expect(byDay.get("یکشنبه").active).toBe(false);
      // Days not sent keep what they had.
      const monday = before.find((row) => row.day === "دوشنبه");
      expect(byDay.get("دوشنبه")).toMatchObject({ open_time: monday.open_time, close_time: monday.close_time });

      const refused = await client.patch(path, {
        hours: [
          { day: "دوشنبه", open_time: "۰۸:۰۰", close_time: "۱۲:۰۰", active: true },
          { day: "سه‌شنبه", open_time: "۱۸:۰۰", close_time: "۱۰:۰۰", active: true }
        ]
      });
      expect(refused.ok).toBe(false);
      const after = (await client.get(path)).payload.data.hours.find((row) => row.day === "دوشنبه");
      expect(after.open_time).toBe(monday.open_time);

      expect((await client.patch(path, { hours: [] })).ok).toBe(false);
      expect((await client.patch(path, { hours: [{ day: "شنبه", active: true }, { day: "شنبه", active: false }] })).ok).toBe(false);
    });
  }
});
