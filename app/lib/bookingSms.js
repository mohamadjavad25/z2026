import * as users from "./db/repos/users.js";
import { getDb, run } from "./db/connection.js";
import { checkRateLimit } from "./rateLimit.js";
import { sendTemplateSms } from "./sms.js";
import { reachableByAppPush } from "./push.js";
import { formatRelativeBookingDayLabel } from "../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel } from "../shared/lib/time.js";
import { toPersianDigits } from "../shared/lib/digits.js";

/**
 * The two booking messages that must reach people even when push does not (inside the Android app, or where
 * Google's push service is blocked): a salon or artist hearing about a new request before its answer window runs
 * out, and the client hearing the answer. Each is a pattern the operator sets up (smsTemplates.js: booking_request,
 * booking_answer); until then nothing is sent. Someone with the frfro Android app gets the push alone, no SMS
 * (push.js: reachableByAppPush); iPhone and other browser users get both. Fire-and-forget: never throws and never
 * delays the response.
 */

const dayLabel = (bookingDate) => formatRelativeBookingDayLabel(bookingDate) || toPersianDigits(bookingDate || "");
const timeLabel = (time) => toPersianDigits(normalizeBookingTimeLabel(time || "") || time || "");

/** The phone to text, or "" when the push already reaches them in the app. */
async function phoneOf(userId) {
  if (!userId || (await reachableByAppPush(Number(userId)))) return "";
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
export function smsNewBookingRequest(providerUserId, { client, service, bookingDate, time, fromUserId = null }) {
  void (async () => {
    // One client may text the same salon or artist only a few times an hour, however many requests they make
    // (the push and the booking list still show every one); a request made by nobody logged in is not capped here.
    if (fromUserId) {
      const limited = await checkRateLimit(`sms-booking-request:${Number(providerUserId)}:${Number(fromUserId)}`, 3, 60 * 60 * 1000);
      if (!limited.ok) return;
    }
    const phone = await phoneOf(providerUserId);
    // The client's free-text name is cut to 30 characters: a long one would make the text long and costly.
    const who = [String(client || "").trim().slice(0, 30), service].map((part) => String(part || "").trim()).filter(Boolean).join("، ") || "مشتری";
    await sendTemplateSms(phone, "booking_request", {
      who,
      day: dayLabel(bookingDate),
      time: timeLabel(time)
    });
  })().catch(() => {});
}

/**
 * The salon or artist answered a client's request: `confirmed` true for approved, false for declined or cancelled.
 * Pass `booking` ({ kind: "salon" | "artist", id }) so each answer is texted once per booking; callers also
 * call this only when the status really changed.
 */
export function smsBookingAnswer(clientUserId, { providerName, bookingDate, time, confirmed, booking = null }) {
  void (async () => {
    if (booking && !(await claimBookingAnswerSms(booking.kind, booking.id, confirmed ? "confirmed" : "cancelled"))) return;
    const phone = await phoneOf(clientUserId);
    await sendTemplateSms(phone, "booking_answer", {
      who: String(providerName || "").trim() || "سالن",
      day: dayLabel(bookingDate),
      time: timeLabel(time),
      result: confirmed ? "تأیید شد" : "لغو شد"
    });
  })().catch(() => {});
}
