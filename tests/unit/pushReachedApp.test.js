import { describe, it, expect } from "vitest";
import { pushReachedApp } from "../../app/lib/push.js";

// The booking SMS is skipped only when Firebase took the push for the person's Android app (bookingSms.js).
describe("pushReachedApp", () => {
  it("is true only when the app push went out", async () => {
    expect(await pushReachedApp(Promise.resolve({ ok: true, sent: 1, appSent: 1 }))).toBe(true);
    expect(await pushReachedApp(Promise.resolve({ ok: true, sent: 1, appSent: 0 }))).toBe(false);
  });

  it("treats a failed or missing push as not reached, so the SMS goes", async () => {
    expect(await pushReachedApp(Promise.reject(new Error("google unreachable")))).toBe(false);
    expect(await pushReachedApp(Promise.resolve(null))).toBe(false);
    expect(await pushReachedApp(null)).toBe(false);
  });
});
