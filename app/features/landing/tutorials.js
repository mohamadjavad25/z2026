/**
 * Scripts for the short tutorials on the about page («آموزش», LearnSection.jsx). Each tutorial is a
 * silent screen recording played in code: a list of scenes, each one a mock app screen
 * (TutorialScreen.jsx), the element the finger taps, and the caption under the video.
 *
 * Scene: { screen, els, sheet?: { title, els }, toast?, tap?, say, ms? }
 *  - screen: name of the screen; a new name slides the new screen in, the same name updates in place.
 *  - els: the screen's elements, top to bottom (see TutorialScreen.jsx for the types).
 *  - tap: id of the element the finger taps ("id" or "id.index" for one item of a list).
 *  - say: the caption (plain Persian, one short sentence).
 *  - ms: how long the scene stays (default SCENE_MS).
 *
 * Words on the mock screens are the app's own labels, so keep them in step when the app changes.
 * Names (سالن رز، نگار، سارا) are made up.
 */

export const SCENE_MS = 3000;

/** Service icons used on the mock screens. AppLanding turns these ids into image sources on the server. */
export const TUTORIAL_ICONS = ["gel_nails", "manicure", "pedicure", "nail_art", "nail_polish", "haircut", "lash_ext", "lipstick", "facial", "blowdry"];

const SALON = "سالن رز";
const ARTIST = "نگار";
const CLIENT = "سارا";

const navClient = (on) => ({ t: "nav", id: "nav", on });
const navBiz = (on) => ({ t: "nav", id: "nav", biz: true, on });

const roles = (on) => ({
  t: "roles",
  id: "roles",
  on,
  items: [
    { name: "مشتری", sub: "بهترین‌ها رو پیدا کن، نوبتت رو همین‌جا بگیر" },
    { name: "سالن", sub: "سالنت رو بساز؛ رزروها و تیمت رو یک‌جا مدیریت کن" },
    { name: "آرتیست", sub: "نمونه‌کارهات رو نشون بده، مشتری تازه جذب کن" }
  ]
});

const CITY = { t: "field", id: "city", placeholder: "شهر (اختیاری)" };

const roleScreen = (on) => [{ t: "title", text: "ورود به دنیای فرفرو", sub: "مشتری، سالن یا آرتیست" }, roles(on)];

/** The short signup form: the name field (its label differs per role), phone, password, terms. */
function signup({ title, nameLabel, name, phone, password, terms, typing, extra = [] }) {
  return [
    { t: "title", text: title, sub: title === "مشتری" ? "فقط چند ثانیه تا اولین رزرو." : "فقط چند ثانیه؛ بقیهٔ اطلاعات را بعداً کامل می‌کنی." },
    { t: "field", id: "name", placeholder: nameLabel, text: name, type: typing === "name" },
    ...extra,
    { t: "field", id: "phone", placeholder: "شماره تماس", text: phone, type: typing === "phone", ltr: true },
    { t: "field", id: "password", placeholder: "رمز عبور (حداقل ۸ کاراکتر)", text: password ? "••••••••" : "", type: typing === "password", ltr: true },
    { t: "check", id: "terms", text: "قوانین و حریم خصوصی را می‌پذیرم", on: terms },
    { t: "btn", id: "submit", text: "تکمیل ثبت‌نام" }
  ];
}

const salonPlace = (extra = {}) => ({ t: "place", id: "place", name: SALON, sub: "تهرانپارس · باز تا ۲۰:۰۰", letter: "ر", ...extra });

const salonServices = (withButtons = true) => [
  { t: "service", id: "svc0", icon: "gel_nails", name: "کاشت و ژلیش", meta: "۹۰ دقیقه · ۴۵۰٬۰۰۰ تومان", btn: withButtons ? "رزرو" : "" },
  { t: "service", id: "svc1", icon: "manicure", name: "مانیکور", meta: "۴۵ دقیقه · ۲۰۰٬۰۰۰ تومان", btn: withButtons ? "رزرو" : "" },
  { t: "service", id: "svc2", icon: "pedicure", name: "پدیکور", meta: "۶۰ دقیقه · ۲۸۰٬۰۰۰ تومان", btn: withButtons ? "رزرو" : "" }
];

const bookTabs = (on) => ({ t: "tabs", id: "tabs", items: ["سالن و آرتیست من", "پیدا کردن"], on });

