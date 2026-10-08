// Beauty icon pack -- vector icons for services, shown with <ServiceIcon/>
// (app/components/ServiceIcon.jsx) / <ServiceEmoji/>. Services and bookings
// store only the icon `id`; the art lives in ./beautyArt/luxe.js (inner SVG of
// a 128x128 canvas, glossy gradient objects on no background) and is wrapped here.
// Ids are persisted in the database -- never rename or remove one. Ids that are
// no longer offered stay resolvable: they borrow a drawing via LUXE_ALIASES and
// are hidden from the picker (see BEAUTY_EMOJIS vs getBeautyEmoji).

import luxe, { LUXE_ALIASES, LUXE_DEFS } from "./beautyArt/luxe.js";

// `icon` is the pack icon that represents the category in tabs and headers.
export const EMOJI_CATEGORIES = [
  { id: "hair", fa: "مو", en: "Hair", icon: "haircut" },
  { id: "makeup", fa: "آرایش", en: "Makeup", icon: "lipstick" },
  { id: "bridal", fa: "عروس", en: "Bridal", icon: "bridal" },
  { id: "brow_lash", fa: "ابرو و مژه", en: "Brows & lashes", icon: "lash_lift" },
  { id: "nails", fa: "ناخن", en: "Nails", icon: "nail_polish" },
  { id: "skin", fa: "پوست", en: "Skin", icon: "facial" },
  { id: "clinic", fa: "کلینیک", en: "Clinic", icon: "injection" },
  { id: "body", fa: "بدن و اسپا", en: "Body & spa", icon: "spa" }
];

