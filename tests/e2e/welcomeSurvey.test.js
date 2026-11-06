import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser } from "../integration/helpers.js";
import { q } from "../integration/angle2Util.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

const FORM = "مثلاً: وقتی نوبت رو عوض کردم، مشتری خبردار نشد.";

/** An artist who has really started, with the tutorial behind them, last seen `daysAway` days ago. */
async function startedArtist(name, daysAway) {
  const api = createClient();
  const { user } = await registerUser(api, { type: "artist", name });
  await q("UPDATE users SET created_at = NOW() - INTERVAL '10 days', last_seen_at = NOW() - ($2 || ' days')::interval WHERE id = $1", [user.id, String(daysAway)]);
  await q(`INSERT INTO user_settings (user_id, settings) VALUES ($1, '{"tutorialPending": false}')
           ON CONFLICT (user_id) DO UPDATE SET settings = user_settings.settings || '{"tutorialPending": false}'`, [user.id]);
  for (let i = 0; i < 4; i += 1) await q("INSERT INTO posts (owner_user_id, title, tag, caption, is_public) VALUES ($1, 'کار', 'مو', 'توضیح', TRUE)", [user.id]);
  await q("INSERT INTO artist_services (user_id, name, price, duration) VALUES ($1, 'رنگ مو', 'از ۲ تومن', '۲ ساعت')", [user.id]);
  return { api, user };
}

/** The come-back nudge (owner, 2026-11-06): the first visit after three days away opens the «نظر و پیشنهاد» form by itself. */
describe("the come-back nudge (browser)", () => {
  it("opens the feedback form on the visit that ends three days away, and closing it puts the nudge off", async () => {
    const { api, user } = await startedArtist("نگار نمونه", 4);
    const { page, context } = await newPage({ cookie: api.cookie() });
    await page.goto(`${TEST_BASE_URL}/`, { waitUntil: "networkidle" });
    const form = page.getByPlaceholder(FORM);
    await form.waitFor({ timeout: 15000 });
    await page.keyboard.press("Escape");
    await form.waitFor({ state: "detached" });
    await expect.poll(async () => (await q("SELECT later_count FROM welcome_surveys WHERE user_id = $1", [user.id]))[0]?.later_count).toBe(1);
    await context.close();
  }, 40000);

  it("does not come to someone who was here yesterday", async () => {
    const { api } = await startedArtist("سحر نمونه", 1);
    const { page, context } = await newPage({ cookie: api.cookie() });
    await page.goto(`${TEST_BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    expect(await page.getByPlaceholder(FORM).count()).toBe(0);
    await context.close();
  });
});
