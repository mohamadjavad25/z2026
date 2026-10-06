import { describe, it, expect, afterAll } from "vitest";
import pg from "pg";
import { TEST_BASE_URL, TEST_CRON_SECRET } from "../globalSetup.js";
import { createClient, registerUser } from "./helpers.js";

// 1x1 PNG and a second, different one (so a replacement is distinguishable).
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG2 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const db = new pg.Client({ connectionString: process.env.TEST_POSTGRES_URL });
const connected = db.connect();
afterAll(async () => { await connected; await db.end(); });

async function row(sql, params) {
  await connected;
  return (await db.query(sql, params)).rows[0];
}

async function until(check, label) {
  for (let i = 0; i < 60; i += 1) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`timed out waiting for ${label}`);
}

const media = (path, headers = {}) => fetch(`${TEST_BASE_URL}${path}`, { headers });

describe.skipIf(process.env.TEST_STORAGE === "off")("pictures live in Storage", () => {
  it("a new avatar goes to Storage, is served, revalidates with a 304, and is removed with its object", async () => {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name: "Storage Avatar" });
    const saved = await client.post("/api/profile", { avatar: PNG });
    expect(saved.ok).toBe(true);

    const stored = await row("SELECT length(avatar) AS size, avatar_url FROM users WHERE id = $1", [user.id]);
    expect(stored.avatar_url).toContain("/storage/v1/object/public/media/avatar/");
    expect(stored.size).toBe(0); // the database no longer holds the bytes
    expect((await fetch(stored.avatar_url)).status).toBe(200);

    // Still counts as "has a picture" everywhere (login / session payload).
    const me = await client.get("/api/auth/me");
    expect(me.payload.data.user.avatar).toContain(`/api/media/avatar/${user.id}`);

    const first = await media(`/api/media/avatar/${user.id}`);
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("image/png");
    const etag = first.headers.get("etag");
    expect(etag).toBeTruthy();
    expect((await media(`/api/media/avatar/${user.id}`, { "If-None-Match": etag })).status).toBe(304);

    // Replacing it changes the fingerprint (and drops the old object).
    await client.post("/api/profile", { avatar: PNG2 });
    const replaced = await media(`/api/media/avatar/${user.id}`, { "If-None-Match": etag });
    expect(replaced.status).toBe(200);
    expect((await fetch(stored.avatar_url)).status).toBe(404);

    // Editing something else leaves the picture alone; removing it removes it.
    await client.post("/api/profile", { bio: "سلام" });
    expect((await media(`/api/media/avatar/${user.id}`)).status).toBe(200);
    await client.post("/api/profile", { avatar: "" });
    expect((await media(`/api/media/avatar/${user.id}`)).status).toBe(404);
    expect(await row("SELECT avatar_url FROM users WHERE id = $1", [user.id])).toEqual({ avatar_url: null });
  });

  it("a new post's pictures move to Storage after the response and keep being served", async () => {
    const client = createClient();
    await registerUser(client, { type: "artist", name: "Storage Post" });
    const created = await client.post("/api/posts", { title: "کار", tag: "ناخن", image: PNG, thumb: `data:image/png;base64,${PNG.split(",")[1]}` });
    const post = created.payload.data.post;

    const moved = await until(async () => {
      const r = await row("SELECT length(image) AS image, length(thumb) AS thumb, image_url, thumb_url FROM posts WHERE id = $1", [post.id]);
      return r.image_url && r.thumb_url && r.image === 0 && r.thumb === 0 ? r : null;
    }, "post pictures to move");
    expect((await fetch(moved.image_url)).status).toBe(200);

    const full = await media(post.image);
    expect(full.status).toBe(200);
    expect(full.headers.get("cache-control")).toContain("immutable");
    expect((await media(`/api/media/post/${post.id}?w=360&v=1`)).status).toBe(200);

    // The detail/list payloads still say there is a picture.
    const listed = (await client.get("/api/posts")).payload.data.posts.find((p) => p.id === post.id);
    expect(listed.image).toContain("/api/media/post/");

    // Deleting the post deletes its Storage objects.
    expect((await client.delete(`/api/posts/${post.id}`)).ok).toBe(true);
    await until(async () => (await fetch(moved.image_url)).status === 404, "storage object removal");
  });

  it("the cron move migrates pictures still stored as base64 and the media routes keep serving them", async () => {
    const client = createClient();
    const { user } = await registerUser(client, { type: "artist", name: "Legacy Blobs" });
    await client.post("/api/posts", { title: "x", tag: "t", image: PNG }); // gives the owner a post row
    await until(async () => (await row("SELECT 1 AS ok FROM posts WHERE owner_user_id = $1 AND image_url IS NOT NULL", [user.id])), "first post to move");

    // Old-style rows: pictures only as base64 in the database.
    await row("UPDATE users SET avatar = $1, poster = $2, avatar_url = NULL, poster_url = NULL WHERE id = $3", [PNG, PNG2, user.id]);
    const legacy = await row(`
      INSERT INTO posts (owner_user_id, title, tag, image, thumb, caption, is_public, featured)
      VALUES ($1, 'قدیمی', 't', $2, $2, '', true, false) RETURNING id
    `, [user.id, PNG]);

    expect((await media(`/api/media/avatar/${user.id}`)).status).toBe(200); // served from the row
    expect((await media(`/api/media/post/${legacy.id}`)).status).toBe(200);

    const unauthorised = await fetch(`${TEST_BASE_URL}/api/cron/migrate-media`, { method: "POST" });
    expect(unauthorised.status).toBe(401);

    const run = await fetch(`${TEST_BASE_URL}/api/cron/migrate-media`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } });
    expect(run.status).toBe(200);
    expect((await run.json()).data.configured).toBe(true);

    const after = await row("SELECT length(avatar) AS a, length(poster) AS p, avatar_url, poster_url FROM users WHERE id = $1", [user.id]);
    expect(after).toMatchObject({ a: 0, p: 0 });
    expect(after.avatar_url).toBeTruthy();
    expect(after.poster_url).toBeTruthy();
    const post = await row("SELECT length(image) AS i, length(thumb) AS t, image_url, thumb_url FROM posts WHERE id = $1", [legacy.id]);
    expect(post).toMatchObject({ i: 0, t: 0 });
    expect(post.image_url && post.thumb_url).toBeTruthy();

    // Nothing changed for viewers.
    expect((await media(`/api/media/avatar/${user.id}`)).status).toBe(200);
    expect((await media(`/api/media/poster/${user.id}`)).status).toBe(200);
    expect((await media(`/api/media/post/${legacy.id}?w=300`)).status).toBe(200);
    expect((await media(`/api/media/post/${legacy.id}`)).status).toBe(200);

    // A second run has nothing of ours left to do.
    const again = await (await fetch(`${TEST_BASE_URL}/api/cron/migrate-media`, { method: "POST", headers: { Authorization: `Bearer ${TEST_CRON_SECRET}` } })).json();
    expect(again.data.failed).toBe(0);
  });
});
