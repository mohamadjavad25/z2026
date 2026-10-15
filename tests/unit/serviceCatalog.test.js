import { describe, it, expect } from "vitest";
import {
  BEAUTY_EMOJIS,
  EMOJI_CATEGORIES,
  getBeautyEmoji,
  guessBeautyEmojiId,
  isBeautyEmojiId
} from "../../app/shared/constants/beautyEmoji.js";
import icons, { ICON_ALIASES, PALETTE } from "../../app/shared/constants/beautyArt/inkLight.js";
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

  it("hides the retired groups (men's grooming etc.) but still resolves their ids", () => {
    const visible = new Set(BEAUTY_EMOJIS.map((item) => item.id));
    for (const id of ["barber", "men_cut", "beard", "razor", "groom", "yoga", "tattoo"]) {
      expect(visible.has(id), id).toBe(false);
      expect(getBeautyEmoji(id)?.svg, id).toMatch(/^<svg/);
    }
    expect(EMOJI_CATEGORIES.some((item) => item.id === "men")).toBe(false);
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

  it("draws every icon with the brand palette only, and every gradient it uses exists", () => {
    const allowed = new Set(Object.values(PALETTE).map((hex) => hex.toLowerCase()));
    for (const id of PERSISTED_IDS.concat(BEAUTY_EMOJIS.map((item) => item.id))) {
      const svg = getBeautyEmoji(id).svg;
      for (const hex of svg.match(/#[0-9a-f]{3,8}\b/gi) || []) expect(allowed.has(hex.toLowerCase()), `${id} ${hex}`).toBe(true);
      const defined = new Set([...svg.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
      for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) expect(defined.has(ref), `${id} url(#${ref})`).toBe(true);
    }
  });

  it("only aliases to drawings that exist, and never chains aliases", () => {
    for (const [id, target] of Object.entries(ICON_ALIASES)) {
      expect(icons[target], `${id} -> ${target}`).toBeTruthy();
      expect(ICON_ALIASES[target], `${id} -> ${target}`).toBeUndefined();
      expect(isBeautyEmojiId(id), id).toBe(true);
    }
  });

  it("guesses the fitting icon from common service names", () => {
    const cases = {
      "کوتاهی مو": "haircut",
      "کوتاهی و مدل مو": "haircut",
      "مش و لایت": "highlights",
      "رنگ ریشه": "root_touch",
      "حالت‌دهی و فر": "hair_styling",
      "اکستنشن مو": "hair_extension",
      "اکستنشن مژه": "lash_ext",
      "شستشو و ماسک مو": "hair_wash",
      "بوتاکس مو": "hair_botox",
      "بوتاکس": "injection",
      "فیلر لب": "filler",
      "آرایش لب": "lips",
      "لیزر پوست": "laser",
      "حذف موهای زائد": "waxing",
      "تتو ابرو": "permanent_makeup",
      "تاتو": "tattoo",
      "اصلاح صورت": "threading",
      "لمینت و لیفت ابرو": "brow_lamination",
      "لیفت و لمینت مژه": "lash_lift",
      "رنگ ابرو": "brow_tint",
      "کلاس میکاپ": "makeup_lesson",
      "هیدرا فیشیال": "hydrafacial",
      "لايه برداري": "peeling",
      "آرايش عروس": "bridal",
      "درمان آکنه و جوش": "acne",
      "ژلیش ناخن": "nail_polish",
      "ناخن کوتاه": "manicure",
      "مشاوره مراقبت پوست": "skincare"
    };
    for (const [name, id] of Object.entries(cases)) expect(guessBeautyEmojiId(name), name).toBe(id);
    expect(guessBeautyEmojiId("مشاوره")).toBe("consult");
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
    expect(SERVICE_CATALOG.length).toBeGreaterThan(50);
    for (const service of SERVICE_CATALOG) {
      expect(isBeautyEmojiId(service.emoji), service.name).toBe(true);
      expect(categories.has(service.category), service.name).toBe(true);
      expect(service.name && service.price && service.duration && service.hint, service.name).toBeTruthy();
      expect(names.has(service.name), `duplicate ${service.name}`).toBe(false);
      names.add(service.name);
    }
  });

  it("has no men's grooming services", () => {
    expect(SERVICE_CATALOG.some((item) => /آقایان|مردانه|داماد/.test(item.name))).toBe(false);
  });

  it("only uses icons that are offered in the picker", () => {
    const visible = new Set(BEAUTY_EMOJIS.map((item) => item.id));
    for (const service of SERVICE_CATALOG) expect(visible.has(service.emoji), service.name).toBe(true);
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
    expect(categoriesForSpecialties("آرایشگاه مردانه")).toEqual([]);
  });
});
