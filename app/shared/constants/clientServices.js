import { normalizeServiceText } from "../lib/serviceText.js";

/**
 * Every service a client can ask for, under the category tiles of «چه کاری می‌خوای؟» (owner, 2026-11-12: «تمام خدمات
 * رو خودمون آماده بذاریم … چیزی از دستمون در نره»). The list is ours, not built from what salons typed, so a client
 * finds the service even when none of their salons offers it yet; tests/unit/clientServices.test.js proves that every
 * service of the ready-made menu (serviceCatalog.js) and every icon a salon can give a service is here.
 *
 * Each row: [id, name, icon, category, words]. `id` is only used in the app (never stored); `name` is what the client
 * sees and what a request carries; `icon` a beautyEmoji id; `words` other ways people say it (searched too).
 * Order inside a category is the order the client sees: the most asked first.
 */
const ROWS = [
  // ── ناخن ──
  ["gelish", "ژلیش ناخن", "nail_polish", "nails", "ژلیش، لاک ژل، ژل لاک"],
  ["nail_set", "کاشت ناخن", "gel_nails", "nails", "کاشت، پودر، ژل کاشت، ناخن مصنوعی، تیپ ناخن"],
  ["nail_refill", "ترمیم ناخن", "gel_nails", "nails", "ترمیم، پر کردن ناخن"],
  ["manicure", "مانیکور", "manicure", "nails", "مانیکور، کوتیکول"],
  ["pedicure", "پدیکور", "pedicure", "nails", "پدیکور، ناخن پا"],
  ["mani_pedi", "پکیج مانیکور و پدیکور", "manicure", "nails", "مانیکور و پدیکور، دست و پا"],
  ["nail_art", "طراحی ناخن", "nail_art", "nails", "طراحی ناخن، نیل آرت، نگین ناخن، طرح ناخن"],
  ["french", "ناخن فرنچ", "french_nails", "nails", "فرنچ"],
  ["toe_gelish", "ژلیش پا", "nail_polish", "nails", "لاک پا، ژلیش پا"],
  ["polish", "لاک ساده", "nail_polish", "nails", "لاک زدن، لاک ناخن"],
  ["hand_spa", "پارافین و اسپای دست", "nail_spa", "nails", "پارافین، اسپای دست"],

  // ── مو ──
  ["haircut", "کوتاهی مو", "haircut", "hair", "کوتاهی، کوتاه کردن مو، مدل مو، چتری، لایه"],
  ["hair_color", "رنگ مو", "hair_color", "hair", "رنگ کردن مو، تناژ، فشن کالر"],
  ["root", "رنگ ریشه", "root_touch", "hair", "ریشه، ریتاچ"],
  ["highlights", "لایت و هایلایت", "highlights", "hair", "مش، لایت، هایلایت، دکلره"],
  ["balayage", "بالیاژ و آمبره", "highlights", "hair", "بالیاژ، آمبره، سامبره"],
  ["keratin", "کراتین مو", "keratin", "hair", "کراتین، پروتئین مو، احیا مو"],
  ["hair_botox", "بوتاکس مو", "hair_botox", "hair", "بوتاکس مو، هیر بوتاکس"],
  ["straight", "صافی و بروساژ", "hair_straight", "hair", "صافی مو، بروساژ، اسموتی، مو صاف"],
  ["blowdry", "براشینگ و سشوار", "blowdry", "hair", "سشوار، براشینگ، براش"],
  ["styling", "حالت‌دهی و فر", "hair_styling", "hair", "فر کردن، ویو، بابلیس، اتو مو"],
  ["updo", "شینیون مجلسی", "updo", "hair", "شینیون، مو جمع، نیمه جمع، مدل مو مجلسی"],
  ["braid", "بافت مو", "braid", "hair", "بافت، بافتن مو، میکروبراید"],
  ["extension", "اکستنشن مو", "hair_extension", "hair", "اکستنشن، اکستنژن، مو مصنوعی"],
  ["perm", "فر دائمی", "hair_perm", "hair", "پرم، فر دائم"],
  ["hair_wash", "شستشو و ماسک مو", "hair_wash", "hair", "شستشو مو، شامپو، ماسک مو"],
  ["kids_cut", "کوتاهی کودک", "kids_haircut", "hair", "کوتاهی بچه، کوتاهی کودک، مو بچه"],
  ["scalp", "مراقبت پوست سر", "scalp_care", "hair", "پوست سر، شوره"],
  ["hair_loss", "درمان ریزش مو", "hair_loss", "hair", "ریزش مو، تقویت مو"],
  ["transplant", "کاشت مو", "hair_transplant", "hair", "کاشت مو، پیوند مو"],

  // ── ابرو و مژه ──
  ["brow_shape", "اصلاح ابرو", "eyebrow", "brows", "ابرو، برداشتن ابرو، طراحی ابرو"],
  ["threading", "اصلاح صورت با نخ", "threading", "brows", "اصلاح با نخ، بند انداختن، بند صورت، اصلاح صورت"],
  ["lash_ext", "اکستنشن مژه", "lash_ext", "brows", "کاشت مژه، مژه مصنوعی، اکستنشن مژه"],
  ["lash_refill", "ترمیم مژه", "lash_ext", "brows", "ریفیل مژه، ترمیم مژه"],
  ["lash_lift", "لیفت و لمینت مژه", "lash_lift", "brows", "لیفت مژه، لمینت مژه، فر مژه"],
  ["brow_lam", "لمینت و لیفت ابرو", "brow_lamination", "brows", "لمینت ابرو، لیفت ابرو"],
  ["brow_tint", "رنگ ابرو", "brow_tint", "brows", "حنا ابرو، هنا ابرو، رنگ ابرو"],
  ["lash_tint", "رنگ مژه", "lash_tint", "brows", "رنگ مژه"],
  ["microblading", "میکروبلیدینگ ابرو", "permanent_makeup", "brows", "میکروبلیدینگ، فیبروز، هاشور ابرو، تاتو ابرو"],
  ["lip_pmu", "میکروپیگمنتیشن لب", "permanent_makeup", "brows", "تاتو لب، شیدینگ لب، رژ دائم"],

  // ── میکاپ ──
  ["party_makeup", "میکاپ مجلسی", "party_makeup", "makeup", "آرایش مجلسی، میکاپ مهمونی"],
  ["simple_makeup", "میکاپ ساده", "lipstick", "makeup", "آرایش ساده، آرایش روزانه، میکاپ"],
  ["eye_makeup", "آرایش چشم", "eyeshadow", "makeup", "سایه چشم، آرایش چشم"],
  ["contour", "گریم و کانتور", "makeup_brush", "makeup", "گریم، کانتور"],
  ["eyeliner", "خط چشم", "eyeliner", "makeup", "خط چشم، لاینر"],
  ["lips", "آرایش لب", "lips", "makeup", "رژ لب، آرایش لب"],
  ["makeup_lesson", "آموزش خودآرایی", "makeup_lesson", "makeup", "کلاس آرایش، آموزش آرایش، خودآرایی"],

  // ── عروس ──
  ["bride_makeup", "میکاپ عروس", "bridal", "bridal", "آرایش عروس، عروس"],
  ["bride_updo", "شینیون عروس", "updo", "bridal", "شینیون عروس، مو عروس"],
  ["bride_package", "پکیج کامل عروس", "crown", "bridal", "پکیج عروس"],
  ["engagement", "پکیج نامزدی و عقد", "ring", "bridal", "عقد، نامزدی، بله برون"],
  ["bride_guests", "آرایش همراهان عروس", "bouquet", "bridal", "ساقدوش، همراه عروس"],

  // ── پوست ──
  ["facial", "پاکسازی پوست", "facial", "skin", "پاکسازی، فیشیال، پاکسازی صورت"],
  ["hydrafacial", "هیدرافیشیال", "hydrafacial", "skin", "هیدرافیشیال، آبرسانی پوست"],
  ["microneedling", "میکرونیدلینگ", "microneedling", "skin", "درماپن، میکرونیدلینگ"],
  ["peeling", "پیلینگ و لایه‌برداری", "peeling", "skin", "لایه برداری، پیلینگ"],
  ["acne", "درمان آکنه و جوش", "acne", "skin", "آکنه، جوش، جای جوش"],
  ["mesotherapy", "مزوتراپی صورت", "serum", "skin", "مزو، مزوتراپی"],
  ["face_mask", "ماسک صورت", "face_mask", "skin", "ماسک صورت"],
  ["oxygen", "اکسیژن‌تراپی", "oxygen_facial", "skin", "اکسیژن تراپی"],
  ["led", "نور درمانی LED", "led_therapy", "skin", "نوردرمانی، ال ای دی"],
  ["rejuvenation", "جوانسازی پوست", "rejuvenation", "skin", "جوانسازی، ضد چروک"],
  ["skin_consult", "مشاوره مراقبت پوست", "skincare", "skin", "روتین پوست، مشاوره پوست"],

  // ── تزریق و فیلر ──
  ["botox", "تزریق بوتاکس", "injection", "injection", "بوتاکس، چین و چروک"],
  ["filler", "تزریق فیلر", "filler", "injection", "فیلر، فیلر لب، حجم لب"],
  ["prp", "PRP و پلاسما", "prp", "injection", "پی آر پی، پلاسما"],
  ["hifu", "هایفو و لیفت صورت", "hifu", "injection", "هایفو، لیفت صورت"],
  ["thread_lift", "لیفت با نخ", "thread_lift", "injection", "لیفت با نخ، نخ لیفت"],
  ["doctor", "ویزیت پزشک زیبایی", "doctor", "injection", "دکتر زیبایی، پزشک زیبایی"],

  // ── لیزر و وکس ──
  ["laser_hair", "لیزر موهای زائد", "laser", "removal", "لیزر موهای زائد، لیزر بدن، لیزر مو"],
  ["waxing", "وکس و اپیلاسیون", "waxing", "removal", "اپیلاسیون، وکس، موبری، بیکینی"],
  ["full_wax", "وکس کامل بدن", "waxing", "removal", "اپیلاسیون کامل، وکس کامل"],
  ["face_wax", "وکس صورت و پشت لب", "waxing", "removal", "پشت لب، موی صورت، وکس صورت"],
  ["laser_skin", "لیزر پوست", "laser", "removal", "لیزر پوست، لیزر صورت، لک صورت"],

  // ── ماساژ و اسپا ──
  ["massage", "ماساژ آرامش‌بخش", "massage", "spa", "ماساژ، ماساژ بدن، ماساژ سوئدی"],
  ["stone_massage", "ماساژ سنگ داغ", "stone_massage", "spa", "سنگ داغ"],
  ["foot_massage", "ماساژ پا و رفلکسولوژی", "foot_massage", "spa", "ماساژ پا، رفلکسولوژی"],
  ["spa", "پکیج اسپا", "spa", "spa", "اسپا، جکوزی"],
  ["slimming", "لاغری و فرم‌دهی بدن", "body_contour", "spa", "لاغری، کویتیشن، فرم دهی بدن"],
  ["tanning", "برنزه", "tanning", "spa", "برنزه، سولاریوم"],
  ["sauna", "سونا و بخار", "sauna", "spa", "سونا، بخار"],
  ["moroccan", "حمام مراکشی", "moroccan_bath", "spa", "حمام مراکشی، کیسه کشی"],
  ["scrub", "اسکراب بدن", "body_scrub", "spa", "اسکراب"],
  ["aroma", "آروماتراپی", "aroma", "spa", "آروماتراپی، اسانس درمانی"],
  ["hijama", "حجامت", "hijama", "spa", "حجامت، بادکش"],

  // ── تتو ──
  ["tattoo", "تتو", "tattoo", "tattoo", "تتو، تاتو، خالکوبی"],
  ["henna", "حنا و طراحی روی پوست", "henna", "tattoo", "حنا، نقاشی روی بدن"],
  ["tattoo_removal", "پاک کردن تتو", "laser", "tattoo", "رفع تتو، پاک کردن تاتو"],
  ["gem", "نگین و جواهر", "gem", "tattoo", "نگین، جواهر، نگین دندان"],

  // ── پیرسینگ ──
  ["piercing", "پیرسینگ", "piercing", "piercing", "پیرسینگ، پیرسینگ بینی، پیرسینگ ناف"],
  ["ear_piercing", "سوراخ کردن گوش", "piercing", "piercing", "سوراخ کردن گوش، گوش سوراخ"],

  // ── آقایان ──
  ["men_cut", "کوتاهی آقایان", "men_cut", "men", "اصلاح سر، مدل مو مردانه، کوتاهی مردانه"],
  ["beard", "ریش و خط ریش", "beard", "men", "ریش، خط ریش"],
  ["razor", "اصلاح با تیغ", "razor", "men", "تیغ، اصلاح صورت با تیغ"],
  ["barber_package", "پکیج آقایان", "barber", "men", "آرایشگاه مردانه، پکیج مردانه"],
  ["groom", "دامادی", "groom", "men", "داماد"],

  // ── بقیه ──
  ["face_consult", "مشاوره چهره", "mirror", "other", "فرم صورت، مشاوره چهره"],
  ["consult", "مشاوره", "consult", "other", "مشاوره"],
  ["training", "آموزش و کلاس", "training", "other", "کلاس، دوره آموزشی"],
  ["photo", "عکاسی و فیلمبرداری", "photoshoot", "other", "عکاسی، آتلیه، فیلمبرداری"],
  ["home", "خدمات در محل", "home_service", "other", "در منزل، در محل"],
  ["gift", "کارت هدیه و پکیج", "gift", "other", "کارت هدیه، پکیج هدیه"],
  ["kids", "ویژه کودکان", "kids_care", "other", "ویژه کودک، ویژه بچه"],
  ["yoga", "یوگا", "yoga", "other", "یوگا"],
  ["pilates", "پیلاتس", "pilates", "other", "پیلاتس"],
  ["fitness", "تناسب اندام", "fitness", "other", "بدنسازی، ورزش"],
  ["meditation", "مدیتیشن", "meditation", "other", "مدیتیشن"],
  ["nutrition", "تغذیه و رژیم", "nutrition", "other", "رژیم، تغذیه"],
  ["physio", "فیزیوتراپی", "physio", "other", "فیزیوتراپی"],
  ["counseling", "مشاوره روان", "counseling", "other", "روانشناس، روان درمانی"]
];

