import * as users from "./db/repos/users.js";
import * as artists from "./db/repos/artists.js";
import * as salons from "./db/repos/salons.js";
import { listArtistHoursPublic } from "./db/repos/artists/hours.js";
import { workplaceSchedule } from "./db/repos/artistPlace.js";
import {
  activeWaitlistDays,
  claimWaitlistNotice,
  clearWaitlistSignature,
  clientHasVisitThere,
  deleteWaitlistById,
  upsertWaitlistEntry,
  waitlistEntriesFor
} from "./db/repos/waitlist.js";
import { computeSalonFreeTimes } from "./salonFreeTimes.js";
import { onlineBookingBlock } from "./billing/access.js";
import { sendPushToUser } from "./push.js";
import { bookingWhen, smsWaitlistOpen } from "./bookingSms.js";
import { artistFreeTimes } from "../shared/lib/artistFreeTimes.js";
import { openInAppHref } from "../shared/lib/appHandoff.js";
import { BOOKING_HORIZON_DAYS } from "../shared/lib/bookingWindow.js";
import { MAX_BOOKING_PARTS } from "../shared/lib/bookingParts.js";
import { formatPersianDateKey } from "../shared/lib/persianCalendar.js";
import { timeLabelToMinutes } from "../shared/lib/time.js";

/**
 * «خبرم کن» (owner's decision of 2026-10-27, roadmap ۱۹). A client on a day with no free time for what they want asks
 * to be told when one opens. Whenever something at that place on that day changes (a cancel, a declined or expired
 * request, a moved visit; and every scheduler run, which also catches new working hours), the free times for each
 * waiting client's own services are worked out exactly as the booking form does. When a time is free that was not
 * before, everyone waiting is told at once by push (SMS when the push did not reach the app): first to book gets it.
 */

/** Free start times for these services at this place on this day, or null when the place takes no online bookings. */
export async function waitlistFreeTimes(kind, ownerUserId, bookingDate, services) {
  if (await onlineBookingBlock(ownerUserId, kind)) return null;
  const names = services.map((item) => item.name);
  const minutes = services.map((item) => Number(item.minutes) || 0);
  if (kind === "salon") {
    const outcome = await computeSalonFreeTimes(ownerUserId, bookingDate, names, minutes, true);
    return outcome.error ? null : outcome.data.times;
  }
  const [hours, workplaces, breakTime, bookedSlots] = await Promise.all([
    listArtistHoursPublic(ownerUserId),
    workplaceSchedule(ownerUserId),
    artists.getArtistBreak(ownerUserId),
    artists.listArtistBookedSlots(ownerUserId, { onlyDateKey: bookingDate })
  ]);
  const total = minutes.reduce((sum, value) => sum + value, 0) || 60;
  return artistFreeTimes({ hours, workplaces, breakTime, bookedSlots }, bookingDate, total);
}

const signatureOf = (times) => (times || []).join(",");

/** The services as stored: 1 to MAX_BOOKING_PARTS of { name, minutes }, names trimmed. null when unreadable. */
export function cleanWaitlistServices(raw) {
  const list = (Array.isArray(raw) ? raw : []).map((item) => ({
    name: String(item?.name || "").trim(),
    minutes: Math.max(0, Math.min(24 * 60, Math.round(Number(item?.minutes) || 0)))
  }));
  if (!list.length || list.length > MAX_BOOKING_PARTS) return null;
  if (list.some((item) => !item.name || item.name.length > 120)) return null;
  return list;
}

/**
 * The client asks to be told. Returns { ok: true, entry, freeNow } (freeNow: times already free, so the screen can
 * say "there is one, book it") or { ok: false, error: "owner" | "day" | "services" | "too_many" }.
 */
export async function joinWaitlist({ client, kind, ownerUserId, bookingDate, services }, now = new Date()) {
  const owner = await users.getUserById(Number(ownerUserId));
  if (!owner || owner.type !== kind) return { ok: false, error: "owner" };
  const todayKey = formatPersianDateKey(now);
  const lastKey = formatPersianDateKey(new Date(now.getTime() + BOOKING_HORIZON_DAYS * 24 * 3600 * 1000));
  if (!bookingDate || bookingDate < todayKey || bookingDate > lastKey) return { ok: false, error: "day" };
  const clean = cleanWaitlistServices(services);
  if (!clean) return { ok: false, error: "services" };
  const times = await waitlistFreeTimes(kind, owner.id, bookingDate, clean);
  if (times === null) return { ok: false, error: "owner" };
  const saved = await upsertWaitlistEntry({ clientUserId: client.id, kind, ownerUserId: owner.id, bookingDate, services: clean, freeSignature: signatureOf(times) }, now);
  if (!saved.ok) return saved;
  return { ok: true, entry: saved.entry, freeNow: times };
}

/** Tells everyone waiting at this place on this day whose services now fit a time that was not free before. */
export async function checkWaitlist(kind, ownerUserId, bookingDate) {
  const entries = await waitlistEntriesFor(kind, Number(ownerUserId), bookingDate);
  if (!entries.length) return { told: 0 };
  const owner = await users.getUserById(Number(ownerUserId));
  if (!owner) return { told: 0 };
  const placeName = kind === "salon" ? (await salons.getSalon(owner.id).catch(() => null))?.name || owner.name : owner.name;
  const timesByServices = new Map();
  let told = 0;
  for (const entry of entries) {
    if (await clientHasVisitThere(entry.client_user_id, kind, owner.id, bookingDate)) {
      await deleteWaitlistById(entry.id);
      continue;
    }
    const services = Array.isArray(entry.services) ? entry.services : [];
    const key = JSON.stringify(services);
    if (!timesByServices.has(key)) timesByServices.set(key, await waitlistFreeTimes(kind, owner.id, bookingDate, services).catch(() => null));
    const times = timesByServices.get(key);
    if (!times || !times.length) {
      if (times) await clearWaitlistSignature(entry.id);
      continue;
    }
    const signature = signatureOf(times);
    const before = new Set(String(entry.free_signature || "").split(",").filter(Boolean));
    const fresh = times.filter((time) => !before.has(time));
    if (!fresh.length) continue;
    if (!(await claimWaitlistNotice(entry, signature))) continue;
    const first = [...fresh].sort((a, b) => timeLabelToMinutes(a) - timeLabelToMinutes(b))[0];
    const what = services.map((item) => item.name).join(" + ");
    const push = await sendPushToUser(entry.client_user_id, {
      title: "یه جا خالی شد!",
      body: `${placeName}، ${bookingWhen(bookingDate, first)} برای ${what}. زود بگیرش تا کسی نگرفته.`,
      url: openInAppHref(kind, owner.id),
      ttl: 6 * 3600
    }).catch(() => ({ sent: 0 }));
    smsWaitlistOpen(entry.client_user_id, { providerName: placeName, bookingDate, time: first }, push);
    told += 1;
  }
  return { told };
}

/** Fire-and-forget after anything that may free a time; never throws, never delays the answer. */
export function checkWaitlistSoon(kind, ownerUserId, bookingDate) {
  if (!ownerUserId || !bookingDate) return;
  void checkWaitlist(kind === "artist" ? "artist" : "salon", ownerUserId, bookingDate).catch(() => {});
}

/** The scheduler's pass over every place and day someone is waiting for (also clears the days that are over). */
export async function sweepWaitlist(now = new Date()) {
  const days = await activeWaitlistDays(now);
  let told = 0;
  for (const day of days) {
    const result = await checkWaitlist(day.owner_kind, day.owner_user_id, day.booking_date).catch(() => ({ told: 0 }));
    told += result.told;
  }
  return { days: days.length, told };
}
