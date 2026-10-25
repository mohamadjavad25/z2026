import { getDb, all, get, run } from "./db/connection.js";
import * as salons from "./db/repos/salons.js";
import { onlineBookingBlock } from "./billing/access.js";
import { salonVisitParts } from "./salonVisitParts.js";
import { visitSlotProblem } from "./visitSlotRules.js";
import { createSalonBooking } from "./salonBookingCreate.js";
import { createArtistBooking } from "./artistBookingCreate.js";
import * as artists from "./db/repos/artists.js";
import * as userSettings from "./db/repos/userSettings.js";
import { matchServiceNames } from "../shared/lib/serviceMatch.js";
import { parseBookingParts, summarizeBookingParts } from "../shared/lib/bookingParts.js";
import { BOOKING_REQUEST_WINDOW_MINUTES, isTooSoonToRequest } from "../shared/lib/bookingWindow.js";
import { isSlotInPast } from "../shared/lib/slots.js";
import { parseServiceDurationMinutes } from "../shared/lib/time.js";

/**
 * The backup salon of a booking request (user's decision 2026-10-18): a client who gives a salon only
 * an hour may pick one of the salons they follow that also does every service they asked for. If the
 * hour runs out unanswered, the expiry sweep sends the same request (same services, day and time) to
 * that salon, through the same checks as a new request. Only salons the client follows are ever
 * offered or accepted, and only ones that list all the services. A request made straight to an
 * independent artist works the same way with a backup artist (the lower half of this file).
 */

const MAX_FOLLOWED = 30;
const MAX_OFFERED = 4;

/** The service names a booking request asks for, in visit order. */
export function requestedServiceNames(body, data) {
  const parts = Array.isArray(data?.parts) ? data.parts : [];
  if (parts.length >= 2) return parts.map((part) => String(part?.service || "").trim()).filter(Boolean);
  const service = String(body?.service || data?.service || "").trim();
  return service ? [service] : [];
}

/** Salons `clientUserId` follows (newest follow first), except `exceptSalonUserId`. */
async function followedSalons(clientUserId, exceptSalonUserId, onlyId = null) {
  const db = await getDb();
  return all(db, `
    SELECT s.user_id AS id, s.name, s.area, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS has_avatar
    FROM follows f
    JOIN salons s ON s.user_id = f.target_user_id
    JOIN users u ON u.id = s.user_id
    WHERE f.follower_user_id = $1 AND s.user_id <> $2 AND u.suspended_at IS NULL
      AND ($3::int IS NULL OR s.user_id = $3::int)
    ORDER BY f.created_at DESC
    LIMIT ${MAX_FOLLOWED}
  `, [clientUserId, exceptSalonUserId, onlyId]);
}

/** The salon's own names for `names` when it lists them all and takes online requests; else null. */
async function salonServicesFor(salonUserId, names) {
  if (await onlineBookingBlock(salonUserId, "salon")) return null;
  return matchServiceNames(await salons.listSalonServices(salonUserId), names);
}

/** Whether `salonUserId` could take this visit at that day and time right now (same checks as a client's request). */
async function freeAt(salonUserId, ownNames, bookingDateKey, time) {
  const services = await salons.listSalonServices(salonUserId);
  const parts = salonVisitParts({ services }, ownNames.map((service) => ({ service })));
  const { durationMinutes } = summarizeBookingParts(parts);
  const problem = visitSlotProblem({ hours: await salons.listSalonHours(salonUserId), bookingDateKey, time, durationMinutes, isClient: true });
  if (problem) return false;
  const feasible = await salons.listFeasibleVisitTimes(salonUserId, bookingDateKey, parts, [time]);
  return feasible.length > 0;
}

/**
 * The backup salons to offer for a request at `salonUserId`: followed by the client, listing every
 * service, taking online requests and (when day and time are given) free at that time now.
 * → [{ id, name, area, avatar }], at most a few.
 */
export async function listFallbackSalons({ clientUserId, salonUserId, names, bookingDateKey = "", time = "" }) {
  if (!clientUserId || !names.length) return [];
  const out = [];
  for (const salon of await followedSalons(clientUserId, salonUserId)) {
    const own = await salonServicesFor(salon.id, names);
    if (!own) continue;
    if (bookingDateKey && time && !(await freeAt(salon.id, own, bookingDateKey, time))) continue;
    out.push({ id: salon.id, name: salon.name || "سالن", area: salon.area || "", avatar: salon.has_avatar ? `/api/media/avatar/${salon.id}` : "" });
    if (out.length >= MAX_OFFERED) break;
  }
  return out;
}

