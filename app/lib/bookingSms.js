import * as users from "./db/repos/users.js";
import { getDb, run } from "./db/connection.js";
import { checkRateLimit } from "./rateLimit.js";
import { sendTemplateSms } from "./sms.js";
import { pushReachedApp, reachableByAppPush } from "./push.js";
import { formatRelativeBookingDayLabel } from "../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel } from "../shared/lib/time.js";
import { toPersianDigits } from "../shared/lib/digits.js";

/**
 * The two booking messages that must reach people even when push does not (inside the Android app, or where
 * Google's push service is blocked): a salon or artist hearing about a new request before its answer window runs
 * out, and the client hearing the answer. Each is a pattern the operator sets up (smsTemplates.js: booking_request,
 * booking_answer); until then nothing is sent. Someone whose frfro Android app took the push gets it alone, no SMS
 * (push.js: pushReachedApp); when that push failed (Google unreachable from the server, a dead token), and for iPhone
 * and other browser users, the SMS goes too. Fire-and-forget: never throws and never delays the response.
 */

const dayLabel = (bookingDate) => formatRelativeBookingDayLabel(bookingDate) || toPersianDigits(bookingDate || "");
const timeLabel = (time) => toPersianDigits(normalizeBookingTimeLabel(time || "") || time || "");

/** "فردا ساعت ۱۴:۳۰" for a push or SMS text: the day as people say it, the time in Persian digits. */
export function bookingWhen(bookingDate, time) {
  return [bookingDate ? dayLabel(bookingDate) : "", time ? `ساعت ${timeLabel(time)}` : ""].filter(Boolean).join(" ");
}

/** The phone to text, or "" when the push reached them in the app. `push` is the sendPushToUser() just made for the
 *  same news; without it, a fresh app token is taken as reached (the old rule). */
async function phoneOf(userId, push) {
  if (!userId) return "";
  const reached = push ? await pushReachedApp(push) : await reachableByAppPush(Number(userId));
  if (reached) return "";
  const user = userId ? await users.getUserById(Number(userId)) : null;
  return user?.phone || "";
}

/**
 * Claims the right to text this answer: true exactly once per (booking, status), however many calls or
 * simultaneous taps come (the primary key of booking_sms_sent decides). A repeat gets false and sends nothing.
 */
async function claimBookingAnswerSms(kind, bookingId, status) {
  if (!bookingId) return true;
  const db = await getDb();
  const res = await run(db, `
    INSERT INTO booking_sms_sent (booking_kind, booking_id, status) VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING RETURNING booking_id
  `, [kind, Number(bookingId), String(status)]);
  return res.rows.length > 0;
}

/** A client just asked `providerUserId` (a salon or an artist) for a time (or their request moved there from a
 *  first choice that did not answer). How long it waits is the client's choice, so the text promises no deadline. */
export function smsNewBookingRequest(providerUserId, { client, service, bookingDate, time, fromUserId = null }, push = null) {
  void (async () => {
    // One client may text the same salon or artist only a few times an hour, however many requests they make
    // (the push and the booking list still show every one); a request made by nobody logged in is not capped here.
    if (fromUserId) {
      const limited = await checkRateLimit(`sms-booking-request:${Number(providerUserId)}:${Number(fromUserId)}`, 3, 60 * 60 * 1000);
      if (!limited.ok) return;
    }
    const phone = await phoneOf(providerUserId, push);
    // The client's free-text name is cut to 30 characters: a long one would make the text long and costly.
    // Cut by whole characters (code points), so an emoji at the cut is never left half (it showed as "�" in the text).
    const who = [Array.from(String(client || "").trim()).slice(0, 30).join(""), service].map((part) => String(part || "").trim()).filter(Boolean).join("، ") || "مشتری";
    await sendTemplateSms(phone, "booking_request", {
      who,
      day: dayLabel(bookingDate),
      time: timeLabel(time)
    });
  })().catch(() => {});
}

