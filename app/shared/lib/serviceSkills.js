import { guessBeautyEmojiId } from "../constants/beautyEmoji.js";

/**
 * Which team member can do which service, worked out from what they said they do.
 *
 * A member's skills come from their field of activity (an artist's own profile `service`, or the
 * salon-set `role` for the manager's own row), e.g. "ناخن، میکاپ" or "رنگ و لایت". A service's
 * skills come from its icon and its name. A member is matched to a service when they share a skill
 * group. The salon can still add or remove anyone by hand; see resolveServiceStaff.
 *
 * Groups are deliberately finer than the icon categories: a colourist is not offered for a haircut
 * just because both are "hair".
 */
export const SKILL_GROUPS = [
  {
    id: "nails",
    label: "ناخن",
    icons: ["manicure", "pedicure", "nail_polish", "gel_nails", "nail_art", "french_nails", "nail_spa"],
    words: ["ناخن", "مانیکور", "پدیکور", "ژلیش", "لاک", "پارافین", "فرنچ"]
  },
  {
    id: "hair_cut_style",
    label: "کوتاهی و حالت مو",
    icons: ["haircut", "kids_haircut", "men_cut", "blowdry", "hair_styling", "updo", "braid", "hair_wash", "barber"],
    words: ["کوتاهی", "مدل مو", "براشینگ", "سشوار", "شینیون", "بافت", "حالت دهی", "حالتدهی", "شستشو"]
  },
  {
    id: "hair_color",
    label: "رنگ و لایت",
    icons: ["hair_color", "root_touch", "highlights"],
    words: ["رنگ مو", "رنگ و لایت", "رنگولایت", "رنگ ریشه", "لایت", "هایلایت", "بالیاژ", "آمبره", "دکلره"]
  },
  {
    id: "hair_treatment",
    label: "کراتین و احیا",
    icons: ["keratin", "hair_botox", "hair_straight", "hair_perm", "scalp_care"],
    words: ["کراتین", "احیا", "بوتاکس مو", "صافی", "بروساژ", "پروتئین", "فر دائمی", "پرم"]
  },
  {
    id: "hair_extension",
    label: "اکستنشن مو",
    icons: ["hair_extension"],
    words: ["اکستنشن مو"]
  },
  {
    id: "makeup",
    label: "میکاپ",
    icons: ["lipstick", "party_makeup", "makeup_brush", "eyeshadow", "eyeliner", "lips", "makeup_lesson"],
    words: ["میکاپ", "آرایش", "گریم", "کانتور", "خط چشم"]
  },
  {
    id: "bridal",
    label: "عروس",
    icons: ["bridal", "crown", "ring", "bouquet", "groom"],
    words: ["عروس", "داماد", "عقد", "نامزدی"]
  },
  {
    id: "brow_lash",
    label: "ابرو و مژه",
    icons: ["eyebrow", "threading", "brow_lamination", "brow_tint", "permanent_makeup", "lash_ext", "lash_lift", "lash_tint"],
    words: ["ابرو", "مژه", "میکروبلیدینگ", "بند انداختن"]
  },
  {
    id: "skin",
    label: "پوست",
    icons: ["facial", "hydrafacial", "microneedling", "peeling", "face_mask", "acne", "oxygen_facial", "led_therapy", "serum", "skincare"],
    words: ["پوست", "پاکسازی", "فیشیال", "هیدرافیشیال", "لایه برداری", "لایهبرداری", "پیلینگ", "آکنه", "مزوتراپی", "میکرونیدلینگ", "ماسک صورت"],
    // Laser work needs its own operator, and "پوست سر" is the scalp.
    unless: ["لیزر", "پوست سر"]
  },
  {
    id: "clinic",
    label: "تزریق",
    icons: ["injection", "filler", "prp", "hifu"],
    words: ["تزریق", "فیلر", "بوتاکس", "پلاسما", "هایفو"],
    // "بوتاکس مو" is a hair treatment, not an injection.
    unless: ["بوتاکس مو"]
  },
  {
    id: "laser",
    label: "لیزر",
    icons: ["laser"],
    words: ["لیزر"]
  },
  {
    id: "waxing",
    label: "اپیلاسیون و وکس",
    icons: ["waxing"],
    words: ["اپیلاسیون", "وکس"]
  },
  {
    id: "body_spa",
    label: "ماساژ و اسپا",
    icons: ["massage", "stone_massage", "spa", "body_contour", "tanning"],
    words: ["ماساژ", "اسپا", "برنزه", "لاغری"],
    // A hand or foot spa is nail work.
    unless: ["اسپای دست", "اسپای پا", "اسپای ناخن"]
  }
];

