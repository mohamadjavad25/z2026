// Ready-made service catalog offered when a salon / artist adds a service.
// Every entry is only a starting point: the owner can change the name, price,
// duration, description and icon before saving (see ServiceComposerModal).
// Prices are indicative defaults ("از ..."), in toman: "هزار" = thousand,
// "م" = million. Categories match EMOJI_CATEGORIES in beautyEmoji.js.

import { EMOJI_CATEGORIES, guessBeautyEmojiId, getBeautyEmoji } from "./beautyEmoji.js";

// [icon id, name, category, price, duration, short description]
const ROWS = [
  // ── مو ──
  ["haircut", "کوتاهی مو", "hair", "از ۶۵۰ هزار", "۴۵ دقیقه", "کوتاهی، فرم‌دهی و براشینگ سبک"],
  ["hair_color", "رنگ مو", "hair", "از ۳.۸ م", "۱۸۰ دقیقه", "رنگ کامل، مشاوره تناژ و مراقبت بعد از رنگ"],
  ["hair_color", "رنگ ریشه", "hair", "از ۱.۸ م", "۹۰ دقیقه", "پوشش ریشه‌ی رشد‌کرده هم‌رنگ با مو"],
  ["highlights", "لایت و هایلایت", "hair", "از ۵ م", "۲۴۰ دقیقه", "لایت، دکلره و هایلایت با فویل"],
  ["highlights", "بالیاژ و آمبره", "hair", "از ۶ م", "۲۷۰ دقیقه", "رنگ‌بندی طبیعی و محو با تکنیک بالیاژ"],
  ["keratin", "کراتین مو", "hair", "از ۴.۵ م", "۱۵۰ دقیقه", "احیای ساقه، صافی نسبی و درخشش مو"],
  ["keratin", "بوتاکس مو", "hair", "از ۳ م", "۱۲۰ دقیقه", "پرکردن و ترمیم موی آسیب‌دیده، نرم و براق"],
  ["hair_straight", "صافی و بروساژ", "hair", "از ۴ م", "۱۸۰ دقیقه", "صاف‌کردن ماندگار مو با حفظ سلامت"],
  ["blowdry", "براشینگ و سشوار", "hair", "از ۴۵۰ هزار", "۴۵ دقیقه", "سشوار حجم‌دار یا صاف با برس"],
  ["blowdry", "حالت‌دهی و فر", "hair", "از ۶۰۰ هزار", "۶۰ دقیقه", "فر، ویو و حالت‌دهی مناسب مهمانی"],
  ["updo", "شینیون مجلسی", "hair", "از ۲ م", "۹۰ دقیقه", "شینیون و مدل‌های جمع و نیمه‌جمع"],
  ["braid", "بافت مو", "hair", "از ۸۰۰ هزار", "۶۰ دقیقه", "بافت‌های ساده، فرانسوی و میکروبراید"],
  ["highlights", "اکستنشن مو", "hair", "از ۶ م", "۱۸۰ دقیقه", "اکستنشن طبیعی، کلیپی یا کاشتی"],

  // ── آرایش ──
  ["lipstick", "میکاپ ساده", "makeup", "از ۱.۵ م", "۶۰ دقیقه", "آرایش روزمره و طبیعی"],
  ["party_makeup", "میکاپ مجلسی", "makeup", "از ۲.۵ م", "۹۰ دقیقه", "آرایش کامل مهمانی با ماندگاری بالا"],
  ["makeup_brush", "گریم و کانتور", "makeup", "از ۲ م", "۷۵ دقیقه", "کانتور، هایلایت و فرم‌دهی صورت"],
  ["eyeshadow", "آرایش چشم", "makeup", "از ۸۰۰ هزار", "۳۰ دقیقه", "سایه، خط چشم و ریمل"],
  ["eyeliner", "خط چشم", "makeup", "از ۴۰۰ هزار", "۲۰ دقیقه", "خط چشم دقیق و ماندگار"],
  ["lips", "آرایش لب", "makeup", "از ۴۰۰ هزار", "۱۵ دقیقه", "رژ و خط لب متناسب با رنگ پوست"],
  ["makeup_brush", "آموزش خودآرایی", "makeup", "از ۲.۴ م", "۱۲۰ دقیقه", "کلاس خصوصی خودآرایی"],

  // ── عروس ──
  ["bridal", "میکاپ عروس", "bridal", "از ۹ م", "۱۸۰ دقیقه", "میکاپ کامل عروس با مشاوره و فیکس نهایی"],
  ["updo", "شینیون عروس", "bridal", "از ۵ م", "۱۲۰ دقیقه", "شینیون و نصب تور و تاج"],
  ["crown", "پکیج کامل عروس", "bridal", "از ۲۰ م", "۳۶۰ دقیقه", "میکاپ، شینیون، ناخن و پوست عروس"],
  ["ring", "پکیج نامزدی و عقد", "bridal", "از ۶ م", "۱۸۰ دقیقه", "آرایش و مو برای مراسم عقد و نامزدی"],
  ["bouquet", "آرایش همراهان عروس", "bridal", "از ۳ م", "۹۰ دقیقه", "میکاپ و شینیون خانواده و ساقدوش"],

  // ── ابرو و مژه ──
  ["eyebrow", "اصلاح ابرو", "brow_lash", "از ۳۵۰ هزار", "۲۰ دقیقه", "طراحی و اصلاح فرم ابرو"],
  ["threading", "اصلاح با نخ", "brow_lash", "از ۲۵۰ هزار", "۲۰ دقیقه", "اصلاح تمیز و دقیق با نخ"],
  ["brow_lamination", "لمینت و لیفت ابرو", "brow_lash", "از ۱.۲ م", "۴۵ دقیقه", "حالت‌دهی ابرو، پرپشت و مرتب"],
  ["eyebrow", "رنگ ابرو", "brow_lash", "از ۳۵۰ هزار", "۲۰ دقیقه", "رنگ ابرو با حنا یا رنگ مخصوص"],
  ["permanent_makeup", "میکروبلیدینگ ابرو", "brow_lash", "از ۷ م", "۱۲۰ دقیقه", "ابروی تار به تار ماندگار"],
  ["lash_ext", "اکستنشن مژه", "brow_lash", "از ۲.۲ م", "۹۰ دقیقه", "کاشت مژه کلاسیک، حجمی و مگا"],
  ["lash_ext", "ریفیل مژه", "brow_lash", "از ۱.۱ م", "۶۰ دقیقه", "ترمیم و پرکردن مژه‌های کاشته‌شده"],
  ["lash_lift", "لیفت و لمینت مژه", "brow_lash", "از ۱.۴ م", "۶۰ دقیقه", "فر و حالت طبیعی برای مژه‌ی خودتان"],

  // ── ناخن ──
  ["manicure", "مانیکور", "nails", "از ۳۵۰ هزار", "۴۵ دقیقه", "مرتب‌کردن و مراقبت از ناخن و کوتیکول"],
  ["pedicure", "پدیکور", "nails", "از ۵۰۰ هزار", "۶۰ دقیقه", "پاکسازی، مراقبت و لاک پا"],
  ["manicure", "پکیج مانیکور و پدیکور", "nails", "از ۷۵۰ هزار", "۱۰۵ دقیقه", "مراقبت کامل دست و پا"],
  ["nail_polish", "ژلیش ناخن", "nails", "از ۷۵۰ هزار", "۶۰ دقیقه", "لاک ژل ماندگار با رنگ دلخواه"],
  ["gel_nails", "کاشت ناخن", "nails", "از ۱.۶ م", "۱۲۰ دقیقه", "کاشت با ژل یا پودر و فرم‌دهی"],
  ["gel_nails", "ترمیم ناخن", "nails", "از ۸۰۰ هزار", "۶۰ دقیقه", "ترمیم ناخن کاشته‌شده و پرکردن رشد"],
  ["nail_art", "طراحی ناخن", "nails", "از ۴۰۰ هزار", "۳۰ دقیقه", "نقاشی، نگین و طرح‌های خاص"],
  ["french_nails", "ناخن فرنچ", "nails", "از ۹۰۰ هزار", "۶۰ دقیقه", "فرنچ کلاسیک یا رنگی"],

  // ── پوست ──
  ["facial", "پاکسازی پوست", "skin", "از ۱.۲ م", "۷۵ دقیقه", "پاکسازی، آبرسانی و ماسک متناسب پوست"],
  ["hydrafacial", "هیدرافیشیال", "skin", "از ۲.۵ م", "۶۰ دقیقه", "پاکسازی عمیق و آبرسانی با دستگاه"],
  ["microneedling", "میکرونیدلینگ", "skin", "از ۲.۸ م", "۶۰ دقیقه", "بازسازی پوست، جای جوش و منافذ"],
  ["peeling", "پیلینگ و لایه‌برداری", "skin", "از ۱.۸ م", "۴۵ دقیقه", "روشن‌کردن و یکدست‌کردن پوست"],
  ["facial", "درمان آکنه و جوش", "skin", "از ۱.۶ م", "۶۰ دقیقه", "کنترل جوش و پیشگیری از جای آن"],
  ["face_mask", "ماسک صورت", "skin", "از ۷۰۰ هزار", "۳۰ دقیقه", "ماسک تخصصی آبرسان یا روشن‌کننده"],
  ["serum", "مزوتراپی صورت", "skin", "از ۳ م", "۴۵ دقیقه", "تزریق ویتامین و آبرسان به لایه‌های پوست"],
  ["skincare", "مشاوره مراقبت پوست", "skin", "از ۶۰۰ هزار", "۳۰ دقیقه", "تشخیص نوع پوست و برنامه‌ی روزانه"],

  // ── کلینیک ──
  ["injection", "تزریق بوتاکس", "clinic", "از ۶ م", "۳۰ دقیقه", "رفع چین و چروک با تزریق"],
  ["filler", "تزریق فیلر", "clinic", "از ۸ م", "۴۵ دقیقه", "حجم‌دهی لب، گونه و خط خنده"],
  ["prp", "PRP و پلاسما", "clinic", "از ۵ م", "۶۰ دقیقه", "جوانسازی با پلاسمای غنی از پلاکت"],
  ["hifu", "هایفو و لیفت صورت", "clinic", "از ۹ م", "۹۰ دقیقه", "سفت‌کردن پوست بدون جراحی"],
  ["laser", "لیزر موهای زائد", "clinic", "از ۱.۵ م", "۴۵ دقیقه", "جلسه‌ی لیزر برای ناحیه‌ی دلخواه"],
  ["laser", "لیزر پوست", "clinic", "از ۴ م", "۶۰ دقیقه", "رفع لک، جای جوش و یکدستی پوست"],

  // ── بدن و اسپا ──
  ["waxing", "وکس و اپیلاسیون", "body", "از ۹۰۰ هزار", "۴۵ دقیقه", "حذف موی ناحیه‌ی دلخواه"],
  ["waxing", "وکس کامل بدن", "body", "از ۲.۵ م", "۹۰ دقیقه", "پکیج کامل بدن"],
  ["massage", "ماساژ آرامش‌بخش", "body", "از ۱.۸ م", "۶۰ دقیقه", "ماساژ سوئدی کل بدن"],
  ["stone_massage", "ماساژ سنگ داغ", "body", "از ۲.۴ م", "۷۵ دقیقه", "رفع خستگی عمیق با سنگ‌های گرم"],
  ["spa", "پکیج اسپا", "body", "از ۴ م", "۱۸۰ دقیقه", "ترکیب ماساژ، لایه‌برداری و مراقبت پوست"],
  ["body_contour", "لاغری و فرم‌دهی بدن", "body", "از ۲.۸ م", "۶۰ دقیقه", "کویتیشن و فرم‌دهی موضعی"],
  ["tanning", "برنزه", "body", "از ۱.۵ م", "۳۰ دقیقه", "برنزه‌ی طبیعی و یکدست"]
];

