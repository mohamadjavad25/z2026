import { describe, it, expect } from "vitest";
import { profileTodos, progressOf } from "../../app/features/settings/profileProgress.js";

describe("profile progress", () => {
  it("lists four things for a salon while Instagram is off, and counts what is done", () => {
    const todos = profileTodos({ type: "salon", data: { poster: "p.jpg", area: "تهران" }, hasDefaultAvatar: false, openDaysCount: 0 });
    const p = progressOf(todos);
    expect(todos).toHaveLength(4);
    expect(todos.map((t) => t.key)).not.toContain("instagram");
    expect(p).toMatchObject({ total: 4, done: 3, pct: 75 });
    expect(p.left.map((t) => t.key)).toEqual(["hours"]);
  });

  it("gives a client two, the photo and place, and never asks for an email", () => {
    const todos = profileTodos({ type: "client", data: { area: "تهران" }, hasDefaultAvatar: true });
    expect(todos.map((t) => t.key)).toEqual(["avatar", "location"]);
    expect(progressOf(todos).pct).toBe(50);
  });

  it("is 100 when nothing is left", () => {
    const todos = profileTodos({ type: "artist", data: { poster: "p", area: "x", instagram: "y" }, hasDefaultAvatar: false, openDaysCount: 4 });
    expect(progressOf(todos)).toMatchObject({ pct: 100, left: [] });
  });
});
