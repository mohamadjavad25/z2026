import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { VISIT_CATEGORIES, VISIT_PLAIN_SOURCE, VISIT_SIGNUP_URL, VISIT_SOURCE } from "../../app/features/landing/visitCatalog.js";
import { proSourceTag } from "../../app/features/landing/proSource.js";

const KINDS = ["intro", "screen", "notify", "calendar", "team", "link", "collab", "price", "faq", "start"];

describe("the field visitors' catalog (/v)", () => {
  it("has the two categories, each opening with its intro and ending with price, questions and the QR", () => {
    expect(VISIT_CATEGORIES.map((c) => c.id)).toEqual(["salon", "artist"]);
    for (const category of VISIT_CATEGORIES) {
      const kinds = category.slides.map((s) => s.kind);
      expect(kinds[0]).toBe("intro");
      expect(kinds.slice(-3)).toEqual(["price", "faq", "start"]);
      for (const kind of kinds) expect(KINDS).toContain(kind);
    }
  });

  it("shows only real screens that exist", () => {
    for (const category of VISIT_CATEGORIES) {
      for (const slide of category.slides.filter((s) => s.kind === "screen")) {
        expect(existsSync(`public/tutorial/${slide.image}.webp`)).toBe(true);
      }
    }
  });

  it("has a drawn stand-in for every screen picture, for /v/clean", () => {
    for (const category of VISIT_CATEGORIES) {
      for (const slide of category.slides.filter((s) => s.kind === "screen")) expect(["times", "request", "find"]).toContain(slide.mock);
    }
    expect(VISIT_PLAIN_SOURCE).not.toBe(VISIT_SOURCE);
    expect(VISIT_PLAIN_SOURCE.length).toBeLessThanOrEqual(24);
  });

  it("has a drawn stand-in for every screen picture, for /v/clean", () => {
    for (const category of VISIT_CATEGORIES) {
      for (const slide of category.slides.filter((s) => s.kind === "screen")) expect(["times", "request", "find"]).toContain(slide.mock);
    }
    expect(VISIT_PLAIN_SOURCE).not.toBe(VISIT_SOURCE);
    expect(VISIT_PLAIN_SOURCE.length).toBeLessThanOrEqual(24);
  });

  it("never writes the free days by hand, so a change in plans.js reaches the catalog", () => {
    const text = JSON.stringify(VISIT_CATEGORIES);
    expect(text).not.toMatch(/[0-9۰-۹]+ روز/);
    expect(text).toContain("{days}");
  });

  it("counts its own opens and sends the QR to the salon page under its own tag", () => {
    expect(VISIT_SOURCE.length).toBeLessThanOrEqual(24);
    expect(proSourceTag(new URL(VISIT_SIGNUP_URL).pathname)).toBe("sms-v");
  });

  it("is shown on tablets too, where visitors often present", () => {
    expect(readFileSync("app/features/landing/LargeScreenGate.jsx", "utf8")).toMatch(/ALWAYS_SHOWN = \[[^\]]*"\/v"/);
  });
});
