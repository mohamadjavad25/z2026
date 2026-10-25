import { getDb, all, get, run } from "../connection.js";
import { defaultHours } from "./salons/common.js";
import { PLACE_FALLBACKS, pickPlace, placeNote } from "../../../shared/lib/artistPlace.js";

/**
 * Where the clients of an artist on salon teams are received (owner's idea of 2026-10-24, rules in
 * shared/lib/artistPlace.js). The artist's ordered list lives in artist_place_order, what happens when no salon can take
 * a booking in artist_place_settings.fallback (no row = 'own', as before the feature), the salon's switch in
 * salon_staff.direct_allowed, and a booking remembers its place in artist_bookings.place_salon_user_id.
 */

const LIVE_AT_SALON = ["تازه", "درخواست", "تایید", "تایید شده", "در انتظار مشتری"];
const SALON_LIVE_NOT = ["لغو", "منقضی شده"];

/** The salon's weekly hours without creating any (a visit must not write); the default week when it never set them. */
async function readSalonHours(salonUserId, db) {
  const rows = await all(db, "SELECT day, open_time, close_time, capacity, active FROM salon_hours WHERE salon_user_id = $1", [salonUserId]);
  return rows.length ? rows : defaultHours.map(({ day, open_time, close_time, capacity, active }) => ({ day, open_time, close_time, capacity, active }));
}

/** The salons the artist is a team member of (the manager's own row is never an artist), newest first. */
async function memberTeams(artistUserId, db) {
  return all(db, `
    SELECT st.salon_user_id, st.state, st.direct_allowed,
      COALESCE(NULLIF(s.name, ''), su.name) AS salon_name, su.area
    FROM salon_staff st
    JOIN users su ON su.id = st.salon_user_id
    LEFT JOIN salons s ON s.user_id = st.salon_user_id
    WHERE st.artist_user_id = $1 AND NOT st.is_owner
    ORDER BY st.id DESC
  `, [artistUserId]);
}

/**
 * The artist's list for their own screen: the salons they are on the team of, those in the list first (in order), then the
 * rest to add. → { teams: [{ salonId, name, area, inList, position, allowed, state, note }], fallback }; `teams` is empty
 * for an artist on no team.
 */
export async function getArtistPlaces(artistUserId, runner = null) {
  const db = runner || (await getDb());
  const [teams, order, settings] = await Promise.all([
    memberTeams(artistUserId, db),
    all(db, "SELECT salon_user_id, position FROM artist_place_order WHERE artist_user_id = $1 ORDER BY position, salon_user_id", [artistUserId]),
    get(db, "SELECT fallback FROM artist_place_settings WHERE artist_user_id = $1", [artistUserId])
  ]);
  const position = new Map(order.map((row, index) => [Number(row.salon_user_id), index]));
  const rows = teams.map((team) => {
    const salonId = Number(team.salon_user_id);
    const state = team.state || "فعال";
    const allowed = team.direct_allowed !== false;
    return {
      salonId,
      name: team.salon_name || "سالن",
      area: team.area || "",
      inList: position.has(salonId),
      position: position.has(salonId) ? position.get(salonId) : null,
      allowed,
      state,
      note: placeNote({ state, allowed }, team.salon_name || "سالن")
    };
  });
  rows.sort((a, b) => (a.inList === b.inList ? (a.inList ? a.position - b.position : 0) : a.inList ? -1 : 1));
  return { teams: rows, fallback: settings?.fallback === "ask" ? "ask" : "own" };
}

/**
 * Saves the list: `order` is the salon ids in the order the artist wants (only salons they are on the team of; others are
 * ignored) and `fallback` what happens when none can take a booking. → { ok: true } or { ok: false, status, error, code }.
 */