/** `fallbackId` when the client may name it as the backup for this request, else null. */
export async function validFallbackSalon(clientUserId, salonUserId, fallbackId, names) {
  if (!fallbackId || fallbackId === salonUserId || !names.length) return null;
  const [salon] = await followedSalons(clientUserId, salonUserId, fallbackId);
  if (!salon) return null;
  return (await salonServicesFor(fallbackId, names)) ? fallbackId : null;
}

/**
 * Sends an expired request (a salon_bookings row) to its backup salon as a new request: same client,
 * services, day and time, an hour to answer and no further backup. The new row remembers where it came
 * from and the old row where it went. → { ok, booking?, salonName?, linkedArtistIds? }.
 */
export async function sendToFallbackSalon(row) {
  const fallbackId = Number(row.fallback_salon_user_id || 0);
  const clientUserId = Number(row.client_user_id || 0);
  if (!fallbackId || !clientUserId) return { ok: false };
  const parts = parseBookingParts(row.parts);
  const names = parts.length >= 2 ? parts.map((part) => part.service) : [String(row.service || "").trim()];
  // Still followed and still doing every service: the client's choice holds only while it is true.
  if (!(await validFallbackSalon(clientUserId, Number(row.salon_user_id || 0), fallbackId, names))) return { ok: false };
  const own = await salonServicesFor(fallbackId, names);
  if (!own) return { ok: false };
  const db = await getDb();
  const user = await get(db, "SELECT id, name, phone, type FROM users WHERE id = $1 AND suspended_at IS NULL", [clientUserId]);
  if (!user || user.type !== "client") return { ok: false };
  const body = {
    client: row.client || user.name || "",
    phone: row.phone || user.phone || "",
    service: own.length === 1 ? own[0] : "",
    bookingDate: row.booking_date,
    time: row.time
  };
  const data = own.length >= 2 ? { parts: own.map((service) => ({ service })) } : {};
  const result = await createSalonBooking({
    actor: { type: "client", id: user.id, name: user.name, phone: user.phone },
    salonUserId: fallbackId,
    body,
    data,
    wait: { minutes: BOOKING_REQUEST_WINDOW_MINUTES, fallbackSalonUserId: null, movedFromBookingId: Number(row.id) }
  });
  if (!result.ok) return { ok: false };
  await run(db, "UPDATE salon_bookings SET moved_to_booking_id = $1 WHERE id = $2", [Number(result.booking.id), Number(row.id)]);
  const salon = await get(db, "SELECT name FROM salons WHERE user_id = $1", [fallbackId]);
  return { ok: true, booking: result.booking, salonName: salon?.name || "سالن", linkedArtistIds: result.linkedArtistIds };
}

/* ── Backup artist, for a request made straight to an independent artist ── */

/** Artists `clientUserId` follows (newest follow first), except `exceptArtistUserId`. */
async function followedArtists(clientUserId, exceptArtistUserId, onlyId = null) {
  const db = await getDb();
  return all(db, `
    SELECT u.id, u.name, u.area, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS has_avatar
    FROM follows f
    JOIN users u ON u.id = f.target_user_id
    WHERE f.follower_user_id = $1 AND u.type = 'artist' AND u.id <> $2 AND u.suspended_at IS NULL
      AND ($3::int IS NULL OR u.id = $3::int)
    ORDER BY f.created_at DESC
    LIMIT ${MAX_FOLLOWED}
  `, [clientUserId, exceptArtistUserId, onlyId]);
}

/**
 * The artist's own listings for `service` when they take direct online requests now; else null. A visit of
 * several services (names joined with « + », shared/lib/serviceBundle) needs every one of them listed.
 */
