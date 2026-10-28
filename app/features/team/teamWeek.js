import { formatPersianDateKey, formatPersianDayTitle, formatRelativeBookingDayLabel, getPersianWeekday, persianDateKeyToDate } from "../../shared/lib/persianCalendar";
import { toPersianDigits } from "../../shared/lib/digits";

/** The week as the app runs it (Saturday first), with the one-letter label the week strips show. */
export const WEEK_DAYS = [
  { day: "شنبه", letter: "ش" },
  { day: "یکشنبه", letter: "ی" },
  { day: "دوشنبه", letter: "د" },
  { day: "سه‌شنبه", letter: "س" },
  { day: "چهارشنبه", letter: "چ" },
  { day: "پنجشنبه", letter: "پ" },
  { day: "جمعه", letter: "ج" }
];

/** Weekday names come with or without the half-space («سه‌شنبه», «سه شنبه»); compare without it. */
const plain = (value) => String(value || "").replace(/[‌\s]/g, "");

export function todayDayName(from = new Date()) {
  return plain(getPersianWeekday(from));
}

/** Hours rows ({ day, open, close, active }) → one entry per weekday: { day, letter, on, open, close, today }. */
export function weekFromHours(hours = [], from = new Date()) {
  const today = todayDayName(from);
  return WEEK_DAYS.map(({ day, letter }) => {
    const row = hours.find((item) => plain(item.day) === plain(day));
    const on = Boolean(row?.active) && Boolean(row?.open) && Boolean(row?.close);
    return { day, letter, on, open: on ? row.open : "", close: on ? row.close : "", today: plain(day) === today };
  });
}

/** «شنبه تا چهارشنبه» or «شنبه، دوشنبه و پنجشنبه»; "" when no day is on. */
export function daysSummary(week) {
  const on = week.filter((item) => item.on);
  if (!on.length) return "";
  const first = WEEK_DAYS.findIndex((item) => item.day === on[0].day);
  const contiguous = on.every((item, index) => WEEK_DAYS[first + index]?.day === item.day);
  if (on.length === 7) return "همه روزهای هفته";
  if (on.length === 1) return on[0].day;
  if (contiguous && on.length > 2) return `${on[0].day} تا ${on[on.length - 1].day}`;
  const names = on.map((item) => item.day);
  return `${names.slice(0, -1).join("، ")} و ${names[names.length - 1]}`;
}

/** «۱۰ تا ۱۸» when every open day has the same hours, else "". */
export function commonHours(week) {
  const on = week.filter((item) => item.on);
  if (!on.length) return "";
  const same = on.every((item) => item.open === on[0].open && item.close === on[0].close);
  return same ? `${toPersianDigits(hourOnly(on[0].open))} تا ${toPersianDigits(hourOnly(on[0].close))}` : "";
}

/** «۱۸:۰۰» → «۱۸» (only whole hours lose their minutes). */
export function hourOnly(time) {
  const text = String(time || "").trim();
  return /[:٫]۰۰$|:00$/.test(text) ? text.replace(/[:٫](۰۰|00)$/, "") : text;
}

/** «از ۱۰ تا ۱۸، شنبه تا چهارشنبه» for a member's page. */
export function weekSentence(week) {
  const days = daysSummary(week);
  if (!days) return "";
  const hours = commonHours(week);
  return hours ? `${days}، ${hours}` : `${days}، ساعتش هر روز فرق می‌کنه`;
}

/** The first day back after a leave («YYYY-MM-DD») as «۱۲ آبان»; "" when there is none. */
export function leaveLabel(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const parts = formatPersianDayTitle(new Date(`${iso}T12:00:00Z`));
  return `${parts.day} ${parts.monthLabel}`;
}

/** The return day for «فردا», «۳ روز دیگه», «هفتهٔ بعد» (n days from today), as «YYYY-MM-DD». */
export function leaveDayAfter(days, from = new Date()) {
  const date = new Date(from.getTime() + days * 86400000);
  return date.toISOString().slice(0, 10);
}

/**
 * What a member's card says about today. `person.state` is the stored word (فعال / مرخصی / غیرفعال); the words here are
 * only how it is shown (docs/COPY.md).
 */
