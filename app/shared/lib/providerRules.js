import { toPersianDigits } from "./digits.js";
import { normalizeBookingTimeLabel } from "./time.js";
import { bookingStartMs } from "./reminderTiming.js";

/**
 * The owner's rules of 2026-10-22 about a confirmed booking (docs/DECISIONS.md): it is never broken without the
 * client being told. Numbers and exact Persian texts live here so the server and the screens say the same thing.
 */

/** A confirmed booking starting within this many hours blocks leaving, removing and deleting. */
export const NEAR_BOOKING_HOURS = 24;
/** A proposed new time is held this long ... */
export const PROPOSAL_HOURS = 6;
/** ... or until this many minutes before the booking, whichever comes first. */
export const PROPOSAL_MIN_LEAD_MINUTES = 120;

export const CLIENT_CAN_CALL = "تماس با مشتری";
export const CANCEL_WITH_NOTICE = "لغو با اطلاع مشتری";
export const CANCEL_ALL_AND_TEXT = "لغو همهٔ نوبت‌ها و ارسال پیامک";
export const HANDOVER_LABEL = "واگذار به آرتیست دیگر";
export const PROPOSE_LABEL = "پیشنهاد ساعت دیگه";
export const CALL_FIRST_TEXT = "اول به مشتری زنگ بزن، بعد لغو کن.";
export const ACCEPT_LABEL = "قبول می‌کنم";
export const CLIENT_CANCEL_LABEL = "لغو نوبت، بدون هیچ مشکلی";
export const CALL_PLACE_LABEL = { salon: "تماس با سالن", artist: "تماس با آرتیست" };
export const SALON_GONE_TEXT = "سالن دیگه توی فرفرو نیست";
export const ARTIST_GONE_TEXT = "آرتیست دیگه توی فرفرو نیست";

/** «۲ مشتری تا ۲۴ ساعت دیگر نوبت دارند. …» */
export function blockedByNearText(count) {
  const n = Math.max(1, Number(count) || 1);
  return `${toPersianDigits(n)} مشتری تا ${toPersianDigits(NEAR_BOOKING_HOURS)} ساعت دیگه نوبت دارن. تا این نوبت‌ها انجام یا لغو نشن، نمی‌شه حساب رو پاک کرد.`;
}

/** The same block when the person is leaving a team (not deleting the account). */
export function blockedTeamText(count, removing = false) {
  const n = Math.max(1, Number(count) || 1);
  return `${toPersianDigits(n)} مشتری تا ${toPersianDigits(NEAR_BOOKING_HOURS)} ساعت دیگه نوبت دارن. تا این نوبت‌ها انجام یا لغو نشن، نمی‌شه ${removing ? "آرتیست رو از تیم برداشت" : "از تیم بیرون رفت"}.`;
}

/** «شیدا» → «سالن شیدا» / «آرتیست شیدا» (a name that already starts with the word is left alone). */
export function providerLabel(type, name) {
  const word = type === "artist" ? "آرتیست" : "سالن";
  const text = String(name || "").trim();
  if (!text) return word;
  return text.startsWith(word) ? text : `${word} ${text}`;
}

/** «سالن شیدا نوبت تو را لغو کرد. بابت این اتفاق متأسفیم. می‌توانی از فرفرو نوبت دیگری بگیری.» */
export function cancelledByProviderText(type, name) {
  return `${providerLabel(type, name)} نوبتت رو لغو کرد. ببخشید که این‌طوری شد؛ یه نوبت دیگه از فرفرو بگیر.`;
}

/** «سالن شیدا می‌خواهد نوبتت را از ۱۰ به ۱۲ ببرد. قبول می‌کنی؟» (day labels only when the day changes) */
export function timeProposalText(type, name, from, to) {
  return `${providerLabel(type, name)} می‌خواد نوبتت رو از ${from} ببره به ${to}. قبول می‌کنی؟`;
}

export function handoverProposalText(type, name, fromStaff, toStaff) {
  const who = fromStaff ? `از ${fromStaff} به ${toStaff}` : `به ${toStaff}`;
  return `${providerLabel(type, name)} می‌خواد آرتیست نوبتت رو ${who} بده. قبول می‌کنی؟`;
}

/** "10:00" as «۱۰» when it is on the hour, «۱۰:۳۰» otherwise (the short form used in the proposal sentence). */
export function shortClock(time) {
  const label = normalizeBookingTimeLabel(time || "");
  return toPersianDigits(label.endsWith(":00") ? String(Number(label.slice(0, 2))) : label);
}

/**
 * When a proposal stops being valid (epoch ms): 6 hours after it was made, or PROPOSAL_MIN_LEAD_MINUTES before the
 * booking, whichever is earlier. null when it can't be worked out.
 */
export function proposalDeadlineMs({ proposalAt, bookingDate, time }, now = new Date()) {
  const madeAt = proposalAt ? new Date(proposalAt).getTime() : NaN;
  if (!Number.isFinite(madeAt)) return null;
  const byHold = madeAt + PROPOSAL_HOURS * 3600 * 1000;
  const start = bookingStartMs(bookingDate, time, now);
  if (start === null) return byHold;
  return Math.min(byHold, start - PROPOSAL_MIN_LEAD_MINUTES * 60 * 1000);
}

export function isProposalLapsed(row, now = new Date()) {
  const deadline = proposalDeadlineMs({ proposalAt: row?.proposal_at, bookingDate: row?.booking_date, time: row?.time }, now);
  return deadline === null ? true : now.getTime() >= deadline;
}

/** Minutes from `now` to the booking's start (null when unreadable; negative once started). */
export function minutesToStart(bookingDate, time, now = new Date()) {
  const start = bookingStartMs(bookingDate, time, now);
  return start === null ? null : (start - now.getTime()) / 60000;
}

/** Starts in less than NEAR_BOOKING_HOURS (and has not started yet). */
export function startsSoon(bookingDate, time, now = new Date()) {
  const minutes = minutesToStart(bookingDate, time, now);
  return minutes !== null && minutes > 0 && minutes < NEAR_BOOKING_HOURS * 60;
}

/**
 * The open proposal on a booking row as the screens see it: { date, time, staff, expiresAt (ISO) }, or null when there is
 * none or it has run out (a lapsed one is closed by the sweep; until then it must not be offered to the client).
 */
export function proposalView(row, now = new Date()) {
  if (!row?.proposal_at) return null;
  if (isProposalLapsed(row, now)) return null;
  const deadline = proposalDeadlineMs({ proposalAt: row.proposal_at, bookingDate: row.booking_date, time: row.time }, now);
  return {
    date: row.proposal_date || "",
    time: row.proposal_time || "",
    staff: row.proposal_staff || "",
    expiresAt: deadline === null ? null : new Date(deadline).toISOString()
  };
}