const CATEGORY_FA = Object.fromEntries(EMOJI_CATEGORIES.map((category) => [category.id, category.fa]));

export const SERVICE_CATALOG = ROWS.map(([emoji, name, category, price, duration, hint], index) => {
  if (!getBeautyEmoji(emoji)) throw new Error(`serviceCatalog: unknown icon "${emoji}" for "${name}"`);
  if (!CATEGORY_FA[category]) throw new Error(`serviceCatalog: unknown category "${category}" for "${name}"`);
  return {
    id: `catalog-${index + 1}`,
    emoji,
    name,
    category,
    price,
    duration,
    hint,
    badge: CATEGORY_FA[category],
    tone: category === "bridal" ? "vip" : "soft"
  };
});

/**
 * Category ids relevant to a profile's comma-joined specialty text (the
 * `service` field filled in at signup, e.g. "ناخن، میکاپ"), so the picker
 * can surface the owner's own field first. Unknown specialties are ignored.
 */
export function categoriesForSpecialties(text) {
  const result = [];
  for (const part of String(text || "").split(/[,،\n]/)) {
    const icon = guessBeautyEmojiId(part.trim());
    const category = getBeautyEmoji(icon)?.category;
    if (category && CATEGORY_FA[category] && !result.includes(category)) result.push(category);
  }
  return result;
}