export function memberToday(person, week, from = new Date()) {
  const state = person.state || "فعال";
  if (state === "مرخصی") {
    const back = leaveLabel(person.leave_until);
    return { tone: "leave", text: back ? `مرخصیه، ${back} برمی‌گرده` : "مرخصیه" };
  }
  if (state === "غیرفعال") return { tone: "off", text: "کار نمی‌کنه" };
  // The artist's own leave («نمی‌تونم بیام»): all of today, or some hours of it.
  const todayKey = formatPersianDateKey(from);
  const own = (person.leaves || []).find((leave) => leave.from <= todayKey && leave.to >= todayKey);
  if (own && !own.start) return { tone: "leave", text: "امروز نمی‌تونه بیاد" };
  const today = week.find((item) => item.today);
  if (!week.some((item) => item.on)) return { tone: "ok", text: "سرکاره" };
  if (today?.on && own?.start) return { tone: "ok", text: `امروز از ${toPersianDigits(hourOnly(own.start))} تا ${toPersianDigits(hourOnly(own.end))} نیست` };
  if (today?.on) return { tone: "ok", text: `امروز تا ${toPersianDigits(hourOnly(today.close))} سرکاره` };
  return { tone: "idle", text: "امروز نمی‌آد" };
}

/**
 * The days (and hours) an artist is really at a salon: only where the artist and the salon are both open
 * ({ day, open, close, active } rows like the ones they come from).
 */
export function overlapHours(own = [], salon = []) {
  const toMin = (time) => {
    const m = String(time || "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).match(/^(\d{1,2})(?::(\d{2}))?/);
    return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null;
  };
  return own.map((mine) => {
    const theirs = salon.find((item) => plain(item.day) === plain(mine.day));
    if (!salon.length) return mine; // the salon never set hours: its days do not limit
    if (!theirs?.active || !mine.active) return { ...mine, active: false };
    const open = Math.max(toMin(mine.open) ?? 0, toMin(theirs.open) ?? 0);
    const close = Math.min(toMin(mine.close) ?? 1440, toMin(theirs.close) ?? 1440);
    if (close <= open) return { ...mine, active: false };
    const left = toPersianDigits(String(Math.floor(open / 60)).padStart(2, "0"));
    const right = toPersianDigits(String(Math.floor(close / 60)).padStart(2, "0"));
    return { day: mine.day, active: true, open: `${left}:${toPersianDigits(String(open % 60).padStart(2, "0"))}`, close: `${right}:${toPersianDigits(String(close % 60).padStart(2, "0"))}` };
  });
}

/** A Persian date key (YYYY-MM-DD) as «۱۲ آبان»; "" when it is not one. */
export function keyLabel(key) {
  const date = persianDateKeyToDate(String(key || ""));
  if (!date) return "";
  const parts = formatPersianDayTitle(date);
  return `${parts.day} ${parts.monthLabel}`;
}

/** «۱۴۰۵٬۰۰۰» style money: whole tomans with a thousands mark, Persian digits. */
export function toman(value) {
  const number = Math.round(Number(value) || 0);
  return `${toPersianDigits(String(Math.abs(number)).replace(/\B(?=(\d{3})+(?!\d))/g, "٬"))} تومان`;
}

/** Minutes from midnight → «۱۴:۳۰». */
export function clockLabel(minutes) {
  const m = Math.max(0, Math.min(1439, Math.round(minutes)));
  return toPersianDigits(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
}

/** «۱۴:۰۰» (any digits) → minutes; 0 when it is not a time. */
export function clockMinutes(label) {
  const m = String(label || "").replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** «فردا، ۱۴:۰۰ تا ۱۸:۰۰» for one leave ({ from, to, start, end }). */
export function leaveText(leave) {
  const from = formatRelativeBookingDayLabel(leave.from);
  const days = leave.to === leave.from ? from : `${from} تا ${formatRelativeBookingDayLabel(leave.to)}`;
  return leave.start ? `${days}، ${toPersianDigits(leave.start)} تا ${toPersianDigits(leave.end)}` : days;
}
