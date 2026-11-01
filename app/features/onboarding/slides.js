/**
 * The welcome (before sign-up) and the tutorial of each role (once, right after sign-up). Owner's design of
 * 2026-11-01: a real phone in a calm scene, the camera moving in on the spot being taught and a finger tapping it.
 * The pictures are real screens of brand-new accounts (scripts/screens/tutorial.mjs), never the demo people.
 *
 * x, y: the spot on the screen (% of its width and height). z: how close the camera comes. r: the lit circle
 * (% of the screen's width). `hand: false` lights the spot without a finger. `trio`: the three roles side by side.
 */
export const TUTORIAL_SLIDES = {
  welcome: {
    last: "بریم",
    slides: [
      { trio: true, t: "فرفرو، جای نوبت‌های زیبایی", p: "مشتری‌ها، سالن‌ها و آرتیست‌ها یه‌جا؛ نوبت گرفتن و نوبت دادن، بدون تماس." },
      { img: "guest-welcome", t: "اول بگو کی هستی", p: "برای خودت نوبت می‌گیری؟ «مشتری» رو بزن. اگه سالن داری «سالن»، و اگه آرتیستی «آرتیست». بعدش چند تا چیز ساده می‌پرسیم و حسابت ساخته می‌شه.", x: 50, y: 71, z: 1.5, r: 62, hand: false }
    ]
  },
  client: {
    last: "شروع کن",
    slides: [
      { img: "client-book-tab", t: "اول سالنت رو اضافه کن", p: "سالن یا آرتیستی که پیشش می‌ری رو به حسابت وصل کن تا هر بار با یه ضربه نوبت بگیری. توی سالن، «اسکن QR» رو بزن و دوربین رو روی کدش بگیر.", x: 50, y: 39.5, z: 2.3, r: 34 },
      { img: "client-find-tab", t: "یا با اسم و شماره پیداش کن", p: "پیشش نیستی؟ توی «پیدا کردن» اسم یا شمارهٔ سالن رو بزن. اگه توی فرفرو باشه، پیداش می‌کنی و با «وصل شو» اضافه‌ش می‌کنی.", x: 50, y: 62.2, z: 2.1, r: 44 },
      { img: "client-book-tab-connected", t: "نوبت بگیر", p: "سالنت که اضافه شد، کنار خدمتی که می‌خوای «رزرو» رو بزن.", x: 17, y: 39.2, z: 2.6, r: 12 },
      { img: "client-booker", t: "روز و ساعت رو انتخاب کن", p: "یه روز و یه ساعت خالی رو بزن و درخواستت رو بفرست.", x: 85, y: 29.7, z: 2.3, r: 12 },
      { img: "client-home-booked", t: "جواب سالن همین‌جا میاد", p: "درخواستت زیر «نوبت‌های پیش‌رو» میاد؛ سالن که جواب بده، همین‌جا می‌بینیش.", x: 75, y: 46, z: 2, r: 46 }
    ]
  },
  salon: {
    last: "شروع کن",
    slides: [
      { img: "salon-home", t: "صفحهٔ سالنت رو کامل کن", p: "«بریم» رو بزن تا قدم‌به‌قدم لوگو، اسم و جای سالنت روی نقشه رو بذاری. مشتری‌ها از روی همین‌ها پیدات می‌کنن.", x: 23, y: 47.7, z: 2.6, r: 13 },
      { img: "salon-services", t: "خدمت‌ها و قیمت‌ها", p: "توی «خدمات»، «اولین خدمت رو بذار» رو بزن و هر کاری که انجام می‌دی رو با مدت و قیمتش اضافه کن.", x: 50, y: 80.8, z: 2.3, r: 24 },
      { img: "salon-staff", t: "تیمت رو بساز", p: "آرتیست‌هات رو با «دعوت آرتیست» بیار توی تیم. اگه خودت هم کار می‌کنی، «خودم هم کار می‌کنم» رو روشن کن.", x: 50, y: 86.3, z: 2.3, r: 24 },
      { img: "salon-request-on-open", t: "به درخواست‌ها جواب بده", p: "درخواست تازه که بیاد، «تأیید» رو بزن؛ مشتری همون لحظه خبردار می‌شه.", x: 75, y: 87.2, z: 2.3, r: 25 },
      { img: "salon-customers", t: "مشتری‌هات رو بیار", p: "«دعوت مشتری» رو بزن و برای مشتری‌هایی که داری بفرست؛ هر کی وصل بشه یا نوبت بگیره، اینجا میاد.", x: 50, y: 37.3, z: 2.3, r: 26 }
    ]
  },
  artist: {
    last: "شروع کن",
    slides: [
      { img: "artist-home", t: "صفحه‌ت رو کامل کن", p: "«بریم» رو بزن و قدم‌به‌قدم صفحه‌ت رو کامل کن تا مشتری‌ها پیدات کنن.", x: 25.6, y: 47.7, z: 2.6, r: 13 },
      { img: "artist-services", t: "خدمت‌ها و قیمت‌ها", p: "توی «خدمات»، «اولین خدمت رو بذار» رو بزن و هر کاری که انجام می‌دی رو با مدت و قیمتش اضافه کن.", x: 49, y: 75.5, z: 2.3, r: 24 },
      { img: "artist-home", t: "نمونه‌کارهات رو بذار", p: "توی «نمونه‌کار» عکس کارهات رو بذار؛ مشتری قبل از نوبت گرفتن همین‌ها رو می‌بینه.", x: 38, y: 39, z: 2.7, r: 11 },
      { img: "artist-day", t: "به درخواست‌ها جواب بده", p: "درخواست تازه که بیاد، «تأیید» رو بزن؛ مشتری همون لحظه خبردار می‌شه.", x: 36, y: 88.8, z: 2.5, r: 15 },
      { img: "artist-collab", t: "کار توی سالن", p: "اگه توی یه سالن کار می‌کنی، «اسکن کن» رو بزن و کد سالن رو اسکن کن تا بری توی تیمش.", x: 73, y: 48.3, z: 2.4, r: 22 }
    ]
  }
};

/** The trio of the welcome's first slide, right to left. */
export const TRIO = [
  { img: "salon-home", label: "سالن", side: "r" },
  { img: "client-home", label: "مشتری", side: "mid" },
  { img: "artist-home", label: "آرتیست", side: "l" }
];

/** Bump when the pictures are retaken, so phones don't keep the old ones. */
const PICTURES_VERSION = "1";
export const tutorialPicture = (name) => `/tutorial/${name}.webp?v=${PICTURES_VERSION}`;

/** Every picture of a flow (the welcome also needs the trio's). */
export function picturesOf(flow) {
  const names = (TUTORIAL_SLIDES[flow]?.slides || []).map((slide) => slide.img).filter(Boolean);
  if (flow === "welcome") names.push(...TRIO.map((item) => item.img));
  return [...new Set(names)];
}

/** This device saw the welcome (tapped «بریم» or «رد شدن»). */
export const WELCOME_SEEN_KEY = "frfro-welcome-seen";
/** Opens the tutorial of the signed-in role from anywhere (Settings › «آموزش فرفرو»). */
export const OPEN_TUTORIAL_EVENT = "frfro:open-tutorial";
