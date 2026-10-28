import { describe, expect, it } from "vitest";
import { checkTerms } from "../../app/lib/db/repos/teamAgreements.js";

// checkTerms reads only the salon's opening hours; a stand-in runner answers that one query.
const salon = (hours) => ({ query: async () => ({ rows: hours }) });
const OPEN = [
  { day: "شنبه", open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", active: true },
  { day: "سه‌شنبه", open_time: "10:00", close_time: "20:00", active: true },
  { day: "پنجشنبه", open_time: "۱۰:۰۰", close_time: "۱۸:۰۰", active: true },
  { day: "جمعه", open_time: "", close_time: "", active: false }
];
const base = { days: "شنبه، سه‌شنبه", from: "10:00", to: "18:00", share: 50 };
const check = (input, hours = OPEN) => checkTerms(1, { ...base, ...input }, salon(hours));

describe("checkTerms edge cases", () => {
  it("accepts a normal set and normalises days, digits and the note", async () => {
    const r = await check({ days: "سه‌شنبه,شنبه", share: "۶۰", ownShare: "۸۰", note: "  سلام  " });
    expect(r).toEqual({ ok: true, value: { days: "شنبه، سه‌شنبه", from: "10:00", to: "18:00", share: 60, ownShare: 80, note: "سلام" } });
  });
  it("accepts 0 and 100 percent, refuses 101, -1, 12.5 and text", async () => {
    expect((await check({ share: 0 })).ok).toBe(true);
    expect((await check({ share: 100 })).ok).toBe(true);
    for (const share of [101, -1, 12.5, "abc"]) expect((await check({ share })).ok).toBe(false);
    expect((await check({ ownShare: 101 })).ok).toBe(false);
  });
  it("needs a share, but ownShare may stay empty", async () => {
    expect((await check({ share: "" })).ok).toBe(false);
    expect((await check({ share: null })).ok).toBe(false);
    expect((await check({ ownShare: "" })).value.ownShare).toBeNull();
  });
  it("refuses no days, unknown days, and days the salon is closed", async () => {
    expect((await check({ days: "" })).ok).toBe(false);
    expect((await check({ days: "Monday" })).ok).toBe(false);
    const friday = await check({ days: "جمعه" });
    expect(friday.ok).toBe(false);
    expect(friday.error).toContain("بسته");
  });
  it("refuses a day with no hours row when the salon has hours", async () => {
    expect((await check({ days: "دوشنبه" })).ok).toBe(false);
  });
  it("refuses hours outside the salon's, reversed, equal or malformed", async () => {
    expect((await check({ from: "09:00" })).ok).toBe(false);
    expect((await check({ to: "20:30" })).ok).toBe(false);
    expect((await check({ days: "پنجشنبه", to: "19:00" })).ok).toBe(false);
    expect((await check({ from: "18:00", to: "10:00" })).ok).toBe(false);
    expect((await check({ from: "12:00", to: "12:00" })).ok).toBe(false);
    expect((await check({ from: "ab", to: "cd" })).ok).toBe(false);
  });
  it("accepts Persian-digit times that match the salon's hours exactly", async () => {
    expect((await check({ from: "۱۰:۰۰", to: "۲۰:۰۰", days: "شنبه" })).ok).toBe(true);
  });
  it("skips the hours check when the salon has no hours rows yet", async () => {
    expect((await check({ days: "جمعه" }, [])).ok).toBe(true);
  });
  it("cuts the note at 120 characters", async () => {
    const r = await check({ note: "x".repeat(300) });
    expect(r.value.note).toHaveLength(120);
  });
});
