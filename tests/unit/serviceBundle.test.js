import { describe, it, expect } from "vitest";
import { bundleServices, serviceKey } from "../../app/shared/lib/serviceBundle.js";
import { parseServiceDurationMinutes } from "../../app/shared/lib/time.js";
import { parseTomanAmount } from "../../app/shared/lib/money.js";

const nails = { id: 1, name: "کاشت ناخن", duration: "۹۰ دقیقه", price: "600", emoji: "gel_nails" };
const makeup = { id: 2, name: "میکاپ", duration: "60 دقیقه", price: "۸۰۰", emoji: "lipstick" };
const brows = { id: 3, name: "اصلاح ابرو", duration: "۲۰ دقیقه", price: "قیمت توافقی" };

describe("bundleServices", () => {
  it("returns null for nothing and the service itself for one", () => {
    expect(bundleServices([])).toBeNull();
    expect(bundleServices(undefined)).toBeNull();
    expect(bundleServices([nails])).toBe(nails);
  });

  it("books several services as one back-to-back visit", () => {
    const bundle = bundleServices([nails, makeup]);
    expect(bundle.name).toBe("کاشت ناخن + میکاپ");
    expect(parseServiceDurationMinutes(bundle.duration)).toBe(150);
    expect(parseTomanAmount(bundle.price)).toBe(1400);
    expect(bundle.emoji).toBe("gel_nails");
    expect(bundle.items).toEqual([nails, makeup]);
    expect(bundle.id).toBe(`bundle:${serviceKey(nails)}+${serviceKey(makeup)}`);
  });

  it("leaves the price open when any service has none", () => {
    expect(bundleServices([nails, brows]).price).toBe("");
  });

  it("keeps the booking's service text within the 200-character limit", () => {
    const long = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `خدمت با یک اسم نسبتاً طولانی ${i}`, duration: "۳۰ دقیقه", price: "100" }));
    const bundle = bundleServices(long);
    expect(bundle.name.length).toBeLessThanOrEqual(200);
    expect(bundle.name.startsWith(long[0].name)).toBe(true);
  });
});
