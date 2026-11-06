import { toPersianDigits as fa } from "./digits";

/**
 * The welcome survey's words, made from one person's own name and numbers. Used by the screens and by the push, so
 * both always say the same thing. `facts` is { posts, services, bookings }.
 */
export const FEELS = ["خیلی سخت", "سخت", "معمولی", "راحت", "خیلی راحت"];

/** The answer that means nothing was hard; it cannot be picked together with the others. */
export const NO_TROUBLE = "none";

export const SURVEY_PARTS = {
  artist: [["photos", "گذاشتن عکس"], ["captions", "نوشتن توضیح"], ["services", "خدمت‌ها و قیمت‌ها"], ["hours", "ساعت کاری"], ["map", "جام روی نقشه"], ["finding", "پیدا کردن قسمت‌ها"]],
  salon: [["photos", "گذاشتن عکس"], ["services", "خدمت‌ها و قیمت‌ها"], ["team", "آرتیست‌ها و تیم"], ["hours", "ساعت کاری"], ["map", "جام روی نقشه"], ["finding", "پیدا کردن قسمت‌ها"]],
  client: [["search", "پیدا کردن سالن یا آرتیست"], ["time", "انتخاب ساعت"], ["booking", "گرفتن نوبت"], ["answer", "جواب گرفتن از سالن"], ["finding", "پیدا کردن قسمت‌ها"]]
};

export function partsOf(role) {
  return [...(SURVEY_PARTS[role] || SURVEY_PARTS.client), [NO_TROUBLE, "هیچ‌جا، راحت بود"]];
}

/** Every part id that can be saved, for checking what a phone sends. */
export const ALL_PART_IDS = [...new Set(["artist", "salon", "client"].flatMap((role) => partsOf(role).map(([id]) => id)))];

/** «از ۲ تومن»: a number with no هزار or میلیون, too short to be the whole amount. A client reads it as it is written. */
export function unclearPrice(price) {
  const text = String(price || "").trim();
  if (!/[\d۰-۹]/.test(text) || /هزار|میلیون|ملیون/.test(text)) return false;
  return text.replace(/[^\d۰-۹]/g, "").length < 4;
}

/** «ارزو جان» for a person; a salon's name takes «عزیز»; a client is called by the first name only. */
export function calledBy({ name, role }) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  if (role === "salon") return `${clean} عزیز`;
  return `${role === "client" ? clean.split(/\s+/)[0] : clean} جان`;
}

export function greeting(person) {
  const called = calledBy(person);
  return called ? `${called}، خوش اومدی!` : "خوش اومدی!";
}

/** What they have done so far, in one sentence. */
export function praise({ role, facts }) {
  if (role === "client") {
    return facts.bookings > 1 ? `تا حالا ${fa(facts.bookings)} تا نوبت با فرفرو گرفتی.` : "اولین نوبتت رو با فرفرو گرفتی.";
  }
  const done = [facts.posts ? `${fa(facts.posts)} تا نمونه‌کار` : "", facts.services ? `${fa(facts.services)} تا خدمت` : ""].filter(Boolean).join(" و ");
  return `${done} گذاشتی. این‌جوری مشتری قبل از اومدن، کارت رو می‌شناسه.`;
}

/** The one come-back push (owner 2026-11-06): no name, no promise, so it reads the same for a salon, an artist and a client. */
export function pushText(person) {
  const role = person?.role;
  if (role === "client") return { title: "نوبت گرفتن چطور بود؟", body: "بگو راحت بود یا جایی گیر کردی. فقط چند ثانیه." };
  if (role === "salon") return { title: "ساختن صفحهٔ سالنت چطور بود؟", body: "بگو کدوم بخش رو چطور دیدی. فقط چند ثانیه." };
  return { title: "کار با فرفرو چطور بود؟", body: "بگو کدوم بخش رو چطور دیدی. فقط چند ثانیه." };
}

/**
 * What a salon's or artist's page has and still needs. `go` says where a tap leads: "edit" is the profile editor,
 * "page" their own page. A client has no list.
 */
export function surveySteps({ role, facts, has }) {
  if (role === "client") return [];
  const isSalon = role === "salon";
  const steps = [
    { id: "posts", label: facts.posts ? `${fa(facts.posts)} نمونه‌کار` : "نمونه‌کار", hint: "مشتری اول کارت رو می‌بینه", done: facts.posts > 0, go: "page" },
    { id: "services", label: facts.services ? `${fa(facts.services)} خدمت` : "خدمت‌ها", hint: "بدون خدمت، کسی نمی‌تونه نوبت بگیره", done: facts.services > 0, go: "page" },
    { id: "area", label: "جات روی نقشه", hint: "مشتری باید بدونه کجا بیاد", done: has.area, go: "edit" },
    { id: "avatar", label: isSalon ? "لوگوی سالن" : "عکس پروفایل", hint: "اولین چیزیه که مشتری از تو می‌بینه", done: has.avatar, go: "edit" },
    { id: "poster", label: "بنر صفحه", hint: "بهترین کارت رو بالای صفحه بذار", done: has.poster, go: "edit" },
    { id: "specialty", label: isSalon ? "خدمات اصلی" : "تخصص", hint: "بگو کارت چیه", done: has.specialty, go: "edit" }
  ];
  if (!isSalon) steps.push({ id: "experience", label: "سابقه کار", hint: "بگو چند ساله این کار رو می‌کنی", done: has.experience, go: "edit" });
  if (facts.services > 0) steps.push({ id: "prices", label: "نوشتن قیمت‌ها", hint: "کنار عدد بنویس هزار یا میلیون تومن", done: !has.unclearPrices, go: "page" });
  return steps;
}
