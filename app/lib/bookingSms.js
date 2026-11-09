import * as users from "./db/repos/users.js";
import { hasPublicPage } from "./db/repos/userSettings.js";
import { getDb, get, run } from "./db/connection.js";
import { checkRateLimit } from "./rateLimit.js";
import { sendTemplateSms, templateConfigured } from "./sms.js";
import { chargeClientSms, refundClientSms } from "./billing/smsCredits.js";
import { pushReachedApp, reachableByAppPush } from "./push.js";
import { formatRelativeBookingDayLabel } from "../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel } from "../shared/lib/time.js";
import { toPersianDigits } from "../shared/lib/digits.js";
import { isSlotInPast } from "../shared/lib/slots.js";
import { normalizePhone } from "../shared/lib/phone.js";
import { providerLinkCode } from "../shared/lib/providerLink.js";
import { sendPushToUser } from "./push.js";
import * as smsBackups from "./db/repos/smsBackups.js";
import { logger } from "./logger.js";

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
 *  same news; without it, a fresh app token is taken as reached (the old rule). `backup`: when the app took it, hold
 *  this SMS for ten minutes instead of dropping it (queueSmsBackup). */
async function phoneOf(userId, push, backup = null) {
  if (!userId) return "";
  const reached = push ? await pushReachedApp(push) : await reachableByAppPush(Number(userId));
  if (reached) {
    if (backup) await queueSmsBackup(userId, backup);
    return "";
  }
  const user = userId ? await users.getUserById(Number(userId)) : null;
  return user?.phone || "";
}

/**
 * The SMS backup (owner, 2026-11-08): Google taking a push does not mean the phone showed it (the owner's own phone
 * missed one that day). So for the two booking messages that matter (a new request to the salon or artist, the answer
 * to the client) the SMS is held, and the 5-minute sweep sends it after SMS_BACKUP_DELAY_MS unless the person opened
 * frfro since, or the booking moved on (answered, cancelled, expired, its time passed). Same text and payer as the
 * SMS they would have got without the app; any hour, like that SMS. Needs `booking` ({ kind, id }); without it, no backup.
 */
export const SMS_BACKUP_DELAY_MS = 10 * 60 * 1000;
/** A request still waiting for the salon («درخواست») or the artist («تازه»). */
const REQUEST_WAITING = new Set(["درخواست", "تازه"]);

async function queueSmsBackup(userId, { booking, template, values, payerUserId = null, bookingDate = null, time = null }) {
  if (!booking?.id || (booking.kind !== "salon" && booking.kind !== "artist")) return;
  try {
    const status = await smsBackups.bookingStatus(booking.kind, booking.id);
    if (status === null) return;
    // A request the salon or artist answered in the seconds before this (the list was open) needs no «new request» SMS.
    if (template === "booking_request" && !REQUEST_WAITING.has(status)) return;
    await smsBackups.queue({ userId, template, values, payerUserId, booking, status, bookingDate, time, delayMs: SMS_BACKUP_DELAY_MS });
  } catch (error) {
    logger.warn("sms.backup.queue", { userId: Number(userId), template, error });
  }
}

/** Why a held SMS is not sent, or "" to send it. `row` comes from smsBackups.claimDue(); `status` is the booking's now. */
export function smsBackupSkipReason(row, status) {
  if (row.seen) return "seen";
  if (status === null || status !== row.booking_status) return "changed";
  if (row.booking_date && row.booking_time && isSlotInPast(row.booking_date, row.booking_time)) return "past";
  if (!row.phone) return "failed";
  return "";
}

/** The sweep's part (bookingExpirySweep.js, every 5 minutes). Never throws; returns how many went and were skipped. */
export async function sendDueSmsBackups() {
  const counts = { sent: 0, skipped: 0 };
  try {
    for (const row of await smsBackups.claimDue()) {
      const status = await smsBackups.bookingStatus(row.booking_kind, row.booking_id).catch(() => null);
      let outcome = smsBackupSkipReason(row, status);
      if (!outcome) {
        const values = row.sms_values || {};
        const result = row.template !== "booking_request"
          ? await sendClientSms(row.payer_user_id, row.phone, row.template, values)
          : await sendTemplateSms(row.phone, row.template, values).catch(() => null);
        outcome = result?.ok ? "sent" : "failed";
      }
      await smsBackups.setOutcome(row.id, outcome).catch(() => {});
      if (outcome === "sent") counts.sent += 1;
      else counts.skipped += 1;
      logger.info("sms.backup", { id: row.id, userId: Number(row.user_id), template: row.template, outcome });
    }
    await smsBackups.prune().catch(() => {});
  } catch (error) {
    logger.warn("sms.backup.sweep", { error });
  }
  return counts;
}