const categories = {
  t: "grid",
  id: "cats",
  items: [
    { icon: "nail_polish", label: "ناخن" },
    { icon: "haircut", label: "مو" },
    { icon: "lash_ext", label: "ابرو و مژه" },
    { icon: "lipstick", label: "میکاپ" },
    { icon: "facial", label: "پوست" },
    { icon: "blowdry", label: "براشینگ" }
  ]
};

const DAYS = [
  { a: "شنبه", b: "۲۶ مهر" },
  { a: "یکشنبه", b: "۲۷ مهر" },
  { a: "دوشنبه", b: "۲۸ مهر" },
  { a: "سه‌شنبه", b: "۲۹ مهر" }
];
const TIMES = ["۱۰:۰۰", "۱۱:۳۰", "۱۴:۰۰", "۱۵:۳۰", "۱۷:۰۰", "۱۸:۳۰", "۱۹:۰۰", "۱۹:۴۵"];

const booker = ({ day = -1, time = -1, ready = false }) => [
  { t: "bar", text: "درخواست نوبت", back: true },
  { t: "service", id: "picked", icon: "gel_nails", name: "کاشت و ژلیش", meta: `${SALON} · ۹۰ دقیقه` },
  { t: "head", text: "روز" },
  { t: "chips", id: "days", items: DAYS, on: day },
  ...(day >= 0 ? [{ t: "head", text: "ساعت شروع" }, { t: "chips", id: "times", items: TIMES, on: time, grid: 4 }] : [{ t: "note", text: "روز را انتخاب کن تا ساعت‌های آزاد را ببینی." }]),
  ...(ready ? [{ t: "summary", text: "۱ خدمت · ۹۰ دقیقه · ۴۵۰٬۰۰۰ تومان" }, { t: "btn", id: "send", text: "ارسال درخواست · یکشنبه ۱۵:۳۰" }] : [])
];

const salonRail = (on) => ({ t: "rail", id: "rail", items: ["پست‌ها", "داشبورد", "پرسنل", "خدمات"], on });
const artistRail = (on) => ({ t: "rail", id: "rail", items: ["نمونه‌کار", "رزروها", "خدمات", "همکاری"], on });

const salonHero = (actions = false) => ({
  t: "hero",
  name: SALON,
  sub: "سالن · تهرانپارس",
  letter: "ر",
  actions: actions ? { id: "actions", items: ["اشتراک‌گذاری", "کد QR و اسکن", "اعلان‌ها"] } : null
});
const artistHero = (actions = false) => ({
  t: "hero",
  name: ARTIST,
  sub: "آرتیست ناخن · تهرانپارس",
  letter: "ن",
  actions: actions ? { id: "actions", items: ["اشتراک‌گذاری", "کد QR و اسکن", "اعلان‌ها"] } : null
});

const settingsList = (owner) => [
  { t: "bar", text: "تنظیمات" },
  {
    t: "rows",
    id: "settings",
    chevron: true,
    items: [
      owner === "salon"
        ? { a: "ویرایش برند سالن", b: "لوگو، نام سالن، شماره تماس و مسیر رزرو" }
        : { a: "ویرایش پروفایل", b: "عکس، نام هنری، تخصص، تماس و مسیر رزرو" },
      { a: "ساعت کاری", b: "تنظیم ساعت کاری" },
      { a: "ذخیره‌شده‌ها", b: "مدل‌ها و نمونه‌کارهای ذخیره‌شده" }
    ]
  },
  navBiz(0)
];

const PRESETS = ["۹ تا ۱۷", "۱۰ تا ۲۰", "۱۲ تا ۲۱"];
const week = (hours, fridayOpen = true) => ({
  t: "rows",
  id: "week",
  items: ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"].map((day, index) => {
    const open = hours && (index < 6 || fridayOpen);
    return { a: day, b: open ? hours : "تعطیل", toggle: Boolean(open) };
  })
});
const hoursScreen = (preset, hours, fridayOpen = true) => [
  { t: "bar", text: "ساعت کاری", back: true },
  { t: "head", text: "قالب ساعت کاری", sub: "قالب بزن، بعد هر روز را با یک لمس تنظیم کن" },
  { t: "chips", id: "presets", items: PRESETS, on: preset },
  week(hours, fridayOpen)
];

const scanScreen = (found) => [
  { t: "bar", text: "اسکن QR", back: true },
  { t: "scan", text: "کد QR سالن یا آرتیست را داخل کادر بگیر", found }
];

