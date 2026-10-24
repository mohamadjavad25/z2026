import { getDb, all, get, run } from "../connection.js";
import { listArtistHours, listArtistHoursPublic } from "./artists/hours.js";
import { defaultHours } from "./salons/common.js";
import { publicLocation } from "../../location.js";
import {
  DEFAULT_PLACE_DAYS,
  PLACE_MODES,
  isPlaceDays,
  placeOfDay,
  placeWeekdayIndex,
  plannedPlaces,
  resolveWeek
} from "../../../shared/lib/artistPlace.js";

/**
 * Where the clients of an artist on a salon team are received (owner's idea of 2026-10-24, rules in
 * shared/lib/artistPlace.js). The artist's choice lives in artist_place_prefs (no row = their own place, as before), the
 * salon's switch in salon_staff.direct_allowed, and a booking remembers its place in artist_bookings.place_salon_user_id.
 */

/** The salon's weekly hours without creating any (a visit must not write); the default week when it never set them. */
async function readSalonHours(salonUserId, db) {
  const rows = await all(db, "SELECT day, open_time, close_time, active FROM salon_hours WHERE salon_user_id = $1", [salonUserId]);
  return rows.length ? rows : defaultHours.map(({ day, open_time, close_time, active }) => ({ day, open_time, close_time, active }));
}

/**
 * The salon an artist's direct bookings can be received at: the one they chose, else the newest team they are on.
 * null when they are on no team (an independent artist). The manager's own row is never an artist.
 */
export async function getArtistTeamPlace(artistUserId, runner = null) {
  const db = runner || (await getDb());
  const teams = await all(db, `
    SELECT st.id AS staff_id, st.salon_user_id, st.state, st.direct_allowed,
      COALESCE(NULLIF(s.name, ''), su.name) AS salon_name, su.area, su.address_detail, su.geo_lat, su.geo_lng,
      (su.avatar <> '' OR su.avatar_url IS NOT NULL) AS salon_avatar
    FROM salon_staff st
    JOIN users su ON su.id = st.salon_user_id
    LEFT JOIN salons s ON s.user_id = st.salon_user_id
    WHERE st.artist_user_id = $1 AND NOT st.is_owner
    ORDER BY st.id DESC
  `, [artistUserId]);
  if (!teams.length) return null;
  const pref = await get(db, "SELECT salon_user_id, mode, days FROM artist_place_prefs WHERE artist_user_id = $1", [artistUserId]);
  const team = teams.find((item) => Number(item.salon_user_id) === Number(pref?.salon_user_id)) || teams[0];
  const chosen = pref && Number(pref.salon_user_id) === Number(team.salon_user_id);
  return {
    salonUserId: Number(team.salon_user_id),
    staffId: Number(team.staff_id),
    salonName: team.salon_name || "سالن",
    salonArea: team.area || "",
    salonAvatar: team.salon_avatar ? `/api/media/avatar/${team.salon_user_id}` : "",
    location: publicLocation(team),
    state: team.state || "فعال",
    allowed: team.direct_allowed !== false,
    mode: chosen ? pref.mode : "own",
    days: chosen ? pref.days : DEFAULT_PLACE_DAYS,
    teamCount: teams.length
  };
}

/**
 * The artist's week as a client meets it: the team, the choice and, for each weekday, its place and the hours that can
 * be booked there. `hours` replaces the artist's own hours on the public page (same shape as listArtistHoursPublic).
 * `publicRead`: never creates default rows. → { team: null, week: null, hours } for an independent artist.
 */
export async function resolveArtistPlaces(artistUserId, { runner = null, publicRead = false } = {}) {
  const db = runner || (await getDb());
  const artistHours = publicRead ? await listArtistHoursPublic(artistUserId, db) : await listArtistHours(artistUserId, db);
  const team = await getArtistTeamPlace(artistUserId, db);
  if (!team || team.mode === "own") return { team, week: null, hours: artistHours, planned: plannedPlaces("own") };
  const week = resolveWeek({
    mode: team.mode,
    days: team.days,
    artistHours,
    salonHours: await readSalonHours(team.salonUserId, db),
    allowed: team.allowed,
    state: team.state
  });
  const planned = plannedPlaces(team.mode, team.days);
  return { team, week, planned, hours: week.map(({ day, open_time, close_time, active }) => ({ day, open_time, close_time, active })) };
}