/**
 * Who pays for an SMS to this booking's client (owner's rule of 2026-10-28): the account the client came through. A salon
 * booking is the salon's. A booking the client made straight with an artist is the artist's, even when the artist works
 * in a salon; the copy of a salon booking on an artist's calendar (source_salon_user_id) is the salon's. Without a
 * booking row to look at, `fallbackUserId` (the provider the caller already knows) pays.
 */
export async function bookingPayerId(booking, fallbackUserId = null) {
  try {
    if (booking?.id && (booking.kind === "salon" || booking.kind === "artist")) {
      const db = await getDb();
      const row = booking.kind === "salon"
        ? await get(db, "SELECT salon_user_id AS payer FROM salon_bookings WHERE id = $1", [Number(booking.id)])
        : await get(db, "SELECT COALESCE(source_salon_user_id, artist_user_id) AS payer FROM artist_bookings WHERE id = $1", [Number(booking.id)]);
      if (row?.payer) return Number(row.payer);
    }
  } catch {
    // an unreadable booking must never stop the SMS: the fallback pays
  }
  return fallbackUserId ? Number(fallbackUserId) : null;
}

/**
 * Sends one pattern SMS to a client and charges it to `payerUserId`'s SMS wallet (smsCredits.js). A reminder is held
 * back when the account has nothing left; any other message goes at our cost. When nothing was actually sent the
 * charge is given back. Never throws.
 */
