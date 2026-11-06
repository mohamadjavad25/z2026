import { describe, it, expect } from "vitest";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { adminClient, createClient, registerUser } from "./helpers.js";
import { q } from "./angle2Util.js";

/** A salon or artist who has really started: an old enough account with posts and services of their own. */
async function startedArtist(name = "ارزو", { posts = 3, services = 2, price = "از ۲ تومن" } = {}) {
  const api = createClient();
  const { user } = await registerUser(api, { type: "artist", name });
  await q("UPDATE users SET created_at = NOW() - INTERVAL '3 hours', last_seen_at = NOW() - INTERVAL '4 days' WHERE id = $1", [user.id]);
  for (let i = 0; i < posts; i += 1) await q("INSERT INTO posts (owner_user_id, title, tag, caption, is_public) VALUES ($1, 'کار', 'مو', 'توضیح', TRUE)", [user.id]);
  for (let i = 0; i < services; i += 1) await q("INSERT INTO artist_services (user_id, name, price, duration) VALUES ($1, $2, $3, '۱ ساعت')", [user.id, `خدمت ${i}`, price]);
  return { api, user };
}

const surveyOf = async (api) => (await api.get("/api/welcome-survey")).payload.data.survey;

describe("welcome survey", () => {
  it("comes with the person's own name and numbers, and what their page still needs", async () => {
    const { api } = await startedArtist("ارزو تست");
    const survey = await surveyOf(api);
    expect(survey).toMatchObject({ role: "artist", name: "ارزو تست", facts: { posts: 3, services: 2 } });
    const step = (id) => survey.steps.find((item) => item.id === id);
    expect(step("posts").done).toBe(true);
    expect(step("avatar").done).toBe(false);
    expect(step("prices").done).toBe(false); // «از ۲ تومن»
  });

  it("waits until they have really started, and for their first two hours", async () => {
    const fresh = createClient();
    const { user } = await registerUser(fresh, { type: "artist", name: "تازه" });
    expect(await surveyOf(fresh)).toBe(null);
    await q("UPDATE users SET created_at = NOW() - INTERVAL '3 hours' WHERE id = $1", [user.id]);
    expect(await surveyOf(fresh)).toBe(null); // old enough, nothing done
    const { api } = await startedArtist("نو", { posts: 3, services: 0 });
    await q("UPDATE users SET created_at = NOW() WHERE id = (SELECT id FROM users WHERE name = 'نو' ORDER BY id DESC LIMIT 1)");
    expect(await surveyOf(api)).toBe(null); // done enough, too new
  });

  it("comes only after a few days away, or after the push was sent (owner 2026-11-06)", async () => {
    const { api, user } = await startedArtist("تازه‌دیده");
    await q("UPDATE users SET last_seen_at = NOW() - INTERVAL '1 day' WHERE id = $1", [user.id]);
    expect(await surveyOf(api)).toBe(null); // seen yesterday: no card, no push
    await q("UPDATE users SET last_seen_at = NOW() - INTERVAL '3 days 1 hour' WHERE id = $1", [user.id]);
    expect(await surveyOf(api)).not.toBe(null);
    // They tapped the push: opening the app has already refreshed last_seen_at, and the card must still come.
    await q("UPDATE users SET last_seen_at = NOW() WHERE id = $1", [user.id]);
    expect(await surveyOf(api)).toBe(null);
    await q("INSERT INTO welcome_surveys (user_id, pushed_at) VALUES ($1, NOW()) ON CONFLICT (user_id) DO UPDATE SET pushed_at = NOW()", [user.id]);
    expect(await surveyOf(api)).not.toBe(null);
  });

  it("never pushes someone the footprint has not seen yet", async () => {
    const { user } = await startedArtist("ندیده");
    await q("UPDATE users SET last_seen_at = NULL WHERE id = $1", [user.id]);
    await q("INSERT INTO native_push_tokens (user_id, token) VALUES ($1, $2)", [user.id, `survey-null-${user.id}`]);
    await fetch(`${TEST_BASE_URL}/api/cron/send-reminders`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}`, "Content-Type": "application/json" }, body: JSON.stringify({ now: "2026-11-05T08:00:00Z" }) });
    expect((await q("SELECT pushed_at FROM welcome_surveys WHERE user_id = $1", [user.id]))[0]?.pushed_at).toBeUndefined();
  });

  it("is done for good once the person sends a note from the support form", async () => {
    const { api, user } = await startedArtist("فرم‌فرست");
    expect(await surveyOf(api)).not.toBe(null);
    expect((await api.post("/api/welcome-survey", { action: "done" })).ok).toBe(true);
    expect((await q("SELECT answered_at FROM welcome_surveys WHERE user_id = $1", [user.id]))[0].answered_at).toBeTruthy();
    expect(await surveyOf(api)).toBe(null);
  });

  it("is not shown to a guest", async () => {
    expect((await createClient().get("/api/welcome-survey")).status).toBe(401);
  });

  it("saves one answer from the session's account, keeps only known parts, and never comes back", async () => {
    const { api, user } = await startedArtist("جواب‌ده");
    expect((await api.post("/api/welcome-survey", { action: "answer", feel: 1, parts: ["photos", "made-up", "photos"], idea: "  کاش چند عکس با هم  ", userId: 1 })).ok).toBe(true);
    expect((await api.post("/api/welcome-survey", { action: "answer", feel: 4, parts: ["none"] })).ok).toBe(true);
    const [row] = await q("SELECT feel, parts, idea FROM welcome_surveys WHERE user_id = $1", [user.id]);
    expect(row).toMatchObject({ feel: 1, parts: ["photos"], idea: "کاش چند عکس با هم" });
    expect(await surveyOf(api)).toBe(null);
  });

  it("drops the other parts when nothing was hard", async () => {
    const { api, user } = await startedArtist("راحت");
    await api.post("/api/welcome-survey", { action: "answer", feel: 4, parts: ["photos", "none"] });
    expect((await q("SELECT parts FROM welcome_surveys WHERE user_id = $1", [user.id]))[0].parts).toEqual(["none"]);
  });

  it("refuses an answer it cannot read", async () => {
    const { api } = await startedArtist("بد");
    expect((await api.post("/api/welcome-survey", { action: "answer", feel: 9, parts: [] })).status).toBe(400);
    expect((await api.post("/api/welcome-survey", { action: "nope" })).status).toBe(400);
  });

  it("«بعداً» waits three days, and the second one ends it for good", async () => {
    const { api, user } = await startedArtist("بعدی");
    await api.post("/api/welcome-survey", { action: "later" });
    expect(await surveyOf(api)).toBe(null);
    await q("UPDATE welcome_surveys SET next_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1", [user.id]);
    expect(await surveyOf(api)).not.toBe(null);
    await api.post("/api/welcome-survey", { action: "later" });
    await q("UPDATE welcome_surveys SET next_at = NOW() - INTERVAL '1 minute' WHERE user_id = $1", [user.id]);
    expect(await surveyOf(api)).toBe(null);
  });

  it("sends its one push only in the daytime, only to someone with a phone, and never twice", async () => {
    const { user } = await startedArtist("اعلانی");
    const { user: noPhone } = await startedArtist("بی‌گوشی");
    await q("INSERT INTO native_push_tokens (user_id, token) VALUES ($1, $2)", [user.id, `survey-test-${user.id}`]);
    const pushedAt = async (id) => (await q("SELECT pushed_at FROM welcome_surveys WHERE user_id = $1", [id]))[0]?.pushed_at;
    const sweep = (now) => fetch(`${TEST_BASE_URL}/api/cron/send-reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ now })
    });

    expect((await sweep("2026-11-05T22:00:00Z")).ok).toBe(true); // 01:30 in Tehran
    expect(await pushedAt(user.id)).toBeUndefined();

    expect((await sweep("2026-11-05T08:00:00Z")).ok).toBe(true); // 11:30 in Tehran
    const first = await pushedAt(user.id);
    expect(first).toBeTruthy();
    expect(await pushedAt(noPhone.id)).toBeUndefined();

    await sweep("2026-11-05T09:00:00Z");
    expect(await pushedAt(user.id)).toEqual(first);
  });

  it("shows the admin who said what", async () => {
    const { api, user } = await startedArtist("گزارشی");
    await api.post("/api/welcome-survey", { action: "answer", feel: 3, parts: ["hours"], idea: "ساعت‌ها گیجم کرد" });
    const admin = await adminClient();
    const res = await admin.get("/api/admin/welcome-survey");
    expect(res.ok).toBe(true);
    expect(res.payload.data.answers.find((row) => row.user_id === user.id)).toMatchObject({ name: "گزارشی", feel: 3, parts: ["hours"], idea: "ساعت‌ها گیجم کرد" });
    expect((await createClient().get("/api/admin/welcome-survey")).status).toBe(403);
  });

  it("still comes on the visit that ends the absence, although the footprint refreshed last_seen_at first (the browser's race)", async () => {
    const { api, user } = await startedArtist("برگشته");
    expect(await surveyOf(api)).not.toBe(null); // away four days
    // What the page does 1.5 s after it opens: its first footprint send, before the card is asked for.
    const first = await api.post("/api/activity", { visitor: "return-visitor-0001", visit: "return-visit-0000001", events: [{ k: "screen", n: "home", ago: 0 }] });
    expect(first.status).toBe(204);
    expect((await q("SELECT last_seen_at > NOW() - INTERVAL '1 minute' AS fresh FROM users WHERE id = $1", [user.id]))[0].fresh).toBe(true);
    expect(await surveyOf(api)).not.toBe(null); // this visit began after four days away

    // A later visit (the last one ended over half an hour ago) is an ordinary one.
    await q("UPDATE users SET last_seen_at = NOW() - INTERVAL '40 minutes' WHERE id = $1", [user.id]);
    await api.post("/api/activity", { visitor: "return-visitor-0001", visit: "return-visit-0000002", events: [{ k: "screen", n: "home", ago: 0 }] });
    expect(await surveyOf(api)).toBe(null);
  });

  it("pushes at most the daily cap in any 24 hours, and the rest wait for the next day", async () => {
    const sweep = () => fetch(`${TEST_BASE_URL}/api/cron/send-reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_CRON_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ now: "2026-11-05T08:00:00Z" }) // 11:30 in Tehran
    });
    const pushedAt = async (id) => (await q("SELECT pushed_at FROM welcome_surveys WHERE user_id = $1", [id]))[0]?.pushed_at;
    const { user: waiting } = await startedArtist("منتظر سقف");
    await q("INSERT INTO native_push_tokens (user_id, token) VALUES ($1, $2)", [waiting.id, `survey-cap-${waiting.id}`]);
    // Fill the day: enough pushes already went out in the last 24 hours.
    const filler = [];
    for (let i = 0; i < 20; i += 1) {
      const api = createClient();
      const { user } = await registerUser(api, { type: "artist", name: `پر کن ${i}` });
      await q("INSERT INTO welcome_surveys (user_id, pushed_at) VALUES ($1, NOW())", [user.id]);
      filler.push(user.id);
    }
    expect((await sweep()).ok).toBe(true);
    expect(await pushedAt(waiting.id)).toBeUndefined(); // the day is full

    await q("UPDATE welcome_surveys SET pushed_at = NOW() - INTERVAL '2 days' WHERE user_id = ANY($1)", [filler.slice(0, 5)]);
    expect((await sweep()).ok).toBe(true);
    expect(await pushedAt(waiting.id)).toBeTruthy(); // room again
  });
});