/** The place of one date for a client's booking: { kind, row, team, hours, atSalon }; kind 'own' for anyone without a salon day. */
export async function placeForDate(artistUserId, dateKey, { runner = null } = {}) {
  const places = await resolveArtistPlaces(artistUserId, { runner });
  const row = places.week ? placeOfDay(places.week, dateKey) : null;
  // atSalon: the artist chose the salon for this weekday (whether or not the salon can receive them that day).
  return { kind: row?.kind || "own", row, team: places.team, hours: places.hours, atSalon: places.planned[placeWeekdayIndex(dateKey)] === "s" };
}

/**
 * Saves the artist's choice for one salon of theirs. Only a salon they are really on the team of; the choice 'salon' or
 * 'days' with a salon day is refused while that salon has switched direct bookings off for them.
 * → { ok: true } or { ok: false, status, error, code }.
 */
export async function saveArtistPlace(artistUserId, { salonUserId, mode, days }) {
  const db = await getDb();
  if (!PLACE_MODES.includes(mode)) return { ok: false, status: 400, error: "یکی از سه راه رو انتخاب کن.", code: "BAD_MODE" };
  const team = await getArtistTeamPlace(artistUserId, db);
  if (!team || Number(salonUserId || team.salonUserId) !== team.salonUserId) {
    return { ok: false, status: 404, error: "تو عضو تیم این سالن نیستی.", code: "NOT_MEMBER" };
  }
  const cleanDays = mode === "days" ? (isPlaceDays(days) ? days : null) : (mode === "salon" ? "sssssss" : DEFAULT_PLACE_DAYS);
  if (!cleanDays) return { ok: false, status: 400, error: "برای هر روز یکی از «سالن» یا «جای خودم» رو بزن.", code: "BAD_DAYS" };
  const wantsSalon = cleanDays.includes("s");
  if (wantsSalon && !team.allowed) {
    return { ok: false, status: 409, error: `${team.salonName} نوبت مستقیم توی سالن رو بسته. با سالن هماهنگ کن.`, code: "SALON_BLOCKED" };
  }
  await run(db, `
    INSERT INTO artist_place_prefs (artist_user_id, salon_user_id, mode, days, updated_at)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    ON CONFLICT (artist_user_id) DO UPDATE SET
      salon_user_id = excluded.salon_user_id, mode = excluded.mode, days = excluded.days, updated_at = excluded.updated_at
  `, [artistUserId, team.salonUserId, mode, cleanDays]);
  return { ok: true };
}

/** The artist leaves a salon or is removed: their choice for it goes (the next team, if any, starts from their own place). */
export async function forgetArtistPlace(artistUserId, salonUserId, runner = null) {
  const db = runner || (await getDb());
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

const LIVE_AT_SALON = ["تازه", "درخواست", "تایید", "تایید شده", "در انتظار مشتری"];

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
 * Takes direct bookings back from a salon: the salon's place on them is cleared, so they are held at the artist's own place
 * from now on (nothing is cancelled). Only live bookings; `artistUserId` null = every artist of that salon. Returns what
 * moved, with the names to tell the clients.
 */
export async function releasePlacedBookings(salonUserId, artistUserId = null, runner = null) {
  const db = runner || (await getDb());
  const result = await all(db, `
    UPDATE artist_bookings b SET place_salon_user_id = NULL
    FROM users au
    WHERE b.place_salon_user_id = $1 AND b.source_salon_user_id IS NULL AND b.status = ANY($2)
      AND ($3::int IS NULL OR b.artist_user_id = $3) AND au.id = b.artist_user_id
    RETURNING b.id, b.client_user_id, b.service, b.booking_date, b.time, au.name AS artist_name
  `, [salonUserId, LIVE_AT_SALON, artistUserId]);
  return result;
}
