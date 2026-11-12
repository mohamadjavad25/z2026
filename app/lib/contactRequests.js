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

/**
 * A client's request to a salon or artist that is not on frfro yet (owner, 2026-11-12). The rules are in
 * db/repos/contactRequests.js; this file adds the checks on the number, the SMS and who is told what.
 */
const quiet = (promise) => Promise.resolve(promise).catch(() => {});

const MOBILE = /^09\d{9}$/;
const MAX_SERVICE = 80;
const MAX_CONTACT_NAME = 60;

const clean = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

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
  const service = clean(body.service, MAX_SERVICE);
  if (!service) return { status: 400, error: "چه کاری می‌خوای؟ یکی رو انتخاب کن.", code: "NO_SERVICE" };
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
    who: clean(client.name, 40) || "یه مشتری",
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
 * A salon or artist account now exists for `phone` (a sign-up with that number proven, or the link's code): every
 * waiting request becomes a booking request in it, and each client hears about it. Never throws.
 */
export async function deliverWaitingRequests(business, phone) {
  try {
    const handed = await requests.deliverToBusiness(business, phone);
    await addMissingServices(business, handed.map(({ request }) => request));
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
 * A request can only be accepted for a service on the place's own menu, and a new account's menu is empty: each
 * requested service that is not there yet is added (an hour, no price; the place edits it like any service).
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

/** The number from a link's code, for a salon or artist who opened it while signed in or signed up with another number. */
export async function deliverByCode(business, code) {
  const phone = await requests.phoneForCode(code);
  if (!phone) return { ok: false, count: 0 };
  return { ok: true, count: await deliverWaitingRequests(business, phone) };
}

/** «دیگه پیام نده»: each waiting client is told, softly, to pick someone else. */
export async function optOut(code) {
  const declined = await requests.optOutByCode(code);
  if (!declined) return false;
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