export const LEARN_ROLES = [
  {
    id: "client",
    label: "مشتری",
    intro: "پیدا کردن سالن، وصل شدن و گرفتن نوبت.",
    tutorials: [
      {
        id: "client-start",
        title: "ساختن حساب",
        text: "در کمتر از یک دقیقه عضو فرفرو شو.",
        scenes: [
          { screen: "role", els: roleScreen(-1), tap: "roles.0", say: "فرفرو را باز کن و «مشتری» را بزن." },
          { screen: "form", els: signup({ title: "مشتری", nameLabel: "نام یا نام نمایشی", name: CLIENT, extra: [CITY], typing: "name" }), tap: "name", say: "اسمت را بنویس.", ms: 3200 },
          { screen: "form", els: signup({ title: "مشتری", nameLabel: "نام یا نام نمایشی", name: CLIENT, extra: [CITY], phone: "۰۹۱۲۳۴۵۶۷۸۹", password: true, typing: "phone" }), tap: "phone", say: "شمارهٔ موبایلت را بزن و یک رمز بگذار.", ms: 3400 },
          { screen: "form", els: signup({ title: "مشتری", nameLabel: "نام یا نام نمایشی", name: CLIENT, extra: [CITY], phone: "۰۹۱۲۳۴۵۶۷۸۹", password: true }), tap: "terms", say: "قوانین را تیک بزن." },
          { screen: "form", els: signup({ title: "مشتری", nameLabel: "نام یا نام نمایشی", name: CLIENT, extra: [CITY], phone: "۰۹۱۲۳۴۵۶۷۸۹", password: true, terms: true }), tap: "submit", say: "«تکمیل ثبت‌نام» را بزن." },
          {
            screen: "mine",
            els: [bookTabs(0), { t: "empty", img: "/brand/mascot/search.webp", title: "سالن یا آرتیستت را وصل کن", text: "نوبت گرفتن از اینجا شروع می‌شود." }, { t: "btns", id: "add", items: [{ text: "از مخاطبین" }, { text: "اسکن QR", ghost: true }] }, navClient(2)],
            toast: "خوش آمدی!",
            say: "تمام! حالا سالن یا آرتیست خودت را اضافه کن.",
            ms: 3400
          }
        ]
      },
      {
        id: "client-connect",
        title: "وصل شدن به سالن خودت",
        text: "سالنی که همیشه می‌روی را با اسم، شماره یا کد QR پیدا کن.",
        scenes: [
          {
            screen: "mine",
            els: [bookTabs(0), { t: "empty", img: "/brand/mascot/search.webp", title: "سالن یا آرتیستت را وصل کن", text: "نوبت گرفتن از اینجا شروع می‌شود." }, { t: "btns", id: "add", items: [{ text: "از مخاطبین" }, { text: "اسکن QR", ghost: true }] }, navClient(2)],
            tap: "tabs.1",
            say: "در بخش «رزرو»، «پیدا کردن» را بزن."
          },
          {
            screen: "explore",
            els: [bookTabs(1), { t: "search", id: "search", placeholder: "شماره، اسم یا لینک صفحه" }, { t: "head", text: "چه کاری می‌خواهی؟" }, categories, navClient(2)],
            tap: "search",
            say: "اسم یا شمارهٔ سالن را جستجو کن."
          },
          {
            screen: "explore",
            els: [bookTabs(1), { t: "search", id: "search", placeholder: "شماره، اسم یا لینک صفحه", text: SALON, type: true }, { t: "head", text: "نتیجه جستجو" }, salonPlace({ btn: "وصل شو" }), navClient(2)],
            tap: "place",
            say: "پیدایش کردی؟ «وصل شو» را بزن.",
            ms: 3400
          },
          {
            screen: "mine",
            els: [bookTabs(0), salonPlace(), ...salonServices(), navClient(2)],
            toast: `به ${SALON} وصل شدی`,
            say: `از این به بعد ${SALON} در «سالن و آرتیست من» است.`,
            ms: 3200
          },
          {
            screen: "scan",
            els: scanScreen({ name: SALON, sub: "سالن · تهرانپارس", btn: "وصل شو" }),
            tap: "found",
            say: "اگر در خود سالنی، کد QR روی میز را با «اسکن QR» بگیر.",
            ms: 3600
          }
        ]
      },
      {
        id: "client-book",
        title: "گرفتن نوبت",
        text: "خدمت، روز و ساعت را انتخاب کن و درخواست بفرست.",
        scenes: [
          { screen: "mine", els: [bookTabs(0), salonPlace(), ...salonServices(), navClient(2)], tap: "svc0", say: "کنار خدمتی که می‌خواهی، «رزرو» را بزن." },
          { screen: "booker", els: booker({}), tap: "days.1", say: "روز را انتخاب کن." },
          { screen: "booker", els: booker({ day: 1 }), tap: "times.3", say: "از ساعت‌های آزاد یکی را بزن." },
          { screen: "booker", els: booker({ day: 1, time: 3, ready: true }), tap: "send", say: "«ارسال درخواست» را بزن." },
          {
            screen: "status",
            els: [bookTabs(0), { t: "status", tone: "wait", title: `درخواستت به ${SALON} رسید`, text: `منتظر تأیید ${SALON} باش.`, when: "یکشنبه ۲۷ مهر · ساعت ۱۵:۳۰" }, salonPlace(), navClient(2)],
            say: "درخواستت رفت؛ سالن آن را می‌بیند و تأیید می‌کند.",
            ms: 3200
          },
          {
            screen: "status",
            els: [bookTabs(0), { t: "status", tone: "ok", title: "نوبتت قطعی شد", text: `${SALON} نوبتت را تأیید کرد.`, when: "یکشنبه ۲۷ مهر · ساعت ۱۵:۳۰" }, salonPlace(), navClient(2)],
            toast: "رزرو تأیید شد",
            say: "وقتی تأیید شد، خبرش را می‌گیری. هزینه را در خود سالن می‌دهی.",
            ms: 3800
          }
        ]
      }
    ]
  },
  {
    id: "salon",
    label: "سالن",
    intro: "صفحهٔ سالن، منوی خدمات، نوبت‌ها، مشتری‌ها و تیم.",
    tutorials: [
      {
        id: "salon-start",
        title: "ساختن صفحهٔ سالن",
        text: "ثبت‌نام سالن و چیدن ساعت کاری.",
        scenes: [
          { screen: "role", els: roleScreen(-1), tap: "roles.1", say: "فرفرو را باز کن و «سالن» را بزن." },
          { screen: "form", els: signup({ title: "سالن", nameLabel: "نام سالن", name: SALON, typing: "name" }), tap: "name", say: "اسم سالن را بنویس.", ms: 3200 },
          { screen: "form", els: signup({ title: "سالن", nameLabel: "نام سالن", name: SALON, phone: "۰۹۱۲۱۲۳۴۵۶۷", password: true, terms: true }), tap: "submit", say: "شماره و رمز را بزن، قوانین را تیک بزن و «تکمیل ثبت‌نام».", ms: 3600 },
          { screen: "settings", els: settingsList("salon"), tap: "settings.1", say: "در «تنظیمات»، «ساعت کاری» را باز کن." },
          { screen: "hours", els: hoursScreen(-1, ""), tap: "presets.1", say: "یک قالب ساعت را بزن؛ همهٔ روزها با هم پر می‌شوند." },
          { screen: "hours", els: hoursScreen(1, "۱۰:۰۰ تا ۲۰:۰۰"), tap: "week.6", say: "روز تعطیل را با یک لمس ببند." },
          { screen: "hours", els: hoursScreen(1, "۱۰:۰۰ تا ۲۰:۰۰", false), toast: "ساعت کاری ذخیره شد", say: "مشتری‌ها فقط در همین ساعت‌ها می‌توانند نوبت بگیرند.", ms: 3400 }
        ]
      },
      {
        id: "salon-services",
        title: "چیدن منوی خدمات",
        text: "خدمت را از کاتالوگ بردار، قیمت و زمان را بزن.",
        scenes: [
          { screen: "profile", els: [salonHero(), salonRail(1), { t: "summary", text: "نوبت‌های امروز: ۳" }, navBiz(1)], tap: "rail.3", say: "در پروفایل سالن، «خدمات» را بزن." },
          { screen: "services", els: [salonHero(), salonRail(3), { t: "empty", img: "/brand/mascot/nails.webp", title: "هنوز خدمتی ثبت نشده", text: "خدمت‌ها را تعریف کن تا مشتری بتواند روز و ساعت را انتخاب کند." }, { t: "btn", id: "addFirst", text: "افزودن اولین خدمت" }, navBiz(1)], tap: "addFirst", say: "«افزودن اولین خدمت» را بزن." },
          {
            screen: "services",
            els: [salonHero(), salonRail(3), navBiz(1)],
            sheet: {
              title: "افزودن خدمت",
              els: [
                { t: "tabs", id: "mode", items: ["پیشنهاد از کاتالوگ", "ساخت خدمت"], on: 0 },
                { t: "search", id: "q", placeholder: "جستجوی خدمت… (مثلاً ژلیش)", text: "ژلیش", type: true },
                { t: "service", id: "cat0", icon: "gel_nails", name: "کاشت و ژلیش", meta: "ناخن", btn: "افزودن" },
                { t: "service", id: "cat1", icon: "nail_polish", name: "لاک و لاک‌ژل", meta: "ناخن", btn: "افزودن" }
              ]
            },
            tap: "cat0",
            say: "اسم خدمت را جستجو کن و از کاتالوگ انتخابش کن.",
            ms: 3400
          },
          {
            screen: "services",
            els: [salonHero(), salonRail(3), navBiz(1)],
            sheet: {
              title: "افزودن خدمت",
              els: [
                { t: "service", id: "picked", icon: "gel_nails", name: "کاشت و ژلیش", meta: "ناخن" },
                { t: "field", id: "price", label: "قیمت (تومان)", placeholder: "قیمت", text: "۴۵۰٬۰۰۰", type: true },
                { t: "head", text: "مدت" },
                { t: "chips", id: "mins", items: ["۳۰ دقیقه", "۴۵ دقیقه", "۶۰ دقیقه", "۹۰ دقیقه"], on: 3 },
                { t: "btn", id: "save", text: "افزودن به خدمات من" }
              ]
            },
            tap: "save",
            say: "قیمت و مدت را بزن و «افزودن به خدمات من».",
            ms: 3600
          },
          { screen: "services", els: [salonHero(), salonRail(3), ...salonServices(false), navBiz(1)], toast: "خدمت اضافه شد", say: "همین! مشتری‌ها حالا این خدمت را می‌بینند و رزرو می‌کنند.", ms: 3400 }
        ]
      },
      {
        id: "salon-requests",
        title: "جواب دادن به نوبت‌ها",
        text: "درخواست تازه را تأیید کن یا ساعت دیگری پیشنهاد بده.",
        scenes: [
          {
            screen: "dashboard",
            els: [salonHero(), salonRail(1), { t: "head", text: "امروز" }, { t: "request", id: "req", name: CLIENT, service: "کاشت و ژلیش", when: "یکشنبه · ۱۵:۳۰", badge: "تازه", tone: "new" }, { t: "request", id: "old", name: "مریم", service: "براشینگ", when: "امروز · ۱۸:۰۰", badge: "تایید شده", tone: "ok" }, navBiz(1)],
            tap: "req",
            say: "درخواست تازه در «داشبورد» می‌آید؛ رویش بزن."
          },
          {
            screen: "dashboard",
            els: [salonHero(), salonRail(1), navBiz(1)],
            sheet: {
              title: "درخواست رزرو تازه",
              els: [
                { t: "rows", id: "info", items: [{ a: "مشتری", b: CLIENT }, { a: "خدمت", b: "کاشت و ژلیش · ۹۰ دقیقه" }, { a: "زمان", b: "یکشنبه ۲۷ مهر · ۱۵:۳۰" }, { a: "آرتیست", b: `${ARTIST} (پیشنهاد سیستم)` }] },
                { t: "btns", id: "act", items: [{ text: "تایید نوبت" }, { text: "تغییر ساعت", ghost: true }] }
              ]
            },
            tap: "act.0",
            say: "وقت داری؟ «تایید نوبت». نه؟ «تغییر ساعت» و ساعت دیگری پیشنهاد بده.",
            ms: 3800
          },
          {
            screen: "dashboard",
            els: [salonHero(), salonRail(1), { t: "head", text: "امروز" }, { t: "request", id: "req", name: CLIENT, service: "کاشت و ژلیش", when: "یکشنبه · ۱۵:۳۰", badge: "تایید شده", tone: "ok" }, { t: "request", id: "old", name: "مریم", service: "براشینگ", when: "امروز · ۱۸:۰۰", badge: "تایید شده", tone: "ok" }, navBiz(1)],
            toast: `نوبت ${CLIENT} تأیید شد`,
            say: "مشتری همان لحظه باخبر می‌شود.",
            ms: 3200
          }
        ]
      },
      {
        id: "salon-qr",
        title: "آوردن مشتری‌ها با کد QR",
        text: "کد سالن را روی میز بگذار؛ مشتری با یک اسکن وصل می‌شود.",
        scenes: [
          { screen: "profile", els: [salonHero(true), salonRail(1), { t: "summary", text: "نوبت‌های امروز: ۳" }, navBiz(1)], tap: "actions.1", say: "در پروفایل، «کد QR و اسکن» را بزن." },
          { screen: "qr", els: [{ t: "bar", text: "کد من", back: true }, { t: "qr", name: SALON, text: "این کد را به مشتری‌هایت نشان بده یا چاپش کن و روی میز بگذار." }], say: "این کد را چاپ کن یا روی پیشخوان بگذار.", ms: 3400 },
          {
            screen: "customers",
            els: [{ t: "bar", text: "مشتریان" }, { t: "rows", id: "people", items: [{ a: "مریم", b: "همین الان وصل شد", badge: "تازه" }, { a: CLIENT, b: "۴ نوبت" }, { a: "الهام", b: "۲ نوبت" }] }, navBiz(2)],
            toast: "مریم وصل شد",
            say: "مشتری کد را اسکن می‌کند و به «مشتریان» تو اضافه می‌شود؛ از آن به بعد مستقیم از تو وقت می‌گیرد.",
            ms: 4200
          }
        ]
      },
      {
        id: "salon-team",
        title: "اضافه کردن آرتیست به تیم",
        text: "آرتیست‌ها را دعوت کن تا نوبت‌ها به اسم خودشان ثبت شود.",
        scenes: [
          { screen: "profile", els: [salonHero(), salonRail(1), { t: "summary", text: "نوبت‌های امروز: ۳" }, navBiz(1)], tap: "rail.2", say: "در پروفایل سالن، «پرسنل» را بزن." },
          { screen: "staff", els: [salonHero(), salonRail(2), { t: "empty", img: "/brand/mascot/thumbsup.webp", title: "هنوز آرتیستی در تیم نیست", text: "از بین آرتیست‌های نزدیک، همکار تیمت را پیدا کن." }, { t: "btn", id: "invite", text: "دعوت آرتیست" }, navBiz(1)], tap: "invite", say: "«دعوت آرتیست» را بزن." },
          {
            screen: "staff",
            els: [salonHero(), salonRail(2), navBiz(1)],
            sheet: {
              title: "آرتیست‌های نزدیک",
              els: [
                { t: "place", id: "a0", name: ARTIST, sub: "ناخن · ۱ کیلومتر", letter: "ن", btn: "دعوت" },
                { t: "place", id: "a1", name: "ترانه", sub: "مو و براشینگ · ۲ کیلومتر", letter: "ت", btn: "دعوت" },
                { t: "place", id: "a2", name: "شیدا", sub: "ابرو و مژه · ۳ کیلومتر", letter: "ش", btn: "دعوت" }
              ]
            },
            tap: "a0",
            say: "آرتیست را پیدا کن و «دعوت» را بزن."
          },
          { screen: "staff", els: [salonHero(), salonRail(2), { t: "head", text: "دعوت‌های در انتظار" }, { t: "rows", id: "pending", items: [{ a: ARTIST, b: "ناخن", badge: "در انتظار تایید" }] }, navBiz(1)], say: "دعوت رفت؛ آرتیست آن را در اپ خودش می‌بیند." },
          { screen: "staff", els: [salonHero(), salonRail(2), { t: "head", text: "اعضای تیم" }, { t: "rows", id: "team", items: [{ a: ARTIST, b: "ناخن", badge: "فعال" }] }, navBiz(1)], toast: `${ARTIST} به تیم پیوست`, say: "قبول که کرد، عضو تیم است و نوبت‌های سالن به اسم او هم ثبت می‌شود.", ms: 3600 }
        ]
      }
    ]
  },
  {
    id: "artist",
    label: "آرتیست",
    intro: "صفحهٔ نمونه‌کار، نوبت مستقیم و همکاری با سالن.",
    tutorials: [
      {
        id: "artist-start",
        title: "ساختن صفحهٔ آرتیست",
        text: "ثبت‌نام و انتخاب کارهایی که انجام می‌دهی.",
        scenes: [
          { screen: "role", els: roleScreen(-1), tap: "roles.2", say: "فرفرو را باز کن و «آرتیست» را بزن." },
          { screen: "form", els: signup({ title: "آرتیست", nameLabel: "نام هنری", name: ARTIST, typing: "name" }), tap: "name", say: "نام هنری‌ات را بنویس.", ms: 3200 },
          { screen: "form", els: signup({ title: "آرتیست", nameLabel: "نام هنری", name: ARTIST, phone: "۰۹۳۵۱۲۳۴۵۶۷", password: true, terms: true }), tap: "submit", say: "شماره و رمز را بزن، قوانین را تیک بزن و «تکمیل ثبت‌نام».", ms: 3600 },
          {
            screen: "profile",
            els: [artistHero(), artistRail(0), { t: "head", text: "تکمیل پروفایل", sub: "چند قدم تا صفحهٔ کامل" }, { t: "rows", id: "todo", chevron: true, items: [{ a: "عکس پروفایل" }, { a: "محدوده فعالیت" }, { a: "تخصص" }, { a: "اولین خدمت در منو" }] }, navBiz(1)],
            tap: "todo.2",
            say: "بعد از ثبت‌نام، «تکمیل پروفایل» را قدم‌به‌قدم پر کن؛ مثلاً «تخصص».",
            ms: 3400
          },
          {
            screen: "profile",
            els: [artistHero(), artistRail(0), navBiz(1)],
            sheet: {
              title: "تخصص",
              els: [{ t: "chips", id: "spec", items: ["ناخن", "مو", "ابرو و مژه", "میکاپ", "پوست", "براشینگ"], on: 0, grid: 3 }, { t: "btn", id: "go", text: "ذخیره" }]
            },
            tap: "go",
            say: "کارهایی که انجام می‌دهی را انتخاب کن تا مشتری درست پیدایت کند."
          },
          { screen: "profile", els: [artistHero(true), artistRail(0), { t: "gallery", id: "gallery", add: true, items: [] }, navBiz(1)], tap: "actions.0", say: "صفحه‌ات آماده است. لینکش را با «اشتراک‌گذاری» همه‌جا بگذار.", ms: 3600 }
        ]
      },
      {
        id: "artist-portfolio",
        title: "گذاشتن نمونه‌کار",
        text: "عکس کار را بگذار و به خدمتش وصل کن.",
        scenes: [
          { screen: "profile", els: [artistHero(), artistRail(0), { t: "gallery", id: "gallery", add: true, items: ["nail_art", "manicure"] }, navBiz(1)], tap: "gallery.add", say: "در «نمونه‌کار»، خانهٔ «+» را بزن." },
          { screen: "composer", els: [{ t: "bar", text: "نمونه‌کار", back: true }, { t: "photo", id: "photo" }, { t: "field", id: "title", label: "عنوان", placeholder: "عنوان نمونه‌کار" }], tap: "photo", say: "عکس کار را از گالری گوشی انتخاب کن." },
          {
            screen: "composer",
            els: [{ t: "bar", text: "نمونه‌کار", back: true }, { t: "photo", id: "photo", icon: "gel_nails" }, { t: "field", id: "title", label: "عنوان", placeholder: "عنوان نمونه‌کار", text: "ژلیش صورتی", type: true }, { t: "head", text: "این کار مربوط به کدام خدمت است؟" }, { t: "chips", id: "svc", items: ["کاشت و ژلیش", "مانیکور", "طراحی ناخن"], on: -1 }],
            tap: "svc.0",
            say: "یک عنوان کوتاه بنویس و خدمتش را انتخاب کن.",
            ms: 3400
          },
          {
            screen: "composer",
            els: [{ t: "bar", text: "نمونه‌کار", back: true }, { t: "photo", id: "photo", icon: "gel_nails" }, { t: "field", id: "title", label: "عنوان", placeholder: "عنوان نمونه‌کار", text: "ژلیش صورتی" }, { t: "head", text: "این کار مربوط به کدام خدمت است؟" }, { t: "chips", id: "svc", items: ["کاشت و ژلیش", "مانیکور", "طراحی ناخن"], on: 0 }, { t: "btn", id: "save", text: "ذخیره" }],
            tap: "save",
            say: "«ذخیره» را بزن."
          },
          { screen: "profile", els: [artistHero(), artistRail(0), { t: "gallery", id: "gallery", add: true, fresh: true, items: ["gel_nails", "nail_art", "manicure"] }, navBiz(1)], toast: "نمونه‌کار منتشر شد", say: "کار تازه در صفحه‌ات و در جستجوی مشتری‌ها دیده می‌شود.", ms: 3400 }
        ]
      },
      {
        id: "artist-bookings",
        title: "ساعت کاری و نوبت مستقیم",
        text: "ساعت کاری خودت را بچین و نوبت‌ها را تأیید کن.",
        scenes: [
          { screen: "settings", els: settingsList("artist"), tap: "settings.1", say: "در «تنظیمات»، «ساعت کاری» را باز کن." },
          { screen: "hours", els: hoursScreen(-1, ""), tap: "presets.0", say: "قالب ساعت را بزن و روزهای تعطیل را ببند." },
          { screen: "hours", els: hoursScreen(0, "۹:۰۰ تا ۱۷:۰۰", false), toast: "ساعت کاری ذخیره شد", say: "مشتری‌ها فقط ساعت‌های آزاد تو را می‌بینند." },
          {
            screen: "requests",
            els: [artistHero(), artistRail(1), { t: "head", text: "نوبت‌های تازه", sub: "نیاز به تایید شما" }, { t: "request", id: "req", name: CLIENT, service: "مانیکور", when: "دوشنبه · ۱۱:۳۰", badge: "تازه", tone: "new", btn: "تایید" }, navBiz(1)],
            tap: "req",
            say: "درخواست تازه در «رزروها» می‌آید؛ «تایید» را بزن."
          },
          {
            screen: "requests",
            els: [artistHero(), artistRail(1), { t: "head", text: "رزروها" }, { t: "request", id: "req", name: CLIENT, service: "مانیکور", when: "دوشنبه · ۱۱:۳۰", badge: "تایید شده", tone: "ok" }, navBiz(1)],
            toast: "نوبت تأیید شد",
            say: "نوبت قطعی شد و مشتری باخبر می‌شود.",
            ms: 3200
          }
        ]
      },
      {
        id: "artist-collab",
        title: "همکاری با سالن",
        text: "به تیم یک سالن بپیوند تا نوبت‌های سالن هم به تو برسد.",
        scenes: [
          { screen: "profile", els: [artistHero(), artistRail(0), { t: "gallery", id: "gallery", add: true, items: ["gel_nails", "nail_art", "manicure"] }, navBiz(1)], tap: "rail.3", say: "در پروفایل، «همکاری» را بزن." },
          {
            screen: "collab",
            els: [artistHero(), artistRail(3), { t: "head", text: "همکاری با سالن" }, { t: "rows", id: "ways", chevron: true, items: [{ a: "کد سالن را اسکن کن", b: "سالن کد «افزودن آرتیست» را نشانت می‌دهد" }, { a: "کدت را به سالن نشان بده", b: "سالن‌دار کد تو را اسکن می‌کند" }] }, navBiz(1)],
            tap: "ways.0",
            say: "«کد سالن را اسکن کن» را بزن."
          },
          { screen: "scan", els: scanScreen({ name: SALON, sub: "دعوت همکاری", btn: "پیوستن به تیم" }), tap: "found", say: "کد «افزودن آرتیست» سالن را اسکن کن.", ms: 3400 },
          {
            screen: "scan",
            els: scanScreen(null),
            sheet: {
              title: `قوانین ${SALON}`,
              els: [
                { t: "rows", id: "terms", items: [{ a: "روزهای حضور", b: "شنبه تا چهارشنبه" }, { a: "ساعت کاری", b: "۱۰:۰۰ تا ۱۸:۰۰" }, { a: "سهم آرتیست", b: "۴۰٪" }, { a: "ظرفیت روزانه", b: "۶ نفر در روز" }] },
                { t: "note", text: "با پیوستن، قوانین سالن را می‌پذیری." },
                { t: "btn", id: "join", text: "قبول قوانین و پیوستن" }
              ]
            },
            tap: "join",
            say: "قوانین همکاری را بخوان و «قبول قوانین و پیوستن» را بزن.",
            ms: 3600
          },
          {
            screen: "collab",
            els: [artistHero(), artistRail(3), { t: "head", text: "همکار سالن" }, salonPlace({ badge: "وصل شدی", sub: "شنبه تا چهارشنبه · ۴۰٪ سهم" }), navBiz(1)],
            toast: `به تیم ${SALON} پیوستی`,
            say: `حالا نوبت‌های ${SALON} هم به تو می‌رسد.`,
            ms: 3400
          }
        ]
      }
    ]
  }
];

/** Length of a tutorial in whole seconds. */
export function tutorialSeconds(tutorial) {
  return Math.round(tutorial.scenes.reduce((sum, scene) => sum + (scene.ms || SCENE_MS), 0) / 1000);
}
