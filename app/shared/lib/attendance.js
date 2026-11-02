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
 * Who is asked (owner's decision of 2026-11-02): only a client with a «نیومد» in the last RELIABILITY_MONTHS months, and
 * only until they have come ATTEND_TRUST_STREAK times since that «نیومد». Everyone else is never asked; every client
 * sees ATTEND_NOTICE once when booking. A «نمی‌تونم» before the visit is a cancel and never counts as «نیومد».
 *
 * The client's record: how many confirmed visits they came to and how many were marked «نیومد», across all of frfro.
 * Only a salon or artist the client booked sees it, on that client's bookings; the client sees their own. The salon's
 * or artist's mark is what counts, whatever the client answered.
 */
export const ATTEND_ASK_HOURS = 24;
export const ATTEND_YES_LABEL = "آره، میام";
export const ATTEND_NO_LABEL = "نمی‌تونم";
export const RELIABILITY_MONTHS = 6;
export const RELIABILITY_WARN_NO_SHOWS = 2;
/** A client with this many visits and not one «نیومد» is shown as «خوش‌قول». */
export const RELIABLE_MIN_VISITS = 3;
/** After this many visits in a row since their last «نیومد», a client is no longer asked «میای؟». */
export const ATTEND_TRUST_STREAK = 3;
/** The one line every client sees when sending a request. */
export const ATTEND_NOTICE = "اگه نتونستی بیای، از قبل لغو کن؛ نیومدنِ بی‌خبر توی سابقه‌ت می‌مونه.";

/** Whether this client is asked «میای؟»: a «نیومد» in the last months and not yet ATTEND_TRUST_STREAK visits since. */
export function needsAttendQuestion(record) {
  if (!record) return false;
  return (Number(record.recentNoShow) || 0) >= 1 && (Number(record.cameSinceNoShow) || 0) < ATTEND_TRUST_STREAK;
}

const CONFIRMED = ["تایید شده", "تایید"];

/**
 * Where «میای؟» stands for one of the client's bookings: "ask" (show the question), "yes" (they said they're coming)
 * or null (not a confirmed visit in the window: too far ahead, started, cancelled, marked, or a new time is waiting).
 * A booking with attend_ask === false belongs to a client who is not asked (needsAttendQuestion), so it never shows "ask".
 */
export function attendanceState(booking, now = new Date()) {
  if (!booking || !CONFIRMED.includes(booking.status) || booking.no_show_at) return null;
  if (booking.proposal) return null;
  const minutes = minutesToStart(booking.booking_date || booking.date, booking.time, now);
  if (minutes === null || minutes <= 0) return null;
  if (booking.client_confirmed_at) return "yes";
  if (booking.attend_ask === false) return null;
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
  // Only a client who is asked can be "waiting"; the row carries their record (reliability).
  const attendAsk = row.attend_ask ?? (row.reliability ? needsAttendQuestion(row.reliability) : false);
  const state = attendanceState({ ...row, status, attend_ask: attendAsk }, now);
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
