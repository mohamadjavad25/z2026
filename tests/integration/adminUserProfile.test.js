import { describe, it, expect } from "vitest";
import { adminClient, createClient, registerUser } from "./helpers.js";
import { q } from "./angle2Util.js";

describe("the admin's page for one account", () => {
  it("has the whole profile: photo, banner, map pin, Instagram, experience and the menu with prices", async () => {
    const api = createClient();
    const { user } = await registerUser(api, { type: "artist", name: "پروفایل کامل" });
    await q(`UPDATE users SET avatar = 'data:image/png;base64,AAAA', poster = 'data:image/png;base64,AAAA', geo_lat = 35.83, geo_lng = 50.99,
             address_detail = 'پلاک ۱۲', instagram = 'sample_page', experience_years = 6 WHERE id = $1`, [user.id]);
    await q("INSERT INTO artist_services (user_id, name, price, duration) VALUES ($1, 'رنگ مو', 'از ۲ تومن', '۲ ساعت')", [user.id]);

    const admin = await adminClient();
    const res = await admin.get(`/api/admin/users/${user.id}`);
    expect(res.ok).toBe(true);
    const { user: seen, services } = res.payload.data;
    expect(seen).toMatchObject({ has_avatar: true, has_poster: true, address_detail: "پلاک ۱۲", instagram: "sample_page" });
    expect(Number(seen.geo_lat)).toBe(35.83);
    expect(Number(seen.geo_lng)).toBe(50.99);
    expect(services).toEqual([expect.objectContaining({ name: "رنگ مو", price: "از ۲ تومن", duration: "۲ ساعت" })]);
    expect(seen).not.toHaveProperty("avatar");
    expect(seen).not.toHaveProperty("password_hash");
  });

  it("a client has no menu", async () => {
    const api = createClient();
    const { user } = await registerUser(api, { type: "client", name: "مشتری ساده" });
    const res = await (await adminClient()).get(`/api/admin/users/${user.id}`);
    expect(res.payload.data.services).toEqual([]);
  });
});
