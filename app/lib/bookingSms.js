import * as users from "./db/repos/users.js";
import { sendTemplateSms } from "./sms.js";
import { timeoutMinutes } from "./bookingExpirySweep.js";
import { formatRelativeBookingDayLabel } from "../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel } from "../shared/lib/time.js";
import { toPersianDigits } from "../shared/lib/digits.js";

/**
 * The two booking messages that must reach people even when push does not (inside the Android app, or where
 * Google's push service is blocked): a salon or artist hearing about a new request before its answer window runs
 * out, and the client hearing the answer. Each is a pattern the operator sets up (smsTemplates.js: booking_request,
 * booking_answer); until then nothing is sent. Fire-and-forget: never throws and never delays the response.
 */

const dayLabel = (bookingDate) => formatRelativeBookingDayLabel(bookingDate) || toPersianDigits(bookingDate || "");
const timeLabel = (time) => toPersianDigits(normalizeBookingTimeLabel(time || "") || time || "");

async function phoneOf(userId) {
  const user = userId ? await users.getUserById(Number(userId)) : null;
  return user?.phone || "";
}

/** A client just asked `providerUserId` (a salon or an artist) for a time. */
export function smsNewBookingRequest(providerUserId, { client, service, bookingDate, time }) {
  void (async () => {
    const phone = await phoneOf(providerUserId);
    const who = [client, service].map((part) => String(part || "").trim()).filter(Boolean).join("، ") || "مشتری";
    await sendTemplateSms(phone, "booking_request", {
      who,
      day: dayLabel(bookingDate),
      time: timeLabel(time),
      minutes: toPersianDigits(timeoutMinutes())
    });
  })().catch(() => {});
}

/** The salon or artist answered a client's request: `confirmed` true for approved, false for declined or cancelled. */
export function smsBookingAnswer(clientUserId, { providerName, bookingDate, time, confirmed }) {
  void (async () => {
    const phone = await phoneOf(clientUserId);
    await sendTemplateSms(phone, "booking_answer", {
      who: String(providerName || "").trim() || "سالن",
      day: dayLabel(bookingDate),
      time: timeLabel(time),
      result: confirmed ? "تأیید شد" : "لغو شد"
    });
  })().catch(() => {});
}
