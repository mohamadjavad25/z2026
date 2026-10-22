import * as users from "./db/repos/users.js";
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

/** A client just asked `providerUserId` (a salon or an artist) for a time (or their request moved there from a
 *  first choice that did not answer). How long it waits is the client's choice, so the text promises no deadline. */
export function smsNewBookingRequest(providerUserId, { client, service, bookingDate, time }, push = null) {
  void (async () => {
    const phone = await phoneOf(providerUserId, push);
    const who = [client, service].map((part) => String(part || "").trim()).filter(Boolean).join("، ") || "مشتری";
    await sendTemplateSms(phone, "booking_request", {
      who,
      day: dayLabel(bookingDate),
      time: timeLabel(time)
    });
  })().catch(() => {});
}

/** The salon or artist answered a client's request: `confirmed` true for approved, false for declined or cancelled. */
export function smsBookingAnswer(clientUserId, { providerName, bookingDate, time, confirmed }, push = null) {
  void (async () => {
    const phone = await phoneOf(clientUserId, push);
    await sendTemplateSms(phone, "booking_answer", {
      who: String(providerName || "").trim() || "سالن",
      day: dayLabel(bookingDate),
      time: timeLabel(time),
      result: confirmed ? "تأیید شد" : "لغو شد"
    });
  })().catch(() => {});
}