async function sendClientSms(payerUserId, phone, template, values, { reminder = false } = {}) {
  if (!phone) return null;
  const taken = await chargeClientSms(payerUserId, { reminder }).catch(() => ({ ok: true, charge: null }));
  if (!taken.ok) return null;
  const result = await sendTemplateSms(phone, template, values).catch(() => null);
  if (!result?.ok) await refundClientSms(taken.charge).catch(() => {});
  return result;
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
export function smsNewBookingRequest(providerUserId, { client, service, bookingDate, time, fromUserId = null, booking = null }, push = null) {
  void (async () => {
    // One client may text the same salon or artist only a few times an hour, however many requests they make
    // (the push and the booking list still show every one); a request made by nobody logged in is not capped here.
    if (fromUserId) {
      const limited = await checkRateLimit(`sms-booking-request:${Number(providerUserId)}:${Number(fromUserId)}`, 3, 60 * 60 * 1000);
      if (!limited.ok) return;
    }
    // The client's free-text name is cut to 30 characters: a long one would make the text long and costly.
    // Cut by whole characters (code points), so an emoji at the cut is never left half (it showed as "�" in the text).
    const who = [Array.from(String(client || "").trim()).slice(0, 30).join(""), service].map((part) => String(part || "").trim()).filter(Boolean).join("، ") || "مشتری";
    const values = { who, day: dayLabel(bookingDate), time: timeLabel(time) };
    const phone = await phoneOf(providerUserId, push, { booking, template: "booking_request", values, bookingDate, time });
    await sendTemplateSms(phone, "booking_request", values);
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
    const name = String(providerName || "").trim() || (providerUserId ? (await users.getUserById(Number(providerUserId)))?.name : "");
    const values = {
      who: String(name || "").trim() || "سالن",
      day: dayLabel(bookingDate),
      time: timeLabel(time),
      result: expired ? "منقضی شد" : confirmed ? "تأیید شد" : "لغو شد"
    };
    const payerUserId = await bookingPayerId(booking, providerUserId);
    const phone = await phoneOf(clientUserId, push, { booking, template: "booking_answer", values, payerUserId, bookingDate, time });
    if (!phone) return;
    await sendClientSms(payerUserId, phone, "booking_answer", values);
  })().catch(() => {});
}

/** About two hours before a visit, for a client no notification reached (no app, no browser notifications: most
 *  iPhones). `push` is the reminder push just sent; it counts as reached when any device took it. */
export function smsBookingReminder(clientUserId, { providerName, time, payerUserId = null }, push) {
  void (async () => {
    const result = await Promise.resolve(push).catch(() => null);
    if (!clientUserId || Number(result?.sent || 0) > 0) return;
    const user = await users.getUserById(Number(clientUserId));
    // The only SMS held back when the account's SMS are used up (smsCredits.js).
    await sendClientSms(payerUserId, user?.phone || "", "booking_reminder", {
      who: String(providerName || "").trim() || "سالن",
      time: timeLabel(time)
    }, { reminder: true });
  })().catch(() => {});
}

/** The same two-hour text for a client who has only a number (a booking entered by hand): nothing else can reach them. */
export function smsReminderToNumber(phone, { providerName, time, payerUserId = null }) {
  void (async () => {
    // Typed-in numbers cost money and reach strangers if abused: far above what a busy salon reminds in an hour.
    const limited = await checkRateLimit(`sms-hand-reminder:${Number(payerUserId)}`, 100, 60 * 60 * 1000);
    if (!limited.ok) return;
    await sendClientSms(payerUserId, phone, "booking_reminder", {
      who: String(providerName || "").trim() || "سالن",
      time: timeLabel(time)
    }, { reminder: true });
  })().catch(() => {});
}

/**
 * «خبرم کن»: a time opened on the day a client is waiting for. Texted only when the push did not reach their app, and
 * at most a few times a day per client, however many places they wait at.
 */
export function smsWaitlistOpen(clientUserId, { providerName, bookingDate, time }, push = null) {
  void (async () => {
    const phone = await phoneOf(clientUserId, push);
    if (!phone) return;
    const limited = await checkRateLimit(`sms-waitlist:${Number(clientUserId)}`, 3, 24 * 60 * 60 * 1000);
    if (!limited.ok) return;
    await sendTemplateSms(phone, "waitlist_open", {
      who: String(providerName || "").trim() || "سالن",
      day: dayLabel(bookingDate),
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
export function smsBookingCancelledByProvider(clientUserId, { providerName, bookingDate, time, booking = null, gone = false, phone: numberOnly = "" }) {
  void (async () => {
    if (booking && !(await claimBookingAnswerSms(booking.kind, booking.id, "cancelled"))) return;
    const template = gone ? "booking_cancelled_gone" : "booking_cancelled_by_provider";
    const values = { who: String(providerName || "").trim() || "سالن", day: dayLabel(bookingDate), time: timeLabel(time) };
    const payerUserId = await bookingPayerId(booking);
    // The worst message to lose: Google taking the push is no proof, and the client would come for a cancelled visit.
    const phone = numberOnly || await phoneOf(clientUserId, null, { booking, template, values, payerUserId, bookingDate, time });
    await sendClientSms(payerUserId, phone, template, values);
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
    const textValues = { who: String(providerName || "").trim() || "سالن", ...values };
    const payerUserId = await bookingPayerId(booking);
    const phone = await phoneOf(clientUserId, null, { booking, template, values: textValues, payerUserId, bookingDate: booking?.booking_date || null, time: booking?.time || null });
    await sendClientSms(payerUserId, phone, template, textValues);
  })().catch(() => {});
}

/**
 * A salon or artist entered a booking for a client by hand (owner's decision 2026-10-30): the client hears about it, so
 * nobody turns up unaware. A client with an account gets a push, and the SMS too unless their Android app took the push;
 * a number with no account gets the SMS. The SMS is paid by the provider (their SMS wallet), texted once per booking, and
 * one provider can send only a limited number an hour. Fire-and-forget: never throws, never delays the response.
 * `provider`: { id, type, name }; `booking`: { kind: "salon" | "artist", id, bookingDate, time, service, phone }.
 */
// A number typed in by a salon or artist hears from frfro at most this often in a day, across every account (audit of
// 2026-11-09: free accounts could otherwise take turns texting a stranger at frfro's cost).
const TYPED_NUMBER_TEXTS_PER_DAY = 6;
const typedNumberMayGetText = async (phone) => (await checkRateLimit(`sms-typed-number:${phone}`, TYPED_NUMBER_TEXTS_PER_DAY, 24 * 60 * 60 * 1000)).ok;

export function noticeClientBookedByProvider(provider, booking) {
  void (async () => {
    const phone = normalizePhone(booking?.phone);
    if (!/^09\d{9}$/.test(phone)) return;
    // A visit already over (a salon logging yesterday's work, an artist's earlier slot today) is history, not news.
    if (isSlotInPast(booking.bookingDate, booking.time)) return;
    const providerUser = await users.getUserById(Number(provider.id));
    if (!providerUser || normalizePhone(providerUser.phone) === phone) return;
    // A moved visit is news again; the minute in the key stops a double tap, not a later move back.
    const claim = booking.moved ? `moved:${booking.bookingDate} ${booking.time}:${Math.floor(Date.now() / 60000)}` : "made";
    if (!(await claimBookingAnswerSms(booking.kind, booking.id, claim))) return;
    const limited = await checkRateLimit(`sms-booking-made:${Number(provider.id)}`, 40, 60 * 60 * 1000);
    if (!limited.ok) return;
    const name = String(provider.name || providerUser.name || "").trim() || (provider.type === "artist" ? "آرتیستت" : "سالن");
    const when = bookingWhen(booking.bookingDate, booking.time);
    const account = await users.getVerifiedClientByPhone(phone);
    const clientId = account ? Number(account.id) : 0;
    const push = clientId
      ? sendPushToUser(clientId, booking.moved
        ? { title: "ساعت نوبتت عوض شد", body: `${name} نوبتت رو برد ${when}. توی فرفرو ببینش.`, url: "/" }
        : { title: "یه نوبت برات ثبت شد", body: `${name} برات نوبت ثبت کرد، ${when}. توی فرفرو ببینش.`, url: "/" }).catch(() => null)
      : null;
    if (clientId && await pushReachedApp(push)) return;
    if (!(await typedNumberMayGetText(phone))) return;
    const values = { who: name, day: dayLabel(booking.bookingDate), time: timeLabel(booking.time) };
    // The link lets this client book the next visit themselves (owner, 2026-11-09). The text without it stays until its
    // pattern is approved, and for a salon or artist whose page is private (the link would open nothing).
    const code = templateConfigured("booking_made_link") && await hasPublicPage(provider.id)
      ? providerLinkCode(provider.type, provider.id)
      : "";
    if (code) await sendClientSms(Number(provider.id), phone, "booking_made_link", { ...values, code });
    else await sendClientSms(Number(provider.id), phone, "booking_made_for_you", values);
  })().catch(() => {});
}

/**
 * A booking entered by hand was cancelled by the salon or artist (owner, 2026-11-09). A verified account hears it the
 * normal way; a number with no such account gets the SMS. Nothing for a visit already over, nor for the provider's own
 * number. Returns the account id to notify, or 0 when this function dealt with it. Never throws.
 */
export async function handEntryCancelTarget(rawPhone, { booking, providerName, gone = false }) {
  try {
    const phone = normalizePhone(rawPhone);
    if (!/^09\d{9}$/.test(phone) || isSlotInPast(booking.booking_date, booking.time)) return 0;
    const payer = await bookingPayerId(booking);
    const owner = payer ? await users.getUserById(payer) : null;
    if (owner && normalizePhone(owner.phone) === phone) return 0;
    const account = await users.getVerifiedClientByPhone(phone);
    if (account) return Number(account.id);
    // Typed-in numbers: a cap against entering strangers and cancelling them. A provider leaving frfro is the exception.
    if (!gone && payer && !(await checkRateLimit(`sms-hand-cancel:${payer}`, 100, 60 * 60 * 1000)).ok) return 0;
    if (!gone && !(await typedNumberMayGetText(phone))) return 0;
    smsBookingCancelledByProvider(0, { providerName, bookingDate: booking.booking_date, time: booking.time, booking: { kind: booking.kind, id: booking.id }, gone, phone });
  } catch {
    // a cancelled booking is already saved; a lost notice must not undo it
  }
  return 0;
}

export { dayLabel as smsDayLabel, timeLabel as smsTimeLabel };
