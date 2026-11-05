import { toPersianDigits } from "../shared/lib/digits";

/** Footprint names (app/shared/lib/activity.js) in words. A name not listed here shows as it is. */
const SCREEN = {
  "tab:profile": "صفحهٔ خانه",
  "tab:salons": "نوبت تازه",
  "tab:customers": "مشتری‌هام",
  "tab:settings": "تنظیمات",
  "rail:overview": "نوبت‌ها",
  "rail:hours": "خدمات",
  "rail:services": "خدمات",
  "rail:portfolio": "نمونه‌کار",
  "rail:staff": "پرسنل",
  "rail:collabs": "همکاری",
  public_artist: "صفحهٔ یه آرتیست",
  public_salon: "صفحهٔ یه سالن",
  "page:pricing": "قیمت‌ها",
  "page:download": "دانلود",
  "page:privacy": "حریم خصوصی",
  "page:terms": "قوانین"
};

const ACTION = {
  register: "ثبت‌نام کرد",
  login: "وارد شد",
  logout: "خارج شد",
  add_service: "خدمت گذاشت",
  add_post: "نمونه‌کار گذاشت",
  save_hours: "ساعت کاری رو ذخیره کرد",
  edit_profile: "پروفایل رو ویرایش کرد",
  share_link: "لینکش رو فرستاد",
  book_tap: "«رزرو» رو زد",
  book_sent: "نوبت فرستاد",
  add_booking_manual: "نوبت دستی ثبت کرد",
  answer_booking: "به درخواست نوبت جواب داد",
  tutorial_done: "آموزش رو تا آخر دید",
  survey_done: "نظرسنجی رو جواب داد",
  survey_later: "نظرسنجی رو گذاشت برای بعد"
};

const DEVICE = { "android-app": "برنامهٔ اندروید", "ios-app": "برنامهٔ آیفون", "android-web": "مرورگر اندروید", "ios-web": "مرورگر آیفون", desktop: "کامپیوتر" };

export function activityLabel(kind, name) {
  if (kind === "action" && name.startsWith("tutorial_skip:")) return `آموزش رو توی اسلاید ${toPersianDigits(name.split(":")[1])} بست`;
  return (kind === "action" ? ACTION : SCREEN)[name] || name;
}

export const screenLabel = (name) => activityLabel("screen", name);
export const deviceLabel = (device) => DEVICE[device] || "نامشخص";
export const sourceLabel = (source) => {
  if (!source || source === "direct") return "مستقیم";
  if (/instagram/i.test(source)) return "اینستاگرام";
  if (/google/i.test(source)) return "گوگل";
  return source;
};

/** Seconds in words: «۱ ساعت و ۲۵ دقیقه», «کمتر از یه دقیقه». */
export function durationLabel(seconds) {
  const minutes = Math.round(Number(seconds || 0) / 60);
  if (minutes < 1) return "کمتر از یه دقیقه";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${toPersianDigits(rest)} دقیقه`;
  return rest ? `${toPersianDigits(hours)} ساعت و ${toPersianDigits(rest)} دقیقه` : `${toPersianDigits(hours)} ساعت`;
}