export async function saveArtistPlaces(artistUserId, { order, fallback }) {
  const db = await getDb();
  if (!Array.isArray(order) || order.length > 20) return { ok: false, status: 400, error: "فهرست سالن‌ها درست نیست.", code: "BAD_ORDER" };
  if (!PLACE_FALLBACKS.includes(fallback)) return { ok: false, status: 400, error: "یکی از دو راه آخر فهرست رو انتخاب کن.", code: "BAD_FALLBACK" };
  const member = new Set((await memberTeams(artistUserId, db)).map((team) => Number(team.salon_user_id)));
  const ids = [...new Set(order.map(Number))];
  if (ids.some((id) => !member.has(id))) return { ok: false, status: 404, error: "تو عضو تیم یکی از این سالن‌ها نیستی.", code: "NOT_MEMBER" };
  await run(db, "DELETE FROM artist_place_order WHERE artist_user_id = $1", [artistUserId]);
  for (const [position, salonUserId] of ids.entries()) {
    await run(db, "INSERT INTO artist_place_order (artist_user_id, salon_user_id, position) VALUES ($1, $2, $3)", [artistUserId, salonUserId, position]);
  }
  await run(db, `
    INSERT INTO artist_place_settings (artist_user_id, fallback, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (artist_user_id) DO UPDATE SET fallback = excluded.fallback, updated_at = excluded.updated_at
  `, [artistUserId, fallback]);
  return { ok: true };
}

/** How many bookings a salon already holds on a date: its own and the direct ones its artists hold there. */
async function usedOn(salonUserId, dateKey, db) {
  const [own, direct] = await Promise.all([
    get(db, "SELECT COUNT(*)::int AS n FROM salon_bookings WHERE salon_user_id = $1 AND booking_date = $2 AND NOT (status = ANY($3))", [salonUserId, dateKey, SALON_LIVE_NOT]),
    get(db, "SELECT COUNT(*)::int AS n FROM artist_bookings WHERE place_salon_user_id = $1 AND source_salon_user_id IS NULL AND booking_date = $2 AND NOT (status = ANY($3))", [salonUserId, dateKey, SALON_LIVE_NOT])
  ]);
  return Number(own?.n || 0) + Number(direct?.n || 0);
}

/**
 * Where a new booking goes: the first salon in the artist's list that can take it, else the fallback.
 * → { salonUserId, salonName, ask } with salonUserId null = «مثل قبل»; `ask` is true when no salon could and the artist
 * wants to say where themselves (the booking then waits for their answer).
 */
export async function placeForBooking(artistUserId, { dateKey, time, minutes = 60 }, runner = null) {
  const db = runner || (await getDb());
  const places = await getArtistPlaces(artistUserId, db);
  const listed = places.teams.filter((team) => team.inList);
  if (!listed.length) return { salonUserId: null, salonName: "", ask: false };
  const candidates = [];
  for (const team of listed) {
    candidates.push({
      salonUserId: team.salonId,
      salonName: team.name,
      state: team.state,
      allowed: team.allowed,
      hours: await readSalonHours(team.salonId, db),
      used: await usedOn(team.salonId, dateKey, db)
    });
  }
  const chosen = pickPlace(candidates, { dateKey, time, minutes });
  if (chosen) return { salonUserId: chosen.salonUserId, salonName: chosen.salonName, ask: false };
  return { salonUserId: null, salonName: "", ask: places.fallback === "ask" };
}

/** The salons a booking can be moved to by its artist: the ones they are on the team of and that have not closed direct bookings. */
export async function movablePlaces(artistUserId, runner = null) {
  const db = runner || (await getDb());
  return (await memberTeams(artistUserId, db)).filter((team) => team.direct_allowed !== false && !["غیرفعال", "مرخصی"].includes(team.state));
}

/** The artist leaves a salon or is removed: it goes out of their list. */
export async function forgetArtistPlace(artistUserId, salonUserId, runner = null) {
  const db = runner || (await getDb());
  await run(db, "DELETE FROM artist_place_order WHERE artist_user_id = $1 AND salon_user_id = $2", [artistUserId, salonUserId]);
  await run(db, "DELETE FROM artist_place_prefs WHERE artist_user_id = $1 AND salon_user_id = $2", [artistUserId, salonUserId]);
}

/** The salon's own switch for one member. */
export async function setDirectAllowed(salonUserId, staffId, allowed) {
  const db = await getDb();
  const result = await run(db, `
    UPDATE salon_staff SET direct_allowed = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND salon_user_id = $3 AND NOT is_owner
  `, [Boolean(allowed), staffId, salonUserId]);
  return result.rowCount > 0;
}

/**
 * What the salon sees about the clients its members bring: per member (by artist account) the bookings held at this
 * salon from today on, how many different people booked this month and how many of those are connected to the salon.
 * Never the clients' names or numbers.
 */
