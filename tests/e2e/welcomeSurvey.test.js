import { afterAll, describe, expect, it } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser } from "../integration/helpers.js";
import { q } from "../integration/angle2Util.js";
import { closeBrowser, newPage } from "./browser.js";

afterAll(closeBrowser);

/** An artist who has really started, with the tutorial behind them. */
async function startedArtist(name) {
  const api = createClient();
  const { user } = await registerUser(api, { type: "artist", name });
  await q("UPDATE users SET created_at = NOW() - INTERVAL '3 hours' WHERE id = $1", [user.id]);
  await q(`INSERT INTO user_settings (user_id, settings) VALUES ($1, '{"tutorialPending": false}')
           ON CONFLICT (user_id) DO UPDATE SET settings = user_settings.settings || '{"tutorialPending": false}'`, [user.id]);
  for (let i = 0; i < 4; i += 1) await q("INSERT INTO posts (owner_user_id, title, tag, caption, is_public) VALUES ($1, 'کار', 'مو', 'توضیح', TRUE)", [user.id]);
  await q("INSERT INTO artist_services (user_id, name, price, duration) VALUES ($1, 'رنگ مو', 'از ۲ تومن', '۲ ساعت')", [user.id]);
  return { api, user };
}

describe("welcome survey (browser)", () => {
  it("greets by name, takes three answers, and ends on what the page still needs", async () => {
    const { api, user } = await startedArtist("نگار نمونه");
    const { page, context, problems } = await newPage({ cookie: api.cookie() });
    await page.goto(`${TEST_BASE_URL}/`, { waitUntil: "networkidle" });

    await page.getByRole("heading", { name: "نگار نمونه جان، خوش اومدی!" }).waitFor({ timeout: 15000 });
    await page.getByText("۴ تا نمونه‌کار و ۱ تا خدمت گذاشتی").waitFor();
    await page.getByRole("button", { name: "بگو چطور بود" }).click();

    const next = page.getByRole("button", { name: "بعدی", exact: true });
    expect(await next.isDisabled()).toBe(true);
    await page.getByRole("button", { name: "سخت", exact: true }).click();
    await next.click();

    await page.getByRole("heading", { name: "کجاش اذیتت کرد؟" }).waitFor();
    await page.getByRole("button", { name: "گذاشتن عکس" }).click();
    await next.click();

    await page.fill("#wsIdea", "کاش چند تا عکس رو با هم می‌شد گذاشت");
    await page.getByRole("button", { name: "بفرست" }).click();

    await page.getByRole("heading", { name: "مرسی نگار نمونه جان!" }).waitFor();
    await page.getByRole("button", { name: /عکس پروفایل/ }).waitFor();
    await page.getByRole("button", { name: /نوشتن قیمت‌ها/ }).waitFor();
    const [row] = await q("SELECT feel, parts, idea FROM welcome_surveys WHERE user_id = $1", [user.id]);
    expect(row).toMatchObject({ feel: 1, parts: ["photos"], idea: "کاش چند تا عکس رو با هم می‌شد گذاشت" });

    // A tap on what is left goes straight to that part of the app.
    await page.getByRole("button", { name: /عکس پروفایل/ }).click();
    await page.locator(".wsRoot").waitFor({ state: "detached" });

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    expect(await page.locator(".wsRoot").count()).toBe(0);
    expect(problems).toEqual([]);
    await context.close();
  });

  it("«بعداً» closes it and it stays closed", async () => {
    const { api, user } = await startedArtist("سحر نمونه");
    const { page, context } = await newPage({ cookie: api.cookie() });
    await page.goto(`${TEST_BASE_URL}/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "بعداً", exact: true }).click({ timeout: 15000 });
    await page.locator(".wsRoot").waitFor({ state: "detached" });
    await expect.poll(async () => (await q("SELECT later_count FROM welcome_surveys WHERE user_id = $1", [user.id]))[0]?.later_count).toBe(1);
    await context.close();
  });
});