/**
 * The salon or artist answered a client's request: `confirmed` true for approved, false for declined or cancelled.
 * `expired` instead: nobody answered in time (bookingExpirySweep.js). `providerUserId` looks the name up when the
 * caller does not have it. Pass `booking` ({ kind: "salon" | "artist", id }) so each answer is texted once per
 * booking; callers also call this only when the status really changed.
 */
export function smsBookingAnswer(clientUserId, { providerName, providerUserId = null, bookingDate, time, confirmed, expired = false, booking = null }, push = null) {
  void (async () => {
    const status = expired ? "expired" : confirmed ? "confirmed" : "cancelled";
    if (booking && !(await claimBookingAnswerSms(booking.kind, booking.id, status))) return;
    const phone = await phoneOf(clientUserId, push);
    if (!phone) return;
    const name = String(providerName || "").trim() || (providerUserId ? (await users.getUserById(Number(providerUserId)))?.name : "");
    await sendTemplateSms(phone, "booking_answer", {
      who: String(name || "").trim() || "سالن",
      day: dayLabel(bookingDate),
      time: timeLabel(time),
      result: expired ? "منقضی شد" : confirmed ? "تأیید شد" : "لغو شد"
    });
  })().catch(() => {});
}

/** About two hours before a visit, for a client no notification reached (no app, no browser notifications: most
 *  iPhones). `push` is the reminder push just sent; it counts as reached when any device took it. */
export function smsBookingReminder(clientUserId, { providerName, time }, push) {
  void (async () => {
    const result = await Promise.resolve(push).catch(() => null);
    if (!clientUserId || Number(result?.sent || 0) > 0) return;
    const user = await users.getUserById(Number(clientUserId));
    await sendTemplateSms(user?.phone || "", "booking_reminder", {
      who: String(providerName || "").trim() || "سالن",
      time: timeLabel(time)
    });
  })().catch(() => {});
}

/** A client cancelled their visit: the salon or artist hears it by SMS when the push did not reach their app. */
export function smsClientCancelled(providerUserId, { client, bookingDate, time }, push = null) {
  void (async () => {
    const phone = await phoneOf(providerUserId, push);
    await sendTemplateSms(phone, "booking_cancelled", {
      who: String(client || "").trim() || "مشتری",
      day: dayLabel(bookingDate),
      time: timeLabel(time)
    });
  })().catch(() => {});
}

/**
 * A provider cancelled a booking that was already confirmed (or left frfro with it still on the books): the client's
 * text. Claimed under the same key as the plain "cancelled" answer above, so one booking is never texted twice
 * whichever of the two messages goes first. `gone`: the salon or artist is no longer on frfro («… دیگر در فرفرو نیست»).
 */
export function smsBookingCancelledByProvider(clientUserId, { providerName, bookingDate, time, booking = null, gone = false }) {
  void (async () => {
    if (booking && !(await claimBookingAnswerSms(booking.kind, booking.id, "cancelled"))) return;
    const phone = await phoneOf(clientUserId);
    await sendTemplateSms(phone, gone ? "booking_cancelled_gone" : "booking_cancelled_by_provider", {
      who: String(providerName || "").trim() || "سالن",
      day: dayLabel(bookingDate),
      time: timeLabel(time)
    });
  })().catch(() => {});
}

/**
 * The provider asks the client to move a confirmed booking (another time, or another artist). Texted once per
 * distinct proposal (`proposalKey`), and at most 3 times a day per booking however often the provider re-proposes.
 */
export function smsBookingProposal(clientUserId, { template, providerName, booking, proposalKey, values }) {
  void (async () => {
    if (booking && !(await claimBookingAnswerSms(booking.kind, booking.id, `proposal:${proposalKey}`))) return;
    if (booking) {
      const limited = await checkRateLimit(`sms-proposal:${booking.kind}:${Number(booking.id)}`, 3, 24 * 60 * 60 * 1000);
      if (!limited.ok) return;
    }
    const phone = await phoneOf(clientUserId);
    await sendTemplateSms(phone, template, { who: String(providerName || "").trim() || "سالن", ...values });
  })().catch(() => {});
}

export { dayLabel as smsDayLabel, timeLabel as smsTimeLabel };