export async function directVisitStats(salonUserId, monthPrefix, runner = null) {
  const db = runner || (await getDb());
  const rows = await all(db, `
    SELECT b.artist_user_id,
      COUNT(*) FILTER (WHERE b.status = ANY($2)) AS live,
      COUNT(DISTINCT b.client_user_id) FILTER (WHERE b.client_user_id IS NOT NULL AND b.booking_date LIKE $3 AND b.status <> 'لغو') AS clients_this_month,
      COUNT(DISTINCT b.client_user_id) FILTER (WHERE b.client_user_id IS NOT NULL AND b.booking_date LIKE $3 AND b.status <> 'لغو'
        AND EXISTS (SELECT 1 FROM follows f WHERE f.follower_user_id = b.client_user_id AND f.target_user_id = $1)) AS connected
    FROM artist_bookings b
    WHERE b.place_salon_user_id = $1 AND b.source_salon_user_id IS NULL
    GROUP BY b.artist_user_id
  `, [salonUserId, LIVE_AT_SALON, `${monthPrefix}%`]);
  const byArtist = new Map();
  for (const row of rows) {
    byArtist.set(Number(row.artist_user_id), {
      live: Number(row.live) || 0,
      clientsThisMonth: Number(row.clients_this_month) || 0,
      connected: Number(row.connected) || 0
    });
  }
  return byArtist;
}

/** The direct visits held at this salon that are still ahead, newest first: when and how long, never who. */
export async function listDirectVisits(salonUserId, runner = null) {
  const db = runner || (await getDb());
  return all(db, `
    SELECT b.id, b.artist_user_id, b.booking_date, b.time, b.duration_minutes, b.status, b.service,
      COALESCE(NULLIF(st.name, ''), u.name) AS artist_name
    FROM artist_bookings b
    JOIN users u ON u.id = b.artist_user_id
    LEFT JOIN salon_staff st ON st.salon_user_id = $1 AND st.artist_user_id = b.artist_user_id
    WHERE b.place_salon_user_id = $1 AND b.source_salon_user_id IS NULL AND b.status = ANY($2)
    ORDER BY b.booking_date, b.time
  `, [salonUserId, LIVE_AT_SALON]);
}

/**
 * Takes direct bookings back from a salon: the salon's place on them is cleared, so they are held «مثل قبل» from now on
 * (nothing is cancelled). Only live bookings; `artistUserId` null = every artist of that salon. Returns what moved, with
 * the names to tell the clients.
 */
export async function releasePlacedBookings(salonUserId, artistUserId = null, runner = null) {
  const db = runner || (await getDb());
  return all(db, `
    UPDATE artist_bookings b SET place_salon_user_id = NULL
    FROM users au
    WHERE b.place_salon_user_id = $1 AND b.source_salon_user_id IS NULL AND b.status = ANY($2)
      AND ($3::int IS NULL OR b.artist_user_id = $3) AND au.id = b.artist_user_id
    RETURNING b.id, b.client_user_id, b.service, b.booking_date, b.time, au.name AS artist_name
  `, [salonUserId, LIVE_AT_SALON, artistUserId]);
}

/**
 * The artist moves one of their own live bookings to one of their salons, or back to «مثل قبل» (salonUserId null).
 * → { ok, booking?: row before the move, changed } or { ok: false, status, error }.
 */
export async function moveBookingPlace(artistUserId, bookingId, salonUserId, runner = null) {
  const db = runner || (await getDb());
  const booking = await get(db, `
    SELECT b.id, b.client_user_id, b.service, b.booking_date, b.time, b.status, b.place_salon_user_id
    FROM artist_bookings b WHERE b.id = $1 AND b.artist_user_id = $2 AND b.source_salon_user_id IS NULL
  `, [bookingId, artistUserId]);
  if (!booking) return { ok: false, status: 404, error: "این نوبت رو پیدا نکردیم." };
  if (!LIVE_AT_SALON.includes(booking.status)) return { ok: false, status: 409, error: "این نوبت تموم شده؛ جاش رو نمی‌شه عوض کرد." };
  const target = Number(salonUserId || 0) || null;
  if (target && !(await movablePlaces(artistUserId, db)).some((team) => Number(team.salon_user_id) === target)) {
    return { ok: false, status: 409, error: "این سالن نوبت مستقیم رو قبول نمی‌کنه.", code: "SALON_BLOCKED" };
  }
  const changed = Number(booking.place_salon_user_id || 0) !== Number(target || 0);
  if (changed) await run(db, "UPDATE artist_bookings SET place_salon_user_id = $1 WHERE id = $2", [target, bookingId]);
  return { ok: true, booking, changed };
}
