import { minutesToStart } from "./providerRules.js";
import { toPersianDigits } from "./digits.js";

/**
 * «اطمینان بدون بیعانه» (owner's decision of 2026-10-27, roadmap ۱۹): instead of a deposit, the salon or artist gets
 * certainty another way.
 *
 * «میای؟»: from ATTEND_ASK_HOURS before a confirmed visit until it starts, the client is asked whether they are
 * coming. «آره، میام» is stored (client_confirmed_at); «نمی‌تونم» is the client's ordinary cancel, so the time frees up
 * at once and anyone waiting for that day hears about it. The salon or artist sees the answer on the booking.
 *
 * The client's record: how many confirmed visits they came to and how many were marked «نیومد», across all of frfro.
 * Only a salon or artist the client booked sees it, on that client's bookings; the client sees their own.
 */
export const ATTEND_ASK_HOURS = 24;
export const ATTEND_YES_LABEL = "آره، میام";
export const ATTEND_NO_LABEL = "نمی‌تونم";
export const RELIABILITY_MONTHS = 6;
export const RELIABILITY_WARN_NO_SHOWS = 2;
/** A client with this many visits and not one «نیومد» is shown as «خوش‌قول». */
export const RELIABLE_MIN_VISITS = 3;

const CONFIRMED = ["تایید شده", "تایید"];

/**
 * Where «میای؟» stands for one of the client's bookings: "ask" (show the question), "yes" (they said they're coming)
 * or null (not a confirmed visit in the window: too far ahead, started, cancelled, marked, or a new time is waiting).
 */
export function attendanceState(booking, now = new Date()) {
  if (!booking || !CONFIRMED.includes(booking.status) || booking.no_show_at) return null;
  if (booking.proposal) return null;
  const minutes = minutesToStart(booking.booking_date || booking.date, booking.time, now);
  if (minutes === null || minutes <= 0) return null;
  if (booking.client_confirmed_at) return "yes";
  return minutes <= ATTEND_ASK_HOURS * 60 ? "ask" : null;
}

/**
 * What the salon or artist sees about «میای؟» on a confirmed booking of a client with an account: "yes" (said they're
 * coming), "waiting" (asked, no answer yet) or null (outside the window, or nobody to ask).
 */
export function ownerAttendanceState(row, now = new Date(), kind = "salon") {
  if (!row || !row.client_user_id) return null;
  // A salon's «تازه» is a visit it entered itself (settled); an artist's «تازه» is a request still waiting.
  const status = row.status === "تازه" && kind === "salon" ? "تایید شده" : row.status;
  const state = attendanceState({ ...row, status }, now);
  if (state === "yes") return "yes";
  return state === "ask" ? "waiting" : null;
}

/** «فردا ساعت ۱۶:۰۰ میای؟» */
export function attendanceQuestion(dayLabel, time) {
  const clock = toPersianDigits(String(time || "").slice(0, 5));
  return `${dayLabel ? `${dayLabel} ` : ""}ساعت ${clock} میای؟`;
}

/** The record as the screens show it. `record` is { came, noShow, recentNoShow } or null. */
export function reliabilityView(record) {
  if (!record) return null;
  const came = Number(record.came) || 0;
  const noShow = Number(record.noShow) || 0;
  const recent = Number(record.recentNoShow) || 0;
  if (!came && !noShow) return { tone: "new", chip: "", line: "اولین نوبتش توی فرفروئه.", warn: "" };
  const line = `توی فرفرو ${toPersianDigits(came)} بار اومده${noShow ? `، ${toPersianDigits(noShow)} بار نیومده` : " و هیچ‌وقت جا نزده"}.`;
  const warn = recent >= RELIABILITY_WARN_NO_SHOWS
    ? `توی ${toPersianDigits(RELIABILITY_MONTHS)} ماه گذشته ${toPersianDigits(recent)} بار نیومده؛ اگه خواستی قبل از تأیید یه زنگ بزن.`
    : "";
  if (noShow) return { tone: recent >= RELIABILITY_WARN_NO_SHOWS ? "bad" : "mid", chip: `${toPersianDigits(noShow)} بار نیومده`, line, warn };
  return { tone: "good", chip: came >= RELIABLE_MIN_VISITS ? "خوش‌قول" : "", line, warn };
}

/** The client's own line: «۱۲ بار اومدی و هیچ‌وقت جا نزدی.» */
export function ownReliabilityLine(record) {
  if (!record) return "";
  const came = Number(record.came) || 0;
  const noShow = Number(record.noShow) || 0;
  const recent = Number(record.recentNoShow) || 0;
  if (!came && !noShow) return "";
  if (!noShow) return `${toPersianDigits(came)} بار سر نوبتت اومدی و هیچ‌وقت جا نزدی. سالن‌ها این رو می‌بینن.`;
  if (recent >= RELIABILITY_WARN_NO_SHOWS) {
    return `${toPersianDigits(came)} بار اومدی و ${toPersianDigits(noShow)} بار نیومدی. سالن‌ها این رو می‌بینن؛ اگه نمی‌تونی بیای، زودتر لغو کن.`;
  }
  return `${toPersianDigits(came)} بار اومدی و ${toPersianDigits(noShow)} بار نیومدی. سالن‌ها این رو می‌بینن.`;
}