// [id, fa, en, category, search tags]
const META = [
  // hair
  ["haircut", "کوتاهی مو", "Haircut", "hair", "کوتاه قیچی مدل مو cut scissors"],
  ["hair_color", "رنگ مو", "Hair color", "hair", "رنگ دکلره رنگ‌کردن dye color"],
  ["highlights", "لایت و هایلایت", "Highlights", "hair", "هایلایت بالیاژ آمبره لایت balayage ombre"],
  ["blowdry", "براشینگ و سشوار", "Blow-dry", "hair", "سشوار براشینگ سشوار کردن dryer"],
  ["updo", "شینیون و مدل مو", "Updo", "hair", "شینیون بستن مو updo bun مجلسی"],
  ["hair_styling", "حالت‌دهی و فر", "Styling & curls", "hair", "فر حالت‌دهی ویو wave curl"],
  ["keratin", "کراتین و احیا", "Keratin", "hair", "کراتین پروتئین احیا ترمیم مو keratin"],
  ["hair_extension", "اکستنشن مو", "Hair extensions", "hair", "اکستنشن اکستنژن کلیپ extension"],
  ["braid", "بافت مو", "Braids", "hair", "بافت بافتن میکروبراید braid"],
  ["hair_wash", "شستشو و ماسک مو", "Wash & mask", "hair", "شستشو شامپو ماسک مو wash shampoo"],
  ["comb", "برس و شانه", "Comb", "hair", "شانه برس سشوار ساده comb"],
  ["hair_botox", "بوتاکس مو", "Hair botox", "hair", "بوتاکس مو botox هیر"],
  ["hair_perm", "فر دائمی", "Perm", "hair", "فر دائمی پرم رولر perm curler"],
  ["scalp_care", "مراقبت پوست سر", "Scalp care", "hair", "پوست سر شوره scalp"],
  ["hair_loss", "درمان ریزش مو", "Hair loss treatment", "hair", "ریزش مو ریزش درمان loss"],
  ["hair_transplant", "کاشت مو", "Hair transplant", "hair", "کاشت مو پیوند transplant"],
  ["kids_haircut", "کوتاهی کودک", "Kids haircut", "hair", "کودک بچه کوتاهی بچگانه kids"],
  ["root_touch", "رنگ ریشه", "Root touch-up", "hair", "ریشه رنگ ریشه ریتاچ root"],
  ["hair_straight", "صافی و بروساژ", "Straightening", "hair", "صافی اتو بروساژ مو صاف straight"],
  // men
  ["barber", "آرایشگاه مردانه", "Barber", "men", "آرایشگاه مردانه آقایان barber"],
  ["beard", "ریش و خط ریش", "Beard", "men", "ریش خط ریش beard"],
  ["razor", "اصلاح با تیغ", "Razor shave", "men", "تیغ اصلاح سر razor shave"],
  ["men_cut", "کوتاهی آقایان", "Men's cut", "men", "کوتاهی مردانه آقایان men"],
  ["groom", "دامادی", "Groom", "men", "داماد دامادی groom suit"],
  // makeup
  ["lipstick", "آرایش و میکاپ", "Makeup", "makeup", "میکاپ آرایش رژ makeup lipstick"],
  ["eyeshadow", "سایه و آرایش چشم", "Eyeshadow", "makeup", "سایه چشم eyeshadow"],
  ["makeup_brush", "گریم و کانتور", "Contour & brush", "makeup", "گریم کانتور براش brush contour"],
  ["lips", "لب", "Lips", "makeup", "لب لب‌ها لیپ lip"],
  ["palette", "پالت رنگ", "Palette", "makeup", "پالت رنگ آرایش palette"],
  ["eyeliner", "خط چشم", "Eyeliner", "makeup", "خط چشم لاینر eyeliner"],
  ["makeup_lesson", "آموزش آرایش", "Makeup lesson", "makeup", "آموزش کلاس آرایش خودآرایی lesson"],
  ["party_makeup", "میکاپ مجلسی", "Party makeup", "makeup", "مجلسی پارتی میکاپ glam party"],
  // bridal
  ["bridal", "عروس", "Bride", "bridal", "عروس بریدال bride wedding"],
  ["crown", "تاج و پکیج VIP", "Crown", "bridal", "تاج ملکه vip crown"],
  ["bouquet", "دسته گل", "Bouquet", "bridal", "دسته گل گل bouquet"],
  ["ring", "حلقه و نامزدی", "Ring", "bridal", "حلقه نامزدی عقد ring"],
  ["party", "مراسم و جشن", "Party", "bridal", "مراسم جشن تولد party event"],
  // brows & lashes
  ["eyebrow", "اصلاح و لیفت ابرو", "Brows", "brow_lash", "ابرو اصلاح ابرو eyebrow"],
  ["lash_ext", "اکستنشن مژه", "Lash extensions", "brow_lash", "مژه اکستنشن کاشت مژه lash"],
  ["lash_lift", "لیفت مژه", "Lash lift", "brow_lash", "لیفت مژه لمینت مژه lift"],
  ["brow_lamination", "لمینت ابرو", "Brow lamination", "brow_lash", "لمینت ابرو lamination"],
  ["brow_tint", "رنگ ابرو", "Brow tint", "brow_lash", "رنگ ابرو حنا ابرو tint"],
  ["threading", "اصلاح با نخ", "Threading", "brow_lash", "نخ بند انداختن نخ threading"],
  ["lash_tint", "رنگ مژه", "Lash tint", "brow_lash", "رنگ مژه tint"],
  // nails
  ["manicure", "مانیکور", "Manicure", "nails", "مانیکور دست ناخن manicure"],
  ["pedicure", "پدیکور", "Pedicure", "nails", "پدیکور پا pedicure"],
  ["nail_art", "طراحی ناخن", "Nail art", "nails", "طراحی نیل آرت nail art"],
  ["gel_nails", "کاشت و ژلیش", "Gel nails", "nails", "کاشت ژلیش ژل پودر gel acrylic"],
  ["nail_polish", "لاک و لاک‌ژل", "Polish", "nails", "لاک لاک ژل polish"],
  ["french_nails", "ناخن فرنچ", "French nails", "nails", "فرنچ french"],
  ["nail_spa", "پارافین و اسپای دست", "Hand spa", "nails", "پارافین اسپا دست hand spa"],
  // skin
  ["facial", "فیشیال و پاکسازی", "Facial", "skin", "فیشیال پاکسازی صورت facial"],
  ["skincare", "مراقبت پوست", "Skincare", "skin", "کرم مراقبت پوست skincare"],
  ["serum", "سرم و مزوتراپی", "Serum", "skin", "سرم مزوتراپی serum mesotherapy"],
  ["hydrafacial", "هیدرافیشیال و آبرسانی", "Hydrafacial", "skin", "هیدرافیشیال آبرسانی hydra"],
  ["peeling", "لایه‌برداری و پیلینگ", "Peeling", "skin", "لایه‌برداری پیلینگ peeling"],
  ["microneedling", "میکرونیدلینگ", "Microneedling", "skin", "میکرونیدلینگ درمافن دورماپن needling"],
  ["face_mask", "ماسک صورت", "Face mask", "skin", "ماسک صورت ماسک ورقه‌ای mask"],
  ["acne", "درمان آکنه", "Acne treatment", "skin", "آکنه جوش لک acne"],
  ["oxygen_facial", "اکسیژن‌تراپی", "Oxygen facial", "skin", "اکسیژن oxygen"],
  ["led_therapy", "نور درمانی LED", "LED therapy", "skin", "ال ای دی نوردرمانی led light"],
  // clinic
  ["injection", "بوتاکس و تزریقات", "Injection", "clinic", "بوتاکس تزریق تزریقات botox injection"],
  ["laser", "لیزر", "Laser", "clinic", "لیزر موهای زائد laser"],
  ["teeth", "بلیچینگ و لمینت دندان", "Teeth", "clinic", "دندان بلیچینگ لمینت teeth"],
  ["filler", "فیلر", "Filler", "clinic", "فیلر ژل filler"],
  ["prp", "PRP و پلاسما", "PRP", "clinic", "پی آر پی پلاسما prp plasma"],
  ["hifu", "هایفو و لیفت", "HIFU", "clinic", "هایفو لیفت صورت hifu"],
  ["thread_lift", "کشیدگی با نخ", "Thread lift", "clinic", "نخ لیفت کشیدگی thread"],
  ["doctor", "ویزیت پزشک", "Doctor visit", "clinic", "پزشک دکتر ویزیت doctor"],
  // body & spa
  ["waxing", "اپیلاسیون و وکس", "Waxing", "body", "وکس اپیلاسیون موبری waxing"],
  ["massage", "ماساژ", "Massage", "body", "ماساژ massage"],
  ["spa", "اسپا", "Spa", "body", "اسپا استخر جکوزی spa"],
  ["aroma", "آروماتراپی", "Aromatherapy", "body", "آروما اسانس aroma"],
  ["tanning", "برنزه", "Tanning", "body", "برنزه سولاریوم tanning"],
  ["body_contour", "لاغری و فرم‌دهی بدن", "Body contour", "body", "لاغری فرم‌دهی بدن کویتیشن slimming"],
  ["perfume", "عطر", "Perfume", "body", "عطر ادکلن perfume"],
  ["sauna", "سونا و بخار", "Sauna", "body", "سونا بخار sauna steam"],
  ["body_scrub", "اسکراب بدن", "Body scrub", "body", "اسکراب لایه‌بردار بدن scrub"],
  ["moroccan_bath", "حمام مراکشی", "Moroccan bath", "body", "حمام مراکشی کیسه کف bath"],
  ["hijama", "حجامت", "Cupping", "body", "حجامت cupping"],
  ["stone_massage", "ماساژ سنگ داغ", "Hot stone massage", "body", "سنگ داغ hot stone"],
  ["foot_massage", "ماساژ پا و رفلکسولوژی", "Foot massage", "body", "پا رفلکسولوژی foot reflexology"],
  // tattoo & piercing
  ["tattoo", "تاتو", "Tattoo", "tattoo", "تاتو خالکوبی tattoo"],
  ["gem", "جواهر و نگین", "Gem", "tattoo", "جواهر نگین الماس gem"],
  ["henna", "حنا و طراحی روی پوست", "Henna", "tattoo", "حنا نقاشی بدن henna"],
  ["piercing", "پیرسینگ", "Piercing", "tattoo", "پیرسینگ گوشواره سوراخ piercing"],
  ["tattoo_machine", "دستگاه تاتو", "Tattoo machine", "tattoo", "دستگاه تاتو machine"],
  ["permanent_makeup", "میکروبلیدینگ و تاتو", "Permanent makeup", "brow_lash", "تاتو لب میکروبلیدینگ میکروپیگمنتیشن microblading pmu"],
  // wellness
  ["yoga", "یوگا", "Yoga", "wellness", "یوگا yoga"],
  ["pilates", "پیلاتس", "Pilates", "wellness", "پیلاتس توپ pilates"],
  ["fitness", "تناسب اندام و بدنسازی", "Fitness", "wellness", "بدنسازی ورزش تناسب fitness gym"],
  ["meditation", "مدیتیشن و آرامش", "Meditation", "wellness", "مدیتیشن آرامش ذهن meditation"],
  ["nutrition", "تغذیه و رژیم", "Nutrition", "wellness", "رژیم تغذیه لاغری nutrition diet"],
  ["physio", "فیزیوتراپی", "Physio", "wellness", "فیزیوتراپی درمان فیزیو physio"],
  ["counseling", "مشاوره و روان‌درمانی", "Counseling", "wellness", "مشاوره روانشناس روان counseling"],
  // general
  ["rejuvenation", "جوانسازی", "Rejuvenation", "general", "جوانسازی جوان rejuvenation anti aging"],
  ["mirror", "مشاوره چهره", "Mirror", "general", "آینه چهره mirror"],
  ["consult", "مشاوره", "Consultation", "general", "مشاوره رایگان consult"],
  ["gift", "پکیج و کارت هدیه", "Gift", "general", "هدیه پکیج کارت gift"],
  ["vip", "ویژه / VIP", "VIP", "general", "ویژه وی آی پی vip"],
  ["sparkles", "درخشش", "Sparkles", "general", "درخشش جذاب sparkle"],
  ["heart", "محبوب", "Favorite", "general", "قلب محبوب heart"],
  ["rose", "گل", "Rose", "general", "گل رز rose"],
  ["photoshoot", "عکاسی و فیلمبرداری", "Photoshoot", "general", "عکاسی آتلیه فیلم photo"],
  ["training", "آموزش و کلاس", "Training", "general", "آموزش کلاس دوره training course"],
  ["home_service", "خدمات در محل", "At your place", "general", "در محل منزل home visit"],
  ["discount", "تخفیف و پیشنهاد ویژه", "Discount", "general", "تخفیف پیشنهاد offer sale discount"],
  ["kids_care", "ویژه کودکان", "Kids", "general", "کودک بچه kids"],
  ["express", "سریع و فوری", "Express", "general", "سریع فوری اکسپرس express"]
];