/** Persian text in one comparable form: Arabic ي/ك, half-spaces and spaces don't matter. */
function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\s‌‏‎\-_]/g, "");
}

const GROUPS = SKILL_GROUPS.map((group) => ({
  ...group,
  normWords: group.words.map(normalize),
  normUnless: (group.unless || []).map(normalize)
}));

function groupsInText(text) {
  const norm = normalize(text);
  if (!norm) return [];
  return GROUPS
    .filter((group) => group.normWords.some((word) => norm.includes(word)))
    .filter((group) => !group.normUnless.some((word) => norm.includes(word)))
    .map((group) => group.id);
}

/** Skill groups a member says they do, from their field-of-activity text ("ناخن، میکاپ"). */
export function skillGroupsForStaff(person) {
  const text = [person?.artist_service, person?.role].filter(Boolean).join("، ");
  const result = new Set();
  for (const part of text.split(/[,،\n/]/)) groupsInText(part).forEach((id) => result.add(id));
  return [...result];
}

/** Skill groups a service needs, from its icon and its name. */
export function skillGroupsForService(service) {
  const result = new Set(groupsInText(service?.name));
  const icon = String(service?.emoji || "").trim() || guessBeautyEmojiId(service?.name);
  const byIcon = GROUPS.find((group) => group.icons.includes(icon));
  // The icon is only a hint when the name already said something more specific.
  if (byIcon && (!result.size || result.has(byIcon.id) || byIcon.id === "bridal")) result.add(byIcon.id);
  if (!result.size && byIcon) result.add(byIcon.id);
  return [...result];
}

export function staffCanDoService(person, service) {
  const serviceGroups = skillGroupsForService(service);
  if (!serviceGroups.length) return false;
  const staffGroups = skillGroupsForStaff(person);
  return serviceGroups.some((id) => staffGroups.includes(id));
}

function idList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || "").split(",").map((id) => id.trim()).filter(Boolean);
}

/**
 * The members who do a service: everyone whose skills match it, plus those the salon added by hand,
 * minus those it removed by hand. `manual` and `excluded` are what's stored on the service.
 */
export function resolveServiceStaff(service, staffList = [], { manual, excluded } = {}) {
  const existing = new Set(staffList.map((person) => String(person.id)));
  const added = idList(manual ?? service?.staff_ids).filter((id) => existing.has(id));
  const removed = new Set(idList(excluded ?? service?.staff_excluded_ids));
  const auto = staffList
    .filter((person) => staffCanDoService(person, service))
    .map((person) => String(person.id));
  const effective = [];
  for (const id of [...auto, ...added]) {
    if (!removed.has(id) && !effective.includes(id)) effective.push(id);
  }
  return { effective, auto };
}

/**
 * Turns the list the salon wants for a service into what to store: the hand-added ids (wanted but not
 * matched) and the hand-removed ids (matched but not wanted). Members who join later and match the
 * service are then picked up automatically.
 */
export function splitServiceStaffChoice(service, staffList, wantedIds) {
  const wanted = idList(wantedIds);
  const { auto } = resolveServiceStaff(service, staffList, { manual: [], excluded: [] });
  return {
    manual: wanted.filter((id) => !auto.includes(id)),
    excluded: auto.filter((id) => !wanted.includes(id))
  };
}
