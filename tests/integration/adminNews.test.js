import { describe, it, expect, afterAll } from "vitest";
import { closeDb, q, newSalon, cron } from "./angle2Util.js";

afterAll(closeDb);

describe("operator news", () => {
  it("a sign-up is remembered for the running count, with its name", async () => {
    const name = `Glare ${Date.now() % 100000}`;
    await newSalon(name);
    // Fire-and-forget after the answer: give it a moment.
    let row;
    for (let i = 0; i < 20 && !row?.last_push_at; i += 1) {
      [row] = await q("SELECT pending, last_label, last_push_at FROM admin_news WHERE kind = 'signups'");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(row).toBeTruthy();
    expect(row.last_label).toContain("سالن");
  });

  it("the five-minute job reads the server and answers", async () => {
    const res = await cron("admin-watch", {});
    expect(res.status).toBe(200);
    const { watch, news } = res.payload.data;
    expect(typeof watch.reading.cpu).toBe("number");
    expect(watch.reading.disk).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(news.told)).toBe(true);
    const [state] = await q("SELECT state FROM admin_news WHERE kind = 'server'");
    expect(state.state).toHaveProperty("busyDays");
  });
});
