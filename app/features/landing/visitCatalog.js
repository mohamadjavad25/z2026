/**
 * The content of frfro.ir/v, the catalog a field visitor shows a salon owner or an artist face to face (owner,
 * 2026-11-13). Two categories, each a short deck the visitor swipes through. Every line is something the app does
 * today (keep it so, like the /s page); pictures are the real screens of brand-new accounts in public/tutorial.
 *
 * A slide is { kind, eyebrow?, title, text?, ...kind's own fields }. Kinds: intro, screen, notify, calendar, team,
 * link, collab, price, faq, start (VisitScreen.jsx draws each one). «{days}» in a text is the free days from plans.js.
 */

/** Where the QR on the last slide leads: the salon/artist page, tagged «v» so visits from field visitors count apart. */
export const VISIT_SIGNUP_URL = "https://frfro.ir/s/v";
/** The tag the catalog's own opens are counted under (landing_visits, like /go and /s). */
export const VISIT_SOURCE = "visit";

const SHARED_FAQ = [
  { q: "مشتری‌هام باید اپ نصب کنن؟", a: "نه. با لینک صفحه‌ت، از مرورگر گوشی هم نوبت می‌گیرن." },
  { q: "نوبت‌های تلفنی چی می‌شه؟", a: "خودت توی همون تقویم می‌نویسی‌شون، تا ساعتش برای بقیه پر بشه." }
];

export const VISIT_CATEGORIES = [
  {
    id: "salon",
    label: "سالن",
    pick: "سالن دارم",
    hint: "نوبت، تیم و مشتری",
    icons: ["haircut", "highlights", "manicure"],
    slides: [
      { kind: "intro", eyebrow: "فرفرو برای سالن", title: "نوبت‌های سالن، بی‌دردسر", text: "مشتری خودش نوبت می‌گیره. تو به کارت می‌رسی." },
      { kind: "screen", side: "client", eyebrow: "مشتری می‌بینه", title: "مشتری خودش نوبت می‌گیره", text: "فقط ساعت‌های خالیت رو می‌بینه. چند خدمت رو هم با هم می‌گیره.", image: "client-booker" },
      { kind: "screen", side: "pro", eyebrow: "تو می‌بینی", title: "با یه لمس تأیید می‌کنی", text: "درخواست به گوشیت می‌رسه و نوبت می‌ره توی تقویمت.", image: "salon-request-on-open" },
      { kind: "notify", eyebrow: "خودکار", title: "یادآوری و پیگیری با فرفرو", text: "قبل از نوبت یادآوری می‌کنه. وقت رنگ که برسه، دوباره خبرش می‌کنه.", notes: [{ when: "یه روز قبل", line: "فردا نوبت داری" }, { when: "وقت رنگ بعدی", line: "وقتشه دوباره نوبت بگیری" }] },
      { kind: "calendar", eyebrow: "دفتر نوبت", title: "همهٔ نوبت‌ها توی یه تقویم", text: "نوبت‌های تلفنی رو هم همون‌جا می‌نویسی." },
      { kind: "team", eyebrow: "تیم سالن", title: "هر آرتیست، نوبت‌های خودش", text: "آرتیست‌هات به تیم وصل می‌شن و هر کدوم برنامهٔ خودش رو می‌بینه." },
      { kind: "screen", side: "client", eyebrow: "مشتری تازه", title: "مشتری تازه پیدات می‌کنه", text: "نمونه‌کار می‌ذاری و مشتری با خدمتی که می‌خواد پیدات می‌کنه.", image: "client-find-tab" },
      { kind: "price", eyebrow: "قیمت", title: "{days} روز اول رایگانه" },
      { kind: "faq", eyebrow: "معمولاً می‌پرسن", title: "سؤال‌های رایج", items: [...SHARED_FAQ, { q: "چند تا آرتیست دارم، قاطی نمی‌شه؟", a: "هر کار به آرتیست خودش می‌رسه و هر کدوم فقط نوبت‌های خودش رو می‌بینه." }, { q: "بعد از {days} روز چی؟", a: "اگه خوشت اومد یکی از اشتراک‌ها رو می‌گیری. مشتری‌ها همیشه رایگانن." }] },
      { kind: "start", eyebrow: "شروع", title: "همین الان شروع کن" }
    ]
  },
  {
    id: "artist",
    label: "آرتیست",
    pick: "آرتیستم",
    hint: "صفحه و نوبت",
    icons: ["lipstick", "eyebrow", "bridal"],
    slides: [
      { kind: "intro", eyebrow: "فرفرو برای آرتیست", title: "کار خودت، صفحهٔ خودت", text: "نمونه‌کار، خدمات و نوبت، همه با یه لینک." },
      { kind: "link", eyebrow: "صفحهٔ خودت", title: "یه صفحه، یه لینک", text: "نمونه‌کارها و خدماتت توی یه صفحه. لینکش رو برای مشتری‌هات بفرست." },
      { kind: "screen", side: "client", eyebrow: "مشتری می‌بینه", title: "نوبت بدون پیام‌بازی", text: "ساعت کاریت رو می‌چینی و مشتری خودش نوبت می‌گیره.", image: "client-booker" },
      { kind: "screen", side: "pro", eyebrow: "تو می‌بینی", title: "برنامهٔ روزت جلوی چشمت", text: "درخواست‌ها رو با یه لمس تأیید می‌کنی.", image: "artist-day" },
      { kind: "notify", eyebrow: "خودکار", title: "یادآوری و پیگیری با فرفرو", text: "قبل از نوبت یادآوری می‌کنه. وقت ترمیم که برسه، دوباره خبرش می‌کنه.", notes: [{ when: "یه روز قبل", line: "فردا نوبت داری" }, { when: "وقت ترمیم", line: "وقتشه دوباره نوبت بگیری" }] },
      { kind: "collab", eyebrow: "همکاری با سالن", title: "با سالن هم کار می‌کنی", text: "به تیم یه سالن وصل می‌شی و نوبت‌های اون‌جا هم به تو می‌رسه." },
      { kind: "price", eyebrow: "قیمت", title: "{days} روز اول رایگانه" },
      { kind: "faq", eyebrow: "معمولاً می‌پرسن", title: "سؤال‌های رایج", items: [...SHARED_FAQ, { q: "توی سالن هم کار می‌کنم، چی می‌شه؟", a: "به تیم سالن وصل می‌شی و نوبت‌های اون‌جا هم توی برنامه‌ت میاد." }, { q: "بعد از {days} روز چی؟", a: "اگه خوشت اومد یکی از اشتراک‌ها رو می‌گیری. مشتری‌ها همیشه رایگانن." }] },
      { kind: "start", eyebrow: "شروع", title: "همین الان شروع کن" }
    ]
  }
];

export const START_STEPS = ["صفحه‌ت رو بساز", "خدمات و ساعت کاری رو بچین", "مشتری‌هات رو دعوت کن"];
