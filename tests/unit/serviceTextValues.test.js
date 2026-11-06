import { describe, expect, it } from "vitest";
import { plainPriceAmount, servicePriceText } from "../../app/shared/lib/money.js";
import { durationTextMinutes, parseServiceDurationMinutes } from "../../app/shared/lib/time.js";
import { bundleServices } from "../../app/shared/lib/serviceBundle.js";
import { parseAmount } from "../../app/lib/db/repos/teamAgreements.js";
import { durationProblem } from "../../app/lib/validation/service.js";
import { getBookableSalonServiceItems } from "../../app/features/salons/useSalonDirectory.js";

// Found on the live site on 2026-11-06: «از ۱ میلیون تومان» read as «۱ تومان» and «۵ ساعت» held 15 minutes.
describe("a service's written price", () => {
  it("is shown as its owner wrote it, in toman", () => {
    expect(servicePriceText("از ۱ میلیون تومان")).toBe("از ۱ میلیون تومان");
    expect(servicePriceText("از ۵۵۰ هزار")).toBe("از ۵۵۰ هزار تومان");
    expect(servicePriceText("۲۵۰ هزار")).toBe("۲۵۰ هزار تومان");
    expect(servicePriceText("از ۲ تومن")).toBe("از ۲ تومن");
    expect(servicePriceText("از ۳ م")).toBe("از ۳ م تومان");
    expect(servicePriceText("رایگان")).toBe("رایگان");
  });

  it("gets its marks when it is a bare number", () => {
    expect(servicePriceText("450000")).toBe("۴۵۰٬۰۰۰ تومان");
    expect(servicePriceText("۴۵۰٬۰۰۰")).toBe("۴۵۰٬۰۰۰ تومان");
    expect(servicePriceText("۴۵۰۰۰۰ تومان")).toBe("۴۵۰٬۰۰۰ تومان");
  });

  it("says nothing when nothing was written", () => {
    expect(servicePriceText("")).toBe("");
    expect(servicePriceText("   ")).toBe("");
    expect(servicePriceText(null)).toBe("");
    expect(servicePriceText("0")).toBe("");
  });

  it("counts toward a sum only when it is one exact amount", () => {
    expect(plainPriceAmount("۴۵۰٬۰۰۰")).toBe(450000);
    expect(plainPriceAmount("۲۵۰ هزار")).toBe(250000);
    expect(plainPriceAmount("۱.۵ میلیون تومان")).toBe(1500000);
    for (const text of ["از ۱ میلیون تومان", "از ۵۵۰ هزار", "از ۲ م", "رایگان", ""]) expect(plainPriceAmount(text)).toBe(0);
  });

  it("never invents a total or a team's share from words", () => {
    const list = [{ name: "الف", price: "از ۱ میلیون تومان", duration: "۳۰" }, { name: "ب", price: "۲۰۰ هزار", duration: "۳۰" }];
    expect(bundleServices(list).price).toBe("");
    expect(parseAmount("۲۵۰ هزار")).toBe(250000);
    expect(parseAmount("از ۵۰۰ هزار")).toBe(0);
  });
});

describe("a service's written length", () => {
  it("reads hours as hours", () => {
    expect(parseServiceDurationMinutes("۲ ساعت")).toBe(120);
    expect(parseServiceDurationMinutes("۵ ساعت")).toBe(300);
    expect(parseServiceDurationMinutes("۱ ساعت و نیم")).toBe(90);
    expect(parseServiceDurationMinutes("۲ ساعت و ۳۰ دقیقه")).toBe(150);
    expect(parseServiceDurationMinutes("۱ ساعت و ربع")).toBe(75);
    expect(parseServiceDurationMinutes("۱.۵ ساعت")).toBe(90);
    expect(parseServiceDurationMinutes("نیم ساعت")).toBe(30);
    expect(parseServiceDurationMinutes("یک ساعت")).toBe(60);
    expect(parseServiceDurationMinutes("۱:۳۰")).toBe(90);
  });

  it("keeps reading minutes as before", () => {
    expect(parseServiceDurationMinutes("۴۵ دقیقه")).toBe(45);
    expect(parseServiceDurationMinutes("۱۲۰ دقیقه")).toBe(120);
    expect(parseServiceDurationMinutes("90")).toBe(90);
    expect(parseServiceDurationMinutes(45)).toBe(45);
    expect(parseServiceDurationMinutes("")).toBe(60);
    expect(parseServiceDurationMinutes("۵")).toBe(15);
  });

  it("holds the longer end of a range", () => {
    expect(durationTextMinutes("۱ تا ۲ ساعت")).toBe(120);
  });

  it("is refused past half a day, counted in minutes", () => {
    expect(durationProblem("۲۰ ساعت")).toBeTruthy();
    expect(durationProblem("۱۲ ساعت")).toBeNull();
    expect(durationProblem("۱ ساعت و نیم")).toBeNull();
    expect(durationProblem("نیم ساعت")).toBeNull();
    expect(durationProblem("abc")).toBeTruthy();
    expect(durationProblem("0")).toBeTruthy();
  });
});

describe("a salon with an empty menu", () => {
  it("offers nothing made up", () => {
    expect(getBookableSalonServiceItems({ services: [] })).toEqual([]);
    expect(getBookableSalonServiceItems({})).toEqual([]);
  });
});