async function artistServicesFor(artistUserId, service) {
  const settings = await userSettings.getSettings(artistUserId);
  if (settings.vacationMode || settings.directBooking === false) return null;
  if (await onlineBookingBlock(artistUserId, "artist")) return null;
  const list = await artists.listArtistServices(artistUserId);
  const text = String(service || "").trim();
  const exact = matchServiceNames(list, [text]);
  const names = exact ? [text] : text.split(" + ").map((name) => name.trim()).filter(Boolean);
  const own = exact || (names.length >= 2 ? matchServiceNames(list, names) : null);
  if (!own) return null;
  const listed = own.map((name) => list.find((item) => String(item.name || "").trim() === name)).filter(Boolean);
  return listed.length === own.length ? listed : null;
}

/** Whether the artist's calendar is free for those services at that day and time (same checks as a request). */
async function artistFreeAt(artistUserId, listed, bookingDateKey, time) {
  if (isSlotInPast(bookingDateKey, time) || isTooSoonToRequest(bookingDateKey, time)) return false;
  const minutes = listed.reduce((sum, item) => sum + (parseServiceDurationMinutes(item.duration) || 60), 0);
  return !(await artists.isArtistSlotBlocked(artistUserId, bookingDateKey, time, minutes));
}

/**
 * The backup artists to offer for a request to `artistUserId`: followed by the client, doing the same
 * service, taking direct requests and free at that day and time now. → [{ id, name, area, avatar }].
 */
export async function listFallbackArtists({ clientUserId, artistUserId, service, bookingDateKey = "", time = "" }) {
  if (!clientUserId || !service) return [];
  const out = [];
  for (const artist of await followedArtists(clientUserId, artistUserId)) {
    const listed = await artistServicesFor(artist.id, service);
    if (!listed) continue;
    if (bookingDateKey && time && !(await artistFreeAt(artist.id, listed, bookingDateKey, time))) continue;
    out.push({ id: artist.id, name: artist.name || "آرتیست", area: artist.area || "", avatar: artist.has_avatar ? `/api/media/avatar/${artist.id}` : "" });
    if (out.length >= MAX_OFFERED) break;
  }
  return out;
}

/** `fallbackId` when the client may name it as the backup artist for this request, else null. */
export async function validFallbackArtist(clientUserId, artistUserId, fallbackId, service) {
  if (!fallbackId || fallbackId === artistUserId || !String(service || "").trim()) return null;
  const [artist] = await followedArtists(clientUserId, artistUserId, fallbackId);
  if (!artist) return null;
  return (await artistServicesFor(fallbackId, service)) ? fallbackId : null;
}

/**
 * Sends an expired direct request (an artist_bookings row) to its backup artist as a new request: same
 * client, service, day and time, an hour to answer and no further backup. → { ok, booking?, name? }.
 */
export async function sendToFallbackArtist(row) {
  const fallbackId = Number(row.fallback_artist_user_id || 0);
  const clientUserId = Number(row.client_user_id || 0);
  if (!fallbackId || !clientUserId) return { ok: false };
  if (!(await validFallbackArtist(clientUserId, Number(row.artist_user_id || 0), fallbackId, row.service))) return { ok: false };
  const listed = await artistServicesFor(fallbackId, row.service);
  if (!listed) return { ok: false };
  const db = await getDb();
  const user = await get(db, "SELECT id, name, phone, type FROM users WHERE id = $1 AND suspended_at IS NULL", [clientUserId]);
  if (!user || user.type !== "client") return { ok: false };
  const result = await createArtistBooking({
    artistUserId: fallbackId,
    viewer: user,
    data: {
      service: listed.map((item) => item.name).join(" + "),
      ...(listed.length >= 2 ? { parts: listed.map((item) => ({ service: item.name })) } : {}),
      bookingDate: row.booking_date,
      time: row.time
    },
    body: { clientName: row.client_name || user.name || "", clientPhone: row.client_phone || user.phone || "" },
    wait: { minutes: BOOKING_REQUEST_WINDOW_MINUTES, fallbackArtistUserId: null, movedFromBookingId: Number(row.id) }
  });
  if (!result.ok) return { ok: false };
  await run(db, "UPDATE artist_bookings SET moved_to_booking_id = $1 WHERE id = $2", [Number(result.booking.id), Number(row.id)]);
  const artist = await get(db, "SELECT name FROM users WHERE id = $1", [fallbackId]);
  return { ok: true, booking: result.booking, name: artist?.name || "آرتیست" };
}
