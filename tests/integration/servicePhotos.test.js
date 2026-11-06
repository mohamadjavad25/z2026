import { describe, it, expect } from "vitest";
import { createClient, registerUser } from "./helpers.js";

// Sample photos on services (2026-11-06): a service shows up to 3 of its owner's own public portfolio posts.

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function post(client, title, extra = {}) {
  const res = await client.post("/api/posts", { title, tag: "", image: PNG, ...extra });
  expect(res.status).toBe(201);
  return res.payload.data.post.id;
}
const put = (client, body) => client.put("/api/service-photos", body);

describe("service photos", () => {
  it("an artist links own posts to a service; guests see them in order, capped at three", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Photo Artist" });
    const service = (await artistClient.post("/api/artist/me", { name: "بالیاژ", price: "6000000", duration: "270 دقیقه" })).payload.data.service;
    const [a, b, c, d] = [await post(artistClient, "یک"), await post(artistClient, "دو"), await post(artistClient, "سه"), await post(artistClient, "چهار")];

    const saved = await put(artistClient, { serviceId: service.id, postIds: [b, a, c, d, a] });
    expect(saved.ok).toBe(true);
    expect(saved.payload.data.postIds).toEqual([b, a, c]); // order kept, duplicate dropped, three at most

    const guest = (await createClient().get(`/api/artists/${artist.user.id}`)).payload.data.artist;
    expect(guest.services[0].photos.map((photo) => photo.postId)).toEqual([b, a, c]);
    expect(guest.services[0].photos[0].image).toContain(`/api/media/post/${b}`);

    // The owner's own list and an edit of the service keep the photos.
    expect((await artistClient.get("/api/artist/me")).payload.data.services[0].photos).toHaveLength(3);
    const edited = await artistClient.patch("/api/artist/me", { id: service.id, name: "بالیاژ و آمبره" });
    expect(edited.payload.data.service.photos).toHaveLength(3);

    // Empty list takes them all off.
    expect((await put(artistClient, { serviceId: service.id, postIds: [] })).payload.data.postIds).toEqual([]);
    expect((await artistClient.get("/api/artist/me")).payload.data.services[0].photos).toEqual([]);
  });

  it("only the owner's own public posts count, and only the owner's own service", async () => {
    const owner = createClient();
    await registerUser(owner, { type: "artist", name: "Owner Artist" });
    const other = createClient();
    await registerUser(other, { type: "artist", name: "Other Artist" });
    const service = (await owner.post("/api/artist/me", { name: "کاشت", price: "1", duration: "60 دقیقه" })).payload.data.service;
    const mine = await post(owner, "مال من");
    const theirs = await post(other, "مال اون");
    const hidden = await post(owner, "خصوصی", { isPublic: false });

    const saved = await put(owner, { serviceId: service.id, postIds: [theirs, hidden, mine] });
    expect(saved.payload.data.postIds).toEqual([mine]);

    // Someone else's service is a 404; a missing list or id is a 400; a client account is refused.
    expect((await put(other, { serviceId: service.id, postIds: [] })).status).toBe(404);
    expect((await put(owner, { serviceId: service.id })).status).toBe(400);
    expect((await put(owner, { postIds: [] })).status).toBe(400);
    const clientUser = createClient();
    await registerUser(clientUser, { type: "client", name: "Plain Client" });
    expect((await put(clientUser, { serviceId: service.id, postIds: [] })).status).toBe(403);
    expect((await createClient().put("/api/service-photos", { serviceId: 1, postIds: [] })).status).toBe(401);
  });

  it("a salon does the same, and deleting the post or the service removes the link only", async () => {
    const salonClient = createClient();
    const salon = await registerUser(salonClient, { type: "salon", name: "Photo Salon" });
    const service = (await salonClient.post("/api/salon-services", { name: "رنگ مو", price: "1200000", duration: "120 دقیقه" })).payload.data.service;
    const keep = await post(salonClient, "نگه دار");
    const drop = await post(salonClient, "حذف شونده");
    expect((await put(salonClient, { serviceId: service.id, postIds: [drop, keep] })).ok).toBe(true);

    const page = (await createClient().get(`/api/salons/${salon.user.id}`)).payload.data.salon;
    expect(page.services[0].photos.map((photo) => photo.postId)).toEqual([drop, keep]);

    expect((await salonClient.delete(`/api/posts/${drop}`)).ok).toBe(true);
    const after = (await salonClient.get("/api/salon-services")).payload.data.services[0];
    expect(after.photos.map((photo) => photo.postId)).toEqual([keep]);

    expect((await salonClient.delete("/api/salon-services", { id: service.id })).ok).toBe(true);
    expect((await salonClient.get("/api/posts")).payload.data.posts.some((item) => item.id === keep)).toBe(true);
  });

  it("the form can send photos with the service, and the icon can stay (photoAsCover false)", async () => {
    const artistClient = createClient();
    const artist = await registerUser(artistClient, { type: "artist", name: "Mode Artist" });
    const a = await post(artistClient, "یک");
    const created = await artistClient.post("/api/artist/me", { name: "لاک", price: "1", duration: "60 دقیقه", photoPostIds: [a], photoAsCover: false });
    expect(created.status).toBe(201);
    expect(created.payload.data.service.photos).toHaveLength(1);
    expect(created.payload.data.service.photoAsCover).toBe(false);

    const guest = (await createClient().get(`/api/artists/${artist.user.id}`)).payload.data.artist;
    expect(guest.services[0].photoAsCover).toBe(false);
    expect(guest.services[0].photos).toHaveLength(1);

    // Only the mode changes: the photos stay.
    const edited = await artistClient.patch("/api/artist/me", { id: created.payload.data.service.id, photoAsCover: true });
    expect(edited.payload.data.service.photoAsCover).toBe(true);
    expect(edited.payload.data.service.photos).toHaveLength(1);
    // A service without photos defaults to «photo replaces icon».
    const plain = await artistClient.post("/api/artist/me", { name: "ساده", price: "1", duration: "30 دقیقه" });
    expect(plain.payload.data.service.photos).toEqual([]);
    expect(plain.payload.data.service.photoAsCover).toBe(true);
  });

  it("a post links to its services when saved; off, full or foreign services are not linked", async () => {
    const owner = createClient();
    await registerUser(owner, { type: "artist", name: "Post Link Artist" });
    const other = createClient();
    await registerUser(other, { type: "artist", name: "Other Link Artist" });
    const s1 = (await owner.post("/api/artist/me", { name: "یک", price: "1", duration: "30 دقیقه" })).payload.data.service;
    const s2 = (await owner.post("/api/artist/me", { name: "دو", price: "1", duration: "30 دقیقه" })).payload.data.service;
    const foreign = (await other.post("/api/artist/me", { name: "بیگانه", price: "1", duration: "30 دقیقه" })).payload.data.service;

    const first = await owner.post("/api/posts", { title: "کار", tag: "یک", image: PNG, serviceIds: [s1.id, s2.id, foreign.id] });
    expect(first.status).toBe(201);
    const postId = first.payload.data.post.id;
    const links = (await owner.get("/api/service-photos")).payload.data;
    expect(links.postServices[postId].sort()).toEqual([s1.id, s2.id].sort());
    expect(links.services.find((item) => item.id === s1.id).photoCount).toBe(1);

    // Editing with an empty list takes the link off; leaving it out changes nothing.
    expect((await owner.patch(`/api/posts/${postId}`, { title: "کار نو" })).ok).toBe(true);
    expect((await owner.get("/api/service-photos")).payload.data.postServices[postId]).toHaveLength(2);
    expect((await owner.patch(`/api/posts/${postId}`, { serviceIds: [] })).ok).toBe(true);
    expect((await owner.get("/api/service-photos")).payload.data.postServices[postId]).toBeUndefined();

    // A service with three photos does not take a fourth.
    for (const title of ["الف", "ب", "ج"]) expect((await owner.post("/api/posts", { title, tag: "یک", image: PNG, serviceIds: [s1.id] })).status).toBe(201);
    const fourth = (await owner.post("/api/posts", { title: "د", tag: "یک", image: PNG, serviceIds: [s1.id, s2.id] })).payload.data.post.id;
    const after = (await owner.get("/api/service-photos")).payload.data;
    expect(after.postServices[fourth]).toEqual([s2.id]);
    expect(after.services.find((item) => item.id === s1.id).photoCount).toBe(3);

    // Clients cannot read the owner's link list.
    const clientUser = createClient();
    await registerUser(clientUser, { type: "client", name: "Link Client" });
    expect((await clientUser.get("/api/service-photos")).status).toBe(403);
  });
});
