import { describe, it, expect } from "vitest";
import { profileTodos, progressOf } from "../../app/features/settings/profileProgress.js";

describe("profile progress", () => {
  it("lists five things for a salon and counts what is done", () => {
    const todos = profileTodos({ type: "salon", data: { poster: "p.jpg", area: "تهران" }, hasDefaultAvatar: false, openDaysCount: 0 });
    const p = progressOf(todos);
    expect(todos).toHaveLength(5);
    expect(p).toMatchObject({ total: 5, done: 3, pct: 60 });
    expect(p.left.map((t) => t.key)).toEqual(["hours", "instagram"]);
  });

  it("gives a client three, with the photo, email and place", () => {
    const todos = profileTodos({ type: "client", data: { email: "a@b.com" }, hasDefaultAvatar: true });
    expect(todos.map((t) => t.key)).toEqual(["avatar", "email", "location"]);
    expect(progressOf(todos).pct).toBe(33);
  });

  it("is 100 when nothing is left", () => {
    const todos = profileTodos({ type: "artist", data: { poster: "p", area: "x", instagram: "y" }, hasDefaultAvatar: false, openDaysCount: 4 });
    expect(progressOf(todos)).toMatchObject({ pct: 100, left: [] });
  });
});
