import * as requests from "./db/repos/contactRequests.js";
import * as connections from "./db/repos/connections.js";
import * as users from "./db/repos/users.js";
import { sendPushToUser } from "./push.js";
import { addSalonService, listSalonServices } from "./db/repos/salons/services.js";
import { addArtistService, listArtistServices } from "./db/repos/artists/services.js";
import { sendTemplateSms, templateConfigured } from "./sms.js";
import { bookingWhen, smsDayLabel } from "./bookingSms.js";
import { noteAdminEvent } from "./adminNews.js";
import { getSiteUrl } from "./siteUrl.js";
import { normalizePhone } from "./auth.js";
import { shortClock } from "../shared/lib/providerRules.js";
import { normalizeBookingTimeLabel } from "../shared/lib/time.js";
import { isBeautyEmojiId } from "../shared/constants/beautyEmoji.js";
import { findClientServiceByName } from "../shared/constants/clientServices.js";
import { onlineBookingBlock } from "./billing/access.js";

/**
 * A client's request to a salon or artist that is not on frfro yet (owner, 2026-11-12). The rules are in
 * db/repos/contactRequests.js; this file adds the checks on the number, the SMS and who is told what.
 */
const quiet = (promise) => Promise.resolve(promise).catch(() => {});

const MOBILE = /^09\d{9}$/;
const MAX_SERVICE = 80;
const MAX_FREE_SERVICE = 30;
const MAX_CONTACT_NAME = 60;

const clean = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Free text goes out in an SMS from frfro's own line and onto a new account's menu, so only plain words do (code
 * review 2026-11-12): a service of frfro's list keeps its own name; anything else keeps Persian letters, spaces and
 * the half-space, no digits, Latin letters or dots (no links or numbers can ride along). "" when nothing is left.
 */
export function safeServiceName(value) {
  const typed = clean(value, MAX_SERVICE);
  const known = findClientServiceByName(typed);
  if (known) return known.name;
  return clean(typed.replace(/[^\u0621-\u063A\u0641-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC\u0622\u0623\u0624\u0626\u0629\u06C0\s\u200c]/g, " "), MAX_FREE_SERVICE);
}

/** The client's first name for the SMS, Persian letters only, else «یه مشتری». */
export function safeFirstName(name) {
  const first = String(name || "").trim().split(/\s+/)[0] || "";
  return /^[\u0621-\u064A\u067E\u0686\u0698\u06A9\u06AF\u06CC\u0622\u200c]{2,20}$/.test(first) ? first : "یه مشتری";
}

/**
 * The client sends a request. Returns one of
 *   { status: 201, data: { request, sms } }      sms: "sent" | "joined" | "off" | "failed"
 *   { status: 200, data: { found: profile } }    that number is a salon or artist on frfro: book there instead
 *   { status: 4xx, error, code }
 */
export async function sendContactRequest(client, body = {}) {
  const phone = normalizePhone(body.phone || "");
  if (!MOBILE.test(phone)) return { status: 400, error: "این شماره موبایل نیست؛ یکی دیگه رو انتخاب کن.", code: "NOT_MOBILE" };
  if (phone === normalizePhone(client.phone || "")) return { status: 400, error: "این شماره خودته؛ یکی دیگه رو انتخاب کن.", code: "OWN_NUMBER" };
  const service = safeServiceName(body.service);
  if (!service) return { status: 400, error: "اسم کار رو فارسی بنویس.", code: "NO_SERVICE" };
  const bookingDate = String(body.bookingDate || "").trim();
  const time = normalizeBookingTimeLabel(body.time || "");
  const timeProblem = requests.requestTimeProblem(bookingDate, time);
  if (timeProblem) return { status: 400, error: timeProblem, code: "BAD_TIME" };

  // Already on frfro as a salon or artist (by login number or the number on its page): book there, no SMS.
  const { results } = await connections.searchProfiles(phone, client.id);
  if (results.length) return { status: 200, data: { found: results[0] } };
  const account = await users.getUserByPhone(phone);
  if (account) {
    return account.type === "client"
      ? { status: 409, error: "این شماره سالن یا آرتیست نیست؛ یکی دیگه رو انتخاب کن.", code: "CLIENT_NUMBER" }
      : { status: 409, error: "این سالن الان نوبت نمی‌گیره؛ یکی دیگه رو انتخاب کن.", code: "NOT_TAKING" };
  }

  const added = await requests.addContactRequest({
    clientUserId: client.id,
    phone,
    contactName: clean(body.contactName, MAX_CONTACT_NAME),
    service,
    serviceEmoji: isBeautyEmojiId(body.serviceEmoji) ? String(body.serviceEmoji) : "",
    bookingDate,
    time
  });
  if (!added.ok) return { status: 409, error: added.message, code: added.code };
  let sms = added.request.sms_status || "joined";
  if (added.sendSms) {
    sms = await textTheNumber(added.request, client);
    await requests.setSmsStatus(added.request.id, sms);
  }
  if (!added.duplicate) noteAdminEvent("bookings", `${client.name || "مشتری"} از مخاطب‌ها: ${service}`);
  return { status: added.duplicate ? 200 : 201, data: { request: forClient({ ...added.request, sms_status: sms }), sms } };
}

