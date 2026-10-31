import { WEEK_DAYS, clockMinutes, hourOnly } from "../team/teamWeek";
import { toPersianDigits } from "../../shared/lib/digits";

const plain = (value) => String(value || "").replace(/[‌\s]/g, "");

/** What a salon starts with the first time it opens «شرایط همکاری» (owner's design 2026-10-28). */
export const DEFAULT_JOIN_TERMS = {
  days: "شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه",
  from: "۱۰:۰۰",
  to: "۱۸:۰۰",
  share: 60,
  ownShare: null,
  allowProposals: true
};

/** «شنبه، یکشنبه، دوشنبه» (as stored) → «شنبه تا دوشنبه» when the days run on, else the names joined with «و». */
export function daysText(days) {
  const have = String(days || "").split(/[،,]/).map(plain).filter(Boolean);
  const on = WEEK_DAYS.filter((item) => have.includes(plain(item.day)));
  if (!on.length) return "";
  if (on.length === 7) return "همه روزهای هفته";
  if (on.length === 1) return on[0].day;
  const first = WEEK_DAYS.findIndex((item) => item.day === on[0].day);
  const contiguous = on.every((item, index) => WEEK_DAYS[first + index]?.day === item.day);
  if (contiguous && on.length > 2) return `${on[0].day} تا ${on[on.length - 1].day}`;
  const names = on.map((item) => item.day);
  return `${names.slice(0, -1).join("، ")} و ${names[names.length - 1]}`;
}

/** «۱۰:۰۰» + «۱۸:۰۰» → «۱۰ تا ۱۸»; "" when either is missing. */
export function hoursText(from, to) {
  if (!from || !to || clockMinutes(to) <= clockMinutes(from)) return "";
  return `${toPersianDigits(hourOnly(from))} تا ${toPersianDigits(hourOnly(to))}`;
}

export const percentText = (value) => (Number.isInteger(value) ? `${toPersianDigits(value)}٪` : "");

/** «شنبه تا چهارشنبه، ۱۰ تا ۱۸، سهم آرتیست ۶۰٪» */
export function termsSummary(terms) {
  return [daysText(terms?.days), hoursText(terms?.from, terms?.to), Number.isInteger(terms?.share) ? `سهم آرتیست ${percentText(terms.share)}` : ""]
    .filter(Boolean)
    .join("، ");
}

/** The salon's rules text → its separate lines (one clause per line). */
export function rulesToLines(text) {
  return String(text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
}