export const CLIENT_SERVICES = ROWS.map(([id, name, icon, category, words]) => {
  const phrases = words.split("،").map((word) => word.trim()).filter(Boolean);
  return {
    id,
    name,
    icon,
    category,
    words: phrases,
    key: normalizeServiceText(name),
    wordKeys: [...new Set(phrases.map(normalizeServiceText).filter(Boolean))],
    // Single words of the name and phrases, for a query of one or two letters («مو», «ژل»).
    tokens: [...new Set([name, ...phrases].flatMap((text) => text.split(/[\s\u200c]+/)).map(normalizeServiceText).filter(Boolean))]
  };
});

const BY_ID = new Map(CLIENT_SERVICES.map((service) => [service.id, service]));

export function findClientService(id) {
  return BY_ID.get(String(id || "")) || null;
}

/** A service of the list by its name as written («ژلیش ناخن», «ژلیش‌ناخن»), or null. */
export function findClientServiceByName(name) {
  const key = normalizeServiceText(name);
  return key ? CLIENT_SERVICES.find((service) => service.key === key) || null : null;
}

/**
 * The single services a package is made of, when every part is a service of the list: «پکیج مانیکور و پدیکور» →
 * [«مانیکور», «پدیکور»]. [] for anything else, also a single service with «و» in its name («وکس و اپیلاسیون»).
 */
