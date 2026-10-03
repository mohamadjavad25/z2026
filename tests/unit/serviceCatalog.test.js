import { describe, it, expect } from "vitest";
import {
  BEAUTY_EMOJIS,
  EMOJI_CATEGORIES,
  getBeautyEmoji,
  guessBeautyEmojiId,
  isBeautyEmojiId
} from "../../app/shared/constants/beautyEmoji.js";
import { SERVICE_CATALOG, categoriesForSpecialties } from "../../app/shared/constants/serviceCatalog.js";
import { beautySpecialtyOptions } from "../../app/shared/constants/roles.js";

// Icon ids are persisted in the database (services + bookings), so none of
// these may ever disappear. Add new ids freely; never remove one.
const PERSISTED_IDS = [
  "haircut", "hair_color", "highlights", "blowdry", "updo", "hair_styling", "keratin", "hair_extension",
  "braid", "hair_wash", "barber", "comb", "lipstick", "bridal", "eyeshadow", "makeup_brush", "lips", "tattoo",
  "eyebrow", "lash_ext", "lash_lift", "manicure", "pedicure", "nail_art", "gel_nails", "facial", "skincare",
  "serum", "hydrafacial", "peeling", "injection", "laser", "teeth", "waxing", "massage", "spa", "aroma",
  "tanning", "body_contour", "perfume", "rejuvenation", "mirror", "consult", "gift", "vip", "sparkles",
  "heart", "rose", "gem"
];

describe("beauty icon pack", () => {
  it("keeps every previously persisted icon id", () => {
    for (const id of PERSISTED_IDS) expect(isBeautyEmojiId(id), id).toBe(true);
  });

  it("has unique ids, valid categories and well-formed svg for every icon", () => {
    const ids = BEAUTY_EMOJIS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(EMOJI_CATEGORIES.map((item) => item.id));
    for (const item of BEAUTY_EMOJIS) {
      expect(categories.has(item.category), `${item.id} category`).toBe(true);
      expect(item.fa, `${item.id} fa`).toBeTruthy();
      expect(item.svg.startsWith("<svg") && item.svg.endsWith("</svg>"), `${item.id} svg`).toBe(true);
      expect(item.svg).not.toMatch(/<script|onload=|javascript:/i);
    }
  });

  it("gives every category an existing representative icon", () => {
    for (const category of EMOJI_CATEGORIES) {
      expect(getBeautyEmoji(category.icon), category.id).not.toBeNull();
    }
  });

  it("guesses a valid icon for every keyword rule target", () => {
    for (const name of ["کوتاهی مو", "میکاپ عروس", "ژلیش ناخن", "حجامت", "یوگا", "لیزر موهای زائد"]) {
      expect(isBeautyEmojiId(guessBeautyEmojiId(name)), name).toBe(true);
    }
    expect(guessBeautyEmojiId("")).toBe("");
  });
});

describe("service catalog", () => {
  it("only references existing icons and categories, with unique names", () => {
    const categories = new Set(EMOJI_CATEGORIES.map((item) => item.id));
    const names = new Set();
    expect(SERVICE_CATALOG.length).toBeGreaterThan(100);
    for (const service of SERVICE_CATALOG) {
      expect(isBeautyEmojiId(service.emoji), service.name).toBe(true);
      expect(categories.has(service.category), service.name).toBe(true);
      expect(service.name && service.price && service.duration && service.hint, service.name).toBeTruthy();
      expect(names.has(service.name), `duplicate ${service.name}`).toBe(false);
      names.add(service.name);
    }
  });

  it("covers every category", () => {
    for (const category of EMOJI_CATEGORIES) {
      expect(SERVICE_CATALOG.some((item) => item.category === category.id), category.id).toBe(true);
    }
  });

  it("maps every signup specialty to at least one catalog category", () => {
    for (const option of beautySpecialtyOptions) {
      expect(categoriesForSpecialties(option).length, option).toBeGreaterThan(0);
    }
    expect(categoriesForSpecialties("")).toEqual([]);
  });
});
