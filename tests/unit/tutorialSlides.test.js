import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { TUTORIAL_SLIDES, picturesOf } from "../../app/features/onboarding/slides.js";

describe("tutorial slides", () => {
  it("has the welcome and a tutorial for every role", () => {
    expect(Object.keys(TUTORIAL_SLIDES).sort()).toEqual(["artist", "client", "salon", "welcome"]);
  });

  it("every picture is in the app", () => {
    for (const flow of Object.keys(TUTORIAL_SLIDES)) {
      for (const name of picturesOf(flow)) expect(existsSync(`public/tutorial/${name}.webp`), name).toBe(true);
    }
  });

  it("every tap lands on the screen, with a title and a line", () => {
    for (const { slides, last } of Object.values(TUTORIAL_SLIDES)) {
      expect(last).toBeTruthy();
      for (const slide of slides) {
        expect(slide.t && slide.p).toBeTruthy();
        if (slide.trio) continue;
        expect(slide.x).toBeGreaterThan(0);
        expect(slide.x).toBeLessThan(100);
        expect(slide.y).toBeGreaterThan(0);
        expect(slide.y).toBeLessThan(100);
        expect(slide.z).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
