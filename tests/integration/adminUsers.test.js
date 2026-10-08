import { describe, it, expect } from "vitest";
import { adminClient, createClient, enrolledAdminClient, registerUser } from "./helpers.js";
import { TEST_ADMIN5_PHONE, TEST_ADMIN_PASSWORD, TEST_ADMIN_PHONE } from "../globalSetup.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("admin: working with one account", () => {
  it("detail carries posts, tickets and the private note; everything is closed to non-admins", async () => {
    const admin = await adminClient();
    const user = createClient();
    const account = await registerUser(user, { type: "artist", name: "پروندهٔ کامل" });
    await user.post("/api/posts", { title: "پست پرونده", tag: "ناخن", caption: "x", image: PNG });
    await user.post("/api/support", { subject: "پیام پرونده", message: "این یک پیام برای پروندهٔ کاربر است." });

    const detail = (await admin.get(`/api/admin/users/${account.user.id}`)).payload.data;
    expect(detail.posts.map((post) => post.title)).toContain("پست پرونده");
    expect(detail.tickets.map((ticket) => ticket.subject)).toContain("پیام پرونده");
    expect(detail.note).toMatchObject({ note: "" });

    const outsider = createClient();
    await registerUser(outsider, { type: "client", name: "نفوذی" });
    for (const client of [createClient(), outsider]) {
      expect((await client.patch(`/api/admin/users/${account.user.id}`, { name: "هک" })).status).toBe(403);
      expect((await client.post(`/api/admin/users/${account.user.id}/note`, { note: "x" })).status).toBe(403);
      expect((await client.post(`/api/admin/users/${account.user.id}/password`, { newPassword: "hacked-password" })).status).toBe(403);
    }
  });

  it("edits a profile on someone's behalf, validates, and writes the old value to the audit log", async () => {
    const admin = await adminClient();
    const user = createClient();
    const account = await registerUser(user, { type: "client", name: "نام قدیمی" });
    expect((await admin.patch(`/api/admin/users/${account.user.id}`, { name: "   " })).status).toBe(400);
    expect((await admin.patch(`/api/admin/users/${account.user.id}`, { name: "ا".repeat(81) })).status).toBe(400);
    expect((await admin.patch("/api/admin/users/999999999", { name: "x" })).status).toBe(404);
    expect((await admin.patch(`/api/admin/users/${account.user.id}`, { name: "نام نو", area: "تهران" })).payload.data.changed.sort()).toEqual(["area", "name"]);
    expect((await admin.patch(`/api/admin/users/${account.user.id}`, { name: "نام نو" })).payload.data.changed).toEqual([]); // nothing new to save

    const after = (await admin.get(`/api/admin/users/${account.user.id}`)).payload.data.user;
    expect(after).toMatchObject({ name: "نام نو", area: "تهران" });
    const log = (await admin.get("/api/admin/actions")).payload.data.actions.find((entry) => entry.action === "edit_user" && entry.target_user_id === account.user.id);
    expect(log.detail).toContain("نام قدیمی");
  });

  it("keeps a private note per account", async () => {
    const admin = await adminClient();
    const account = await registerUser(createClient(), { type: "salon", name: "سالن یادداشتی" });
    expect((await admin.post(`/api/admin/users/${account.user.id}/note`, { note: "با تلفن هویتش تأیید شد." })).ok).toBe(true);
    const note = (await admin.get(`/api/admin/users/${account.user.id}`)).payload.data.note;
    expect(note.note).toBe("با تلفن هویتش تأیید شد.");
    expect(note.updated_by).toBeTruthy();
    expect((await admin.post(`/api/admin/users/${account.user.id}/note`, { note: "ا".repeat(2001) })).status).toBe(400);
    expect((await admin.post("/api/admin/users/999999999/note", { note: "x" })).status).toBe(404);
  });

  it("sets a new password only after the password re-check; the user can log in with it, old sessions end, admins are off limits", async () => {
    const admin = await enrolledAdminClient(TEST_ADMIN5_PHONE);
    const user = createClient();
    const account = await registerUser(user, { type: "client", name: "رمز فراموش" });
    const path = `/api/admin/users/${account.user.id}/password`;

    const refused = await admin.post(path, { newPassword: "a-new-password-1" });
    expect(refused.status).toBe(403);
    expect(refused.payload.code).toBe("stepup_required");
    expect((await admin.post("/api/admin/auth/stepup", { password: TEST_ADMIN_PASSWORD })).ok).toBe(true);

    expect((await admin.post(path, { newPassword: "short" })).status).toBe(400);
    expect((await admin.post(path, { newPassword: "a-new-password-1" })).ok).toBe(true);
    expect((await user.get("/api/auth/me")).payload.data.user).toBeNull(); // old session ended
    expect((await createClient().post("/api/auth/login", { phone: account.phone, password: "testpass123" })).status).toBe(401);
    expect((await createClient().post("/api/auth/login", { phone: account.phone, password: "a-new-password-1" })).ok).toBe(true);

    const adminRow = (await admin.get(`/api/admin/users?q=${TEST_ADMIN_PHONE}`)).payload.data.users[0];
    expect((await admin.post(`/api/admin/users/${adminRow.id}/password`, { newPassword: "a-new-password-2" })).status).toBe(400);
    expect((await admin.post("/api/admin/users/999999999/password", { newPassword: "a-new-password-2" })).status).toBe(404);
  });
});
