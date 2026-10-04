import { describe, it, expect } from "vitest";
import { TEST_BASE_URL } from "../globalSetup.js";
import { createClient, registerUser } from "./helpers.js";

// 1x1 transparent PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function artistWithPost(extra = {}) {
  const client = createClient();
  const artist = await registerUser(client, { type: "artist", name: "Post Artist" });
  const created = await client.post("/api/posts", { title: "اولین کار", tag: "ناخن", caption: "توضیح", image: PNG, ...extra });
  return { client, artist, created, post: created.payload?.data?.post };
}

describe("posts", () => {
  it("only artists and salons can publish; input is validated", async () => {
    const clientUser = createClient();
    await registerUser(clientUser, { type: "client", name: "Plain Client" });
    const denied = await clientUser.post("/api/posts", { title: "x", image: PNG });
    expect(denied.status).toBe(403);

    const artistClient = createClient();
    await registerUser(artistClient, { type: "artist", name: "A" });
    expect((await artistClient.post("/api/posts", { image: PNG })).status).toBe(400); // no title
    expect((await artistClient.post("/api/posts", { title: "t" })).status).toBe(400); // no image
    expect((await artistClient.get("/api/posts/abc")).status).toBe(404);
    expect((await artistClient.post("/api/posts/abc/save", {})).status).toBe(404);
    expect((await artistClient.post("/api/posts/999999999/save", {})).status).toBe(404);
  });

  it("editing without a new picture never destroys the stored image", async () => {
    const { client, post } = await artistWithPost();
    expect(post.image).toContain("/api/media/post/");
    // The client echoes the media URL back on edit -- exactly what the app does.
    const edit = await client.patch(`/api/posts/${post.id}`, { title: "ویرایش شد", image: post.image });
    expect(edit.ok).toBe(true);
    expect(edit.payload.data.post.title).toBe("ویرایش شد");
    const media = await fetch(`${TEST_BASE_URL}${edit.payload.data.post.image}`);
    expect(media.status).toBe(200);
    expect(media.headers.get("content-type")).toContain("image/png");
    // An empty title is rejected on edit too.
    expect((await client.patch(`/api/posts/${post.id}`, { title: "  " })).status).toBe(400);
  });

  it("pins are capped per owner", async () => {
    const client = createClient();
    await registerUser(client, { type: "artist", name: "Pinner" });
    for (let i = 0; i < 5; i += 1) {
      await client.post("/api/posts", { title: `p${i}`, tag: "ناخن", image: PNG, featured: true });
    }
    const list = (await client.get("/api/posts")).payload.data.posts;
    expect(list).toHaveLength(5);
    expect(list.filter((p) => p.featured)).toHaveLength(3);
  });

  it("private posts are visible to their owner only", async () => {
    const { client, artist, post } = await artistWithPost({ isPublic: false });
    const anon = createClient();
    expect((await anon.get(`/api/posts/${post.id}`)).status).toBe(404);
    expect((await fetch(`${TEST_BASE_URL}/api/media/post/${post.id}`)).status).toBe(404);
    expect((await client.get(`/api/posts/${post.id}`)).status).toBe(200);
    const publicProfile = await anon.get(`/api/artists/${artist.user.id}`);
    expect(publicProfile.payload.data.artist.posts.some((p) => p.id === post.id)).toBe(false);
    const ownProfile = await client.get(`/api/artists/${artist.user.id}`);
    expect(ownProfile.payload.data.artist.posts.some((p) => p.id === post.id)).toBe(true);
    // Making it public exposes it.
    await client.patch(`/api/posts/${post.id}`, { isPublic: true });
    expect((await anon.get(`/api/posts/${post.id}`)).status).toBe(200);
  });

  it("counts one view per viewer, never the owner's, and ignores unknown posts", async () => {
    const { client, post } = await artistWithPost();
    const viewerA = createClient();
    await registerUser(viewerA, { type: "client", name: "Viewer A" });
    const viewerB = createClient();
    await registerUser(viewerB, { type: "client", name: "Viewer B" });

    await client.post(`/api/posts/${post.id}/view`, {});
    await viewerA.post(`/api/posts/${post.id}/view`, {});
    await viewerA.post(`/api/posts/${post.id}/view`, {});
    const last = await viewerB.post(`/api/posts/${post.id}/view`, {});
    expect(last.payload.data.post.views).toBe("2");
    expect((await viewerA.post("/api/posts/999999999/view", {})).status).toBe(404);
  });

  it("save is idempotent, keeps an exact count and lists saved posts directly", async () => {
    const { post } = await artistWithPost();
    const fan = createClient();
    await registerUser(fan, { type: "client", name: "Fan" });
    const first = await fan.post(`/api/posts/${post.id}/save`, { saved: true });
    const again = await fan.post(`/api/posts/${post.id}/save`, { saved: true });
    expect(first.payload.data).toEqual({ saved: true, savesCount: 1 });
    expect(again.payload.data).toEqual({ saved: true, savesCount: 1 });
    const saved = await fan.get("/api/posts/saved");
    expect(saved.payload.data.posts.map((p) => p.id)).toContain(post.id);
    const off = await fan.post(`/api/posts/${post.id}/save`, { saved: false });
    expect(off.payload.data).toEqual({ saved: false, savesCount: 0 });
  });

  it("a salon's portfolio is its posts, with the same rules", async () => {
    const salon = createClient();
    await registerUser(salon, { type: "salon", name: "Gallery Salon" });
    const created = await salon.post("/api/salon-portfolio", { title: "کار سالن", tag: "رنگ", image: PNG });
    expect(created.status).toBe(201);
    const list = await salon.get("/api/salon-portfolio");
    expect(list.payload.data.portfolio).toHaveLength(1);
    const bad = await salon.patch("/api/salon-portfolio", { id: "x", title: "t" });
    expect(bad.status).toBe(400);
    const del = await salon.delete("/api/salon-portfolio", { id: created.payload.data.item.id });
    expect(del.ok).toBe(true);
  });
});

describe("post thumbnails", () => {
  // 1x1 WebP, standing in for the small copy the browser makes next to the full picture.
  const WEBP = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

  it("serves the small copy for ?w= and the full picture otherwise", async () => {
    const { client } = await artistWithPost();
    const created = await client.post("/api/posts", { title: "کوچک", tag: "ناخن", caption: "x", image: PNG, thumb: WEBP });
    expect(created.ok).toBe(true);
    const url = created.payload.data.post.image;
    expect(url).toContain("?v=");

    const small = await fetch(`${TEST_BASE_URL}${url}&w=480`);
    expect(small.status).toBe(200);
    expect(small.headers.get("content-type")).toBe("image/webp");
    expect(small.headers.get("cache-control")).toContain("immutable");

    const full = await fetch(`${TEST_BASE_URL}${url}`);
    expect(full.headers.get("content-type")).toBe("image/png");
  });

  it("ignores a thumb that is not an image, and falls back to the full picture", async () => {
    const { client } = await artistWithPost();
    const created = await client.post("/api/posts", { title: "بد", tag: "ناخن", caption: "x", image: PNG, thumb: "data:text/html;base64,PGI+eDwvYj4=" });
    expect(created.ok).toBe(true);
    const res = await fetch(`${TEST_BASE_URL}${created.payload.data.post.image}&w=480`);
    expect(res.headers.get("content-type")).toBe("image/png");
  });
});
