import { describe, it, expect } from "vitest";
import { groupServicesByCategory, serviceCategoryId } from "../../app/shared/lib/serviceGroups.js";

const svc = (id, name, emoji = "") => ({ id, name, emoji });

describe("groupServicesByCategory", () => {
  it("groups by the icon's category, in catalog order, keeping each service's order", () => {
    const groups = groupServicesByCategory([
      svc(1, "پدیکور", "pedicure"),
      svc(2, "کوتاهی مو", "haircut"),
      svc(3, "مانیکور", "manicure"),
      svc(4, "رنگ مو", "hair_color")
    ]);
    expect(groups.map((g) => g.id)).toEqual(["hair", "nails"]);
    expect(groups[0].items.map((s) => s.id)).toEqual([2, 4]);
    expect(groups[1].items.map((s) => s.id)).toEqual([1, 3]);
  });

  it("falls back to the name, then to «سایر» last", () => {
    expect(serviceCategoryId(svc(1, "میکاپ عروس"))).not.toBe("other");
    const groups = groupServicesByCategory([svc(1, "چیز عجیب xyz"), svc(2, "کوتاهی مو", "haircut")]);
    expect(groups.map((g) => g.id)).toEqual(["hair", "other"]);
    expect(groups[1].fa).toBe("سایر");
  });

  it("copes with nothing", () => {
    expect(groupServicesByCategory(undefined)).toEqual([]);
    expect(groupServicesByCategory([])).toEqual([]);
  });
});