async function textTheNumber(request, client) {
  if (!templateConfigured("contact_request")) return "off";
  const values = {
    who: safeFirstName(client.name),
    service: request.service,
    day: smsDayLabel(request.booking_date),
    time: shortClock(request.time),
    code: request.code
  };
  const result = await sendTemplateSms(request.phone, "contact_request", values);
  return result.ok ? "sent" : result.skipped ? "off" : "failed";
}

/**
 * A row as its client sees it. The link is only there when frfro could not text it (SMS not set up, or it failed):
 * then the client sends it from their own phone.
 */
export function forClient(row) {
  const ownSms = row.status === "waiting" && (row.sms_status === "off" || row.sms_status === "failed");
  return {
    id: Number(row.id),
    contactName: row.contact_name || "",
    phoneEnd: String(row.phone || "").slice(-4),
    service: row.service,
    serviceEmoji: row.service_emoji || "",
    bookingDate: row.booking_date,
    time: row.time,
    status: row.status,
    sms: row.sms_status || "",
    createdAt: row.created_at,
    ...(ownSms ? { link: `${getSiteUrl()}/r/${row.code}` } : {})
  };
}

/**
 * A salon or artist account now exists for `phone` (a sign-up with that number proven, or the link's code): the
 * waiting requests (`ids`: only those) become booking requests in it, and each client hears about it. `newAccount`:
 * the account was just made, so the requested services are put on its empty menu. Never throws.
 */
export async function deliverWaitingRequests(business, phone, { ids = null, newAccount = false } = {}) {
  try {
    const handed = await requests.deliverToBusiness(business, phone, { ids });
    if (newAccount) await addMissingServices(business, handed.map(({ request }) => request));
    for (const { request } of handed) {
      void quiet(sendPushToUser(Number(request.client_user_id), {
        title: `${business.name || "سالنت"} اومد توی فرفرو`,
        body: `درخواستت برای ${request.service}، ${bookingWhen(request.booking_date, request.time)} بهش رسید. جواب که داد، خبرت می‌کنیم.`,
        url: "/"
      }));
    }
    return handed.length;
  } catch (error) {
    console.error(error);
    return 0;
  }
}

/**
 * A new account's menu is empty: each requested service that is not there yet is added (an hour, no price; the place
 * edits it like any service). An older account's menu is left alone; such a request can still be accepted
 * (salons/bookings/update.js, cameFromContactRequest).
 */
async function addMissingServices(business, rows) {
  if (!rows.length) return;
  const isSalon = business.type === "salon";
  const menu = isSalon ? await listSalonServices(business.id) : await listArtistServices(business.id);
  const names = new Set(menu.map((item) => String(item.name || "").trim()));
  for (const row of rows) {
    const name = String(row.service || "").trim();
    if (!name || names.has(name)) continue;
    names.add(name);
    const data = { name, duration: "60 دقیقه", emoji: row.service_emoji || "" };
    await (isSalon ? addSalonService(business.id, data) : addArtistService(business.id, data));
  }
}

const NEW_ACCOUNT_MS = 24 * 3600_000;

/**
 * A signed-in salon or artist with a link's code (opened the link signed in, or signed up with another number).
 * { status, count } or { status, error }.
 */
export async function deliverByCode(business, code, { justMade = false } = {}) {
  const scope = await requests.claimScope(code, business.id);
  if (!scope) return { status: 404, error: "این لینک دیگه کار نمی‌کنه." };
  if (scope.done) return { status: 200, count: 0 };
  const blocked = await onlineBookingBlock(business.id, business.type === "artist" ? "artist" : "salon");
  if (blocked) return { status: 403, error: "اشتراکت تموم شده؛ اول از تنظیمات تمدیدش کن تا درخواست‌ها بیان." };
  const made = new Date(business.created_at || 0).getTime();
  const newAccount = justMade || (Number.isFinite(made) && Date.now() - made < NEW_ACCOUNT_MS);
  return { status: 200, count: await deliverWaitingRequests(business, scope.phone, { ids: scope.ids || null, newAccount }) };
}

/** «دیگه پیام نده»: each waiting client is told, softly, to pick someone else. */
export async function optOut(code) {
  const declined = await requests.optOutByCode(code);
  if (!declined) return false;
  // Only that number's own messages: a request the client sent from their own phone is just declined.
  for (const row of declined) {
    void quiet(sendPushToUser(Number(row.client_user_id), {
      title: `${row.contact_name || "سالنت"} نتونست`,
      body: `درخواستت برای ${row.service} جواب نگرفت. یکی دیگه رو انتخاب کن.`,
      url: "/"
    }));
  }
  return true;
}

/** The expire-bookings cron: requests nobody signed up for, closed three hours before their time. */
export async function sweepContactRequests() {
  const closed = await requests.expireDueRequests();
  for (const row of closed) {
    void quiet(sendPushToUser(Number(row.client_user_id), {
      title: `${row.contact_name || "سالنت"} جواب نداد`,
      body: `درخواستت برای ${row.service} بی‌جواب موند. یکی دیگه رو انتخاب کن.`,
      url: "/"
    }));
  }
  return closed.length;
}

