import { describe, it, expect } from "vitest";
import { CLIENT_CATEGORIES } from "../../app/shared/constants/clientCategories.js";
import {
  CLIENT_SERVICES,
  findClientService,
  offersClientService,
  searchClientServices,
  servicesOfCategory
} from "../../app/shared/constants/clientServices.js";
import { SERVICE_CATALOG } from "../../app/shared/constants/serviceCatalog.js";
import { BEAUTY_EMOJIS, getBeautyEmoji } from "../../app/shared/constants/beautyEmoji.js";
import { normalizeServiceText } from "../../app/shared/lib/serviceText.js";

/**
 * Owner, 2026-11-12: a client picked a category and the service she wanted was not in it. The list under the tiles is
 * now ours and complete; these tests fail the day a new menu service or icon is added without a place in it.
 */
const names = new Set(CLIENT_SERVICES.map((service) => normalizeServiceText(service.name)));
const searchable = (name) => {
  const key = normalizeServiceText(name);
  return CLIENT_SERVICES.some((service) => service.key === key || service.wordKeys.includes(key));
};

// Icons a salon may pick that are a look, not a service (a sparkle, a heart, a «VIP» badge, a discount).
const DECOR_ICONS = new Set(["palette", "sparkles", "heart", "rose", "vip", "discount", "express", "tattoo_machine"]);

describe("the client's list of services", () => {
  it("has every service of the ready-made menu, by its own name or a phrase of it", () => {
    const missing = SERVICE_CATALOG.filter((row) => !names.has(normalizeServiceText(row.name)) && !searchable(row.name));
    expect(missing.map((row) => row.name)).toEqual([]);
  });

  it("uses every icon a salon can give a service", () => {
    const used = new Set(CLIENT_SERVICES.map((service) => service.icon));
    const missing = BEAUTY_EMOJIS.filter((icon) => !used.has(icon.id) && !DECOR_ICONS.has(icon.id)).map((icon) => icon.id);
    expect(missing).toEqual([]);
  });

  it("puts every service under a tile, and every tile has services", () => {
    const tiles = new Set(CLIENT_CATEGORIES.map((category) => category.id));
    expect(CLIENT_SERVICES.filter((service) => !tiles.has(service.category)).map((service) => service.name)).toEqual([]);
    for (const category of CLIENT_CATEGORIES) expect(servicesOfCategory(category.id).length, category.label).toBeGreaterThan(0);
  });

  it("has known icons, unique ids and unique names", () => {
    expect(CLIENT_SERVICES.filter((service) => !getBeautyEmoji(service.icon)).map((service) => service.icon)).toEqual([]);
    expect(new Set(CLIENT_SERVICES.map((service) => service.id)).size).toBe(CLIENT_SERVICES.length);
    expect(names.size).toBe(CLIENT_SERVICES.length);
  });
});

describe("searching a service", () => {
  const first = (text) => searchClientServices(text)[0]?.name;

  it("finds a service by its name, whatever the spaces or Arabic letters", () => {
    expect(first("ژلیش")).toBe("ژلیش ناخن");
    expect(first("کوتاهي مو")).toBe("کوتاهی مو");
    expect(first("کاشت‌ناخن")).toBe("کاشت ناخن");
  });

  it("finds a service by what people call it, and says it is a near match", () => {
    expect(first("اپیلاسیون")).toBe("وکس و اپیلاسیون");
    const mesh = searchClientServices("مش")[0];
    expect(mesh.name).toBe("لایت و هایلایت");
    expect(searchClientServices("بند انداختن")[0].name).toBe("اصلاح صورت با نخ");
    expect(searchClientServices("تاتو لب")[0]).toMatchObject({ name: "میکروپیگمنتیشن لب" });
  });

  it("with two letters, matches whole words only", () => {
    const hair = searchClientServices("مو", { limit: 50 }).map((service) => service.name);
    expect(hair).toContain("کوتاهی مو");
    expect(hair).not.toContain("وکس و اپیلاسیون"); // «موبری» starts with «مو» but is not hair
  });

  it("finds nothing for nothing", () => {
    expect(searchClientServices("   ")).toEqual([]);
    expect(searchClientServices("قطار")).toEqual([]);
  });
});

describe("which of a client's places do a service", () => {
  const gelish = findClientService("gelish");

  it("matches the salon's own name for it, or its icon", () => {
    expect(offersClientService({ name: "لاک ژل", emoji: "" }, gelish)).toBe(true);
    expect(offersClientService({ name: "ژلیش دست", emoji: "" }, gelish)).toBe(true);
    expect(offersClientService({ name: "لاک دست و پا", emoji: "nail_polish" }, gelish)).toBe(true);
  });

  it("does not match another service of the same field", () => {
    expect(offersClientService({ name: "کاشت ناخن", emoji: "gel_nails" }, gelish)).toBe(false);
    expect(offersClientService({ name: "مانیکور", emoji: "manicure" }, gelish)).toBe(false);
    expect(offersClientService({ name: "میکاپ ماندگار", emoji: "" }, gelish)).toBe(false);
    // Same icon, but the name says it is the foot one.
    expect(offersClientService({ name: "ژلیش پا", emoji: "nail_polish" }, findClientService("polish"))).toBe(false);
  });
});

describe("the parts of a package (owner, 2026-11-12: «فقط پدیکور می‌خواست»)", () => {
  it("splits a package of known services, and leaves single services with «و» alone", async () => {
    const { packageParts } = await import("../../app/shared/constants/clientServices.js");
    expect(packageParts("پکیج مانیکور و پدیکور")).toEqual(["مانیکور", "پدیکور"]);
    expect(packageParts("مانیکور + ژلیش ناخن")).toEqual(["مانیکور", "ژلیش ناخن"]);
    expect(packageParts("وکس و اپیلاسیون")).toEqual([]);
    expect(packageParts("رنگ و لایت")).toEqual([]);
    expect(packageParts("پکیج کامل عروس")).toEqual([]);
    expect(packageParts("پدیکور")).toEqual([]);
  });
});
