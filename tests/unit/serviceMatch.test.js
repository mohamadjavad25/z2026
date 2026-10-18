import { describe, it, expect } from "vitest";
import { matchServiceNames, serviceNameKey } from "../../app/shared/lib/serviceMatch.js";

describe("matching a salon's services by name", () => {
  it("ignores spacing, half-spaces and Arabic letters, never the words", () => {
    expect(serviceNameKey("كوتاهي  مو")).toBe(serviceNameKey("کوتاهی مو"));
    expect(serviceNameKey("ناخن‌کاشت")).toBe(serviceNameKey("ناخن کاشت"));
    expect(serviceNameKey("کوتاهی مو")).not.toBe(serviceNameKey("رنگ مو"));
    expect(serviceNameKey("براشینگ و سشوار")).toBe(serviceNameKey("براشینگ-سشوار"));
    expect(serviceNameKey("براشینگ، سشوار")).toBe(serviceNameKey("براشینگ / سشوار"));
    expect(serviceNameKey("وکس")).toBe("وکس");
    expect(serviceNameKey("کوتاهی مو")).not.toBe(serviceNameKey("کوتاهی موی کودک"));
  });
  it("returns the salon's own names in order, or null when one is missing", () => {
    const services = [{ name: "رنگ مو" }, { name: "كوتاهي مو" }];
    expect(matchServiceNames(services, ["کوتاهی مو", "رنگ مو"])).toEqual(["كوتاهي مو", "رنگ مو"]);
    expect(matchServiceNames(services, ["کوتاهی مو", "مانیکور"])).toBeNull();
  });
});