const CATEGORY_IDS = new Set(EMOJI_CATEGORIES.map((category) => category.id));
const wrap = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${LUXE_DEFS}${inner}</svg>`;

const ALL_EMOJIS = META.map(([id, fa, en, category, tags]) => {
  const drawing = LUXE_ALIASES[id] || id;
  const inner = luxe[drawing];
  if (!inner) throw new Error(`beautyEmoji: missing art for "${id}"`);
  return {
    id,
    fa,
    en,
    category,
    hidden: Boolean(LUXE_ALIASES[id]) || !CATEGORY_IDS.has(category),
    tags: tags.split(/\s+/).filter(Boolean),
    svg: wrap(inner)
  };
});

/** Icons offered in the picker -- the main categories only. */
export const BEAUTY_EMOJIS = ALL_EMOJIS.filter((item) => !item.hidden);

const BY_ID = new Map(ALL_EMOJIS.map((item) => [item.id, item]));

export function getBeautyEmoji(id) {
  return BY_ID.get(String(id || "")) || null;
}

export function isBeautyEmojiId(id) {
  return BY_ID.has(String(id || ""));
}

/** Data-URI form of an icon, for <img src>. Returns "" for unknown ids. */
export function beautyEmojiSrc(id) {
  const item = getBeautyEmoji(id);
  return item ? `data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}` : "";
}

/**
 * Best-guess icon for a service that has no explicit emoji (older rows,
 * free-text names). Matches Persian keywords against the service name; the
 * first rule that matches wins, so specific phrases come before general ones.
 */
const KEYWORD_RULES = [
  ["hair_transplant", ["کاشت مو", "پیوند مو"]],
  ["hair_loss", ["ریزش مو"]],
  ["hair_botox", ["بوتاکس مو"]],
  ["bridal", ["عروس"]],
  ["groom", ["داماد"]],
  ["root_touch", ["رنگ ریشه", "ریشه"]],
  ["hair_color", ["رنگ مو", "دکلره", "رنگ و"]],
  ["highlights", ["لایت", "هایلایت", "بالیاژ", "آمبره"]],
  ["keratin", ["کراتین", "احیا", "پروتئین"]],
  ["hair_straight", ["صافی", "بروساژ", "اتو مو"]],
  ["hair_perm", ["فر دائمی", "پرم"]],
  ["hair_extension", ["اکستنشن مو", "کلیپ"]],
  ["braid", ["بافت", "میکروبراید"]],
  ["updo", ["شینیون"]],
  ["blowdry", ["براشینگ", "سشوار"]],
  ["hair_styling", ["فر ", "حالت"]],
  ["scalp_care", ["پوست سر", "شوره"]],
  ["hair_wash", ["شستشو", "ماسک مو"]],
  ["kids_haircut", ["کوتاهی کودک", "کوتاهی بچه"]],
  ["beard", ["ریش"]],
  ["razor", ["تیغ"]],
  ["barber", ["آرایشگاه مردانه", "اصلاح آقایان"]],
  ["men_cut", ["آقایان", "مردانه"]],
  ["haircut", ["کوتاه"]],
  ["lash_lift", ["لیفت مژه", "لمینت مژه"]],
  ["lash_tint", ["رنگ مژه"]],
  ["lash_ext", ["مژه"]],
  ["brow_lamination", ["لمینت ابرو"]],
  ["brow_tint", ["رنگ ابرو", "حنا ابرو"]],
  ["threading", ["نخ ابرو", "بند انداختن"]],
  ["eyebrow", ["ابرو"]],
  ["permanent_makeup", ["میکروبلیدینگ", "بلیدینگ", "میکروپیگمنتیشن", "تاتو لب", "microblading"]],
  ["tattoo_machine", ["دستگاه تاتو"]],
  ["tattoo", ["تاتو", "تتو", "خالکوبی"]],
  ["henna", ["حنا"]],
  ["piercing", ["پیرسینگ"]],
  ["eyeliner", ["خط چشم"]],
  ["eyeshadow", ["سایه"]],
  ["makeup_lesson", ["آموزش آرایش", "کلاس آرایش"]],
  ["party_makeup", ["مجلسی", "پارتی"]],
  ["makeup_brush", ["گریم", "کانتور"]],
  ["lips", ["فیلر لب", "لب"]],
  ["lipstick", ["میکاپ", "آرایش"]],
  ["nail_spa", ["پارافین"]],
  ["french_nails", ["فرنچ"]],
  ["nail_art", ["طراحی ناخن", "نیل آرت"]],
  ["gel_nails", ["کاشت ناخن", "کاشت", "پودر"]],
  ["nail_polish", ["ژلیش", "لاک"]],
  ["pedicure", ["پدیکور"]],
  ["manicure", ["مانیکور", "ناخن"]],
  ["microneedling", ["میکرونیدلینگ", "درمافن", "دورماپن"]],
  ["hydrafacial", ["هیدرافیشیال", "آبرسانی"]],
  ["peeling", ["لایه‌برداری پوست", "پیلینگ", "لایه"]],
  ["face_mask", ["ماسک صورت", "ماسک"]],
  ["acne", ["آکنه", "جوش"]],
  ["oxygen_facial", ["اکسیژن"]],
  ["led_therapy", ["نوردرمانی", "ال ای دی", "led"]],
  ["serum", ["سرم", "مزوتراپی"]],
  ["prp", ["پی آر پی", "پلاسما", "prp"]],
  ["facial", ["فیشیال", "پاکسازی"]],
  ["skincare", ["پوست"]],
  ["filler", ["فیلر"]],
  ["injection", ["بوتاکس", "تزریق"]],
  ["hifu", ["هایفو"]],
  ["thread_lift", ["لیفت نخ", "کوک"]],
  ["laser", ["لیزر"]],
  ["teeth", ["بلیچینگ", "لمینت", "دندان"]],
  ["doctor", ["ویزیت", "پزشک"]],
  ["waxing", ["وکس", "اپیلاسیون", "موبری"]],
  ["hijama", ["حجامت"]],
  ["stone_massage", ["سنگ داغ"]],
  ["foot_massage", ["رفلکسولوژی", "ماساژ پا"]],
  ["massage", ["ماساژ"]],
  ["aroma", ["آروما"]],
  ["sauna", ["سونا", "بخار"]],
  ["moroccan_bath", ["حمام", "کیسه"]],
  ["body_scrub", ["اسکراب"]],
  ["spa", ["اسپا", "جکوزی"]],
  ["tanning", ["برنزه", "سولاریوم"]],
  ["body_contour", ["لاغری", "فرم‌دهی بدن", "کویتیشن"]],
  ["perfume", ["عطر"]],
  ["yoga", ["یوگا"]],
  ["pilates", ["پیلاتس"]],
  ["fitness", ["بدنسازی", "تناسب اندام", "ورزش"]],
  ["meditation", ["مدیتیشن"]],
  ["nutrition", ["رژیم", "تغذیه"]],
  ["physio", ["فیزیوتراپی"]],
  ["counseling", ["روان", "مشاوره روانشناسی"]],
  ["photoshoot", ["عکاسی", "آتلیه", "فیلمبرداری"]],
  ["training", ["آموزش", "کلاس", "دوره"]],
  ["home_service", ["در محل", "منزل"]],
  ["discount", ["تخفیف"]],
  ["kids_care", ["کودک", "بچه"]],
  ["bouquet", ["دسته گل"]],
  ["ring", ["حلقه", "نامزدی"]],
  ["party", ["مراسم", "جشن"]],
  ["rejuvenation", ["جوان"]],
  ["consult", ["مشاوره"]],
  ["gift", ["هدیه", "پکیج"]],
  ["vip", ["vip", "ویژه"]],
  ["haircut", ["مو"]]
];

export function guessBeautyEmojiId(name) {
  const text = String(name || "").toLowerCase();
  if (!text) return "";
  for (const [id, words] of KEYWORD_RULES) {
    if (words.some((word) => text.includes(word))) return id;
  }
  return "";
}