export function packageParts(name) {
  const text = String(name || "").replace(/پکیج/g, " ").trim();
  const pieces = text.split(/\s+و\s+|\+|،|,/).map((piece) => piece.trim()).filter(Boolean);
  if (pieces.length < 2) return [];
  const found = pieces.map((piece) => findClientServiceByName(piece));
  return found.every(Boolean) ? [...new Set(found.map((service) => service.name))] : [];
}

/** The services under one tile, in the order the client sees them. */
export function servicesOfCategory(categoryId) {
  return CLIENT_SERVICES.filter((service) => service.category === categoryId);
}

/**
 * What a client typed, matched against the list: the service's own name first, then names that contain what was
 * typed, then services known by another phrase (`words`). Each result says how it matched (`name` | `word`) so the
 * list can put closer matches first (no label on screen, owner 2026-11-12). One or two letters match the start of a name or a whole word only.
 */
export function searchClientServices(text, { limit = 8 } = {}) {
  const query = normalizeServiceText(text);
  if (!query) return [];
  const long = query.length > 2;
  const phraseHit = (key) => long && (key.startsWith(query) || key.includes(query) || (key.length > 2 && query.includes(key)));
  const results = [];
  CLIENT_SERVICES.forEach((service, index) => {
    let rank = 0;
    if (service.key === query) rank = 5;
    else if (service.wordKeys.includes(query)) rank = 4;
    else if (service.key.startsWith(query)) rank = 3;
    else if (long ? service.key.includes(query) : service.tokens.includes(query)) rank = 2;
    else if (service.wordKeys.some(phraseHit)) rank = 1;
    if (rank) results.push({ service, rank, index });
  });
  results.sort((a, b) => b.rank - a.rank || a.index - b.index);
  return results.slice(0, limit).map(({ service, rank }) => ({ ...service, match: rank >= 2 ? "name" : "word" }));
}

/**
 * Whether one of a salon's or artist's own services (`{ name, emoji }`) is this service: its name has this service's
 * name or one of its phrases, or it has this service's icon and its name is not another service of that icon. Used to
 * find which of the client's places do what the client picked.
 */
export function offersClientService(own, service) {
  if (!own || !service) return false;
  const name = normalizeServiceText(own.name);
  if (!name) return false;
  if (name.includes(service.key) || (name.length > 2 && service.key.includes(name))) return true;
  if (service.wordKeys.some((word) => word.length > 2 && name.includes(word))) return true;
  if (!own.emoji || own.emoji !== service.icon) return false;
  return !CLIENT_SERVICES.some((other) => other !== service && other.icon === service.icon && name.includes(other.key));
}
