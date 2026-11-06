import { describe, it, expect } from "vitest";
import { calledBy, greeting, praise, pushText, surveySteps, unclearPrice } from "../../app/shared/lib/welcomeSurvey.js";

const has = { area: true, avatar: false, poster: false, specialty: false, experience: false, unclearPrices: true };

describe("welcome survey words", () => {
  it("puts each person's own name and numbers in", () => {
    const artist = { role: "artist", name: "ارزو", facts: { posts: 10, services: 9, bookings: 0 } };
    expect(greeting(artist)).toBe("ارزو جان، خوش اومدی!");
    expect(praise(artist)).toContain("۱۰ تا نمونه‌کار و ۹ تا خدمت");
  });

  it("calls a salon «عزیز», a client by the first name, and copes with no name", () => {
    expect(calledBy({ role: "salon", name: "افتاب" })).toBe("افتاب عزیز");
    expect(calledBy({ role: "client", name: "مریم احمدی" })).toBe("مریم جان");
    expect(greeting({ role: "client", name: "  " })).toBe("خوش اومدی!");
  });

  it("never says «۰ تا» when one of the two is missing", () => {
    expect(praise({ role: "salon", facts: { posts: 0, services: 4 } })).toMatch(/^۴ تا خدمت گذاشتی/);
  });

  it("writes the one push without a name and without a promise, in «تو» (owner 2026-11-06)", () => {
    for (const role of ["artist", "salon", "client"]) {
      const text = pushText({ role, name: "رز سالن Bella" });
      const all = `${text.title} ${text.body}`;
      expect(all).not.toMatch(/رز|Bella|جان|عزیز|شما|درستش کنیم|خودمون می‌خونیم/);
      expect(text.title.length).toBeGreaterThan(5);
    }
    expect(pushText({ role: "client" }).title).toBe("نوبت گرفتن چطور بود؟");
    expect(pushText({ role: "salon" }).title).toContain("سالنت");
  });

  it("speaks to a client about bookings, one or many", () => {
    expect(praise({ role: "client", facts: { bookings: 1 } })).toContain("اولین نوبتت");
    expect(praise({ role: "client", facts: { bookings: 3 } })).toContain("۳ تا نوبت");
  });

  it("spots a price a client would misread, and leaves clear ones alone", () => {
    for (const price of ["از ۲ تومن", "از ۵۰۰ تومان", "از ۲ م"]) expect(unclearPrice(price)).toBe(true);
    for (const price of ["۲۵۰ هزار", "از ۱ میلیون تومان", "500000", "توافقی", ""]) expect(unclearPrice(price)).toBe(false);
  });

  it("gives a client no list, and a salon no experience row", () => {
    const facts = { posts: 3, services: 2, bookings: 0 };
    expect(surveySteps({ role: "client", facts, has })).toEqual([]);
    expect(surveySteps({ role: "salon", facts, has }).map((step) => step.id)).not.toContain("experience");
    expect(surveySteps({ role: "artist", facts: { ...facts, services: 0 }, has }).map((step) => step.id)).not.toContain("prices");
  });
});
