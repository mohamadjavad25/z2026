import { getDb, all, get, run, withTransaction } from "../connection.js";
import { defaultHours } from "./salons/common.js";
import { publicLocation } from "../../location.js";
import { dateKeyAfter, salonTimeBlock, workplaceOn } from "../../../shared/lib/artistPlace.js";
import { minutesToStart } from "../../../shared/lib/providerRules.js";

/**
 * Where an artist's own clients are received (owner's decision of 2026-10-25, rules in shared/lib/artistPlace.js): one
 * place at a time, the artist's «محل کار», kept as dated rows in artist_workplace (no row = the artist's own place). The
 * salon's switch is salon_staff.direct_allowed, and a booking remembers its place in artist_bookings.place_salon_user_id.
 * (The ordered-list tables of migrations 047/048 are no longer read.)
 */

const AWAY_STATES = ["غیرفعال", "مرخصی"];
/** How far ahead the artist can set a switch. */
export const MAX_SWITCH_AHEAD_DAYS = 60;

const LIVE_AT_SALON = ["تازه", "درخواست", "تایید", "تایید شده", "در انتظار مشتری"];

/**
 * A booking whose time has come (started or over, even if nobody marked it done) stays where it was held: it already
 * happened there, so no switch of place moves it (owner's decision of 2026-10-26). An unreadable time counts as not yet.
 */
function notStartedYet(booking, now = new Date()) {
  const minutes = minutesToStart(booking.booking_date, booking.time, now);
  return minutes === null || minutes > 0;
}

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

/** A team row, as the place rules read it: can the artist's clients be received there right now? */
const takesClients = (team) => team && team.direct_allowed !== false && !AWAY_STATES.includes(String(team.state || "").trim());

/** The salon's public bits the client and the artist's card need (never the salon's phone). */
async function salonPublic(salonUserId, db) {
  const row = await get(db, `
    SELECT u.id, COALESCE(NULLIF(s.name, ''), u.name) AS name, u.area, u.address_detail, u.geo_lat, u.geo_lng,
      (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS has_avatar, (u.poster <> '' OR u.poster_url IS NOT NULL) AS has_poster, u.poster_position, u.updated_at
    FROM users u LEFT JOIN salons s ON s.user_id = u.id WHERE u.id = $1
  `, [salonUserId]);
  if (!row) return null;
  return {
    id: Number(row.id),
    name: row.name || "سالن",
    area: row.area || "",
    location: publicLocation(row),
    avatar: row.has_avatar ? `/api/media/avatar/${row.id}` : "",
    poster: row.has_poster ? `/api/media/poster/${row.id}?v=${row.updated_at ? new Date(row.updated_at).getTime() : 0}` : "",
    posterPosition: row.poster_position || "",
    hours: await readSalonHours(salonUserId, db)
  };
}

/**
 * The artist's saved rows from today on: the one that holds today (if any) and the ones after it, oldest first.
 * → [{ from, salonUserId }] (salonUserId null = the artist's own place).
 */
async function savedRows(artistUserId, db, todayKey = dateKeyAfter(0)) {
  const rows = await all(db, `
    SELECT starts_on, salon_user_id FROM artist_workplace
    WHERE artist_user_id = $1 AND starts_on >= COALESCE(
      (SELECT MAX(starts_on) FROM artist_workplace WHERE artist_user_id = $1 AND starts_on <= $2), $2)
    ORDER BY starts_on
  `, [artistUserId, todayKey]);
  return rows.map((row) => ({ from: row.starts_on, salonUserId: row.salon_user_id == null ? null : Number(row.salon_user_id) }));
}

/**
 * Where the artist's clients go from today on, as the rules hold it right now: a salon counts only while the artist is
 * on its team, not away and the salon has not closed direct bookings for them; otherwise that stretch is the artist's
 * own place. → [{ from, salon: salonPublic | null }], oldest first (shared/lib/artistPlace.js workplaceOn reads it).
 */
export async function workplaceSchedule(artistUserId, runner = null) {
  const db = runner || (await getDb());
  const [rows, teams] = await Promise.all([savedRows(artistUserId, db), memberTeams(artistUserId, db)]);
  const byId = new Map(teams.map((team) => [Number(team.salon_user_id), team]));
  const cache = new Map();
  const schedule = [];
  for (const row of rows) {
    let salon = null;
    if (row.salonUserId && takesClients(byId.get(row.salonUserId))) {
      if (!cache.has(row.salonUserId)) cache.set(row.salonUserId, await salonPublic(row.salonUserId, db));
      salon = cache.get(row.salonUserId);
    }
    const last = schedule[schedule.length - 1];
    if (last && (last.salon?.id || null) === (salon?.id || null)) continue;
    schedule.push({ from: row.from, salon });
  }
  return schedule;
}

/**
 * What the artist's collab tab shows: the salon they work at now, a switch already set for a later day, and per salon
 * whether it takes their clients and how many of their bookings are there this week.
 * → { current: salonId | null, savedCurrent, next: { from, salonId } | null, teams: [{ salonId, name, allowed, away, weekCount }] }
 * `current` is where clients go today; `savedCurrent` is what the artist chose (differs when that salon closed it).
 */
export async function getArtistWorkplace(artistUserId, runner = null) {
  const db = runner || (await getDb());
  const todayKey = dateKeyAfter(0);
  const [rows, teams, counts] = await Promise.all([
    savedRows(artistUserId, db, todayKey),
    memberTeams(artistUserId, db),
    all(db, `
      SELECT place_salon_user_id AS salon_id, COUNT(*)::int AS n FROM artist_bookings
      WHERE artist_user_id = $1 AND source_salon_user_id IS NULL AND place_salon_user_id IS NOT NULL
        AND booking_date >= $2 AND booking_date <= $3 AND status = ANY($4)
      GROUP BY place_salon_user_id
    `, [artistUserId, todayKey, dateKeyAfter(6), LIVE_AT_SALON])
  ]);
  const holding = rows.filter((row) => row.from <= todayKey).pop() || null;
  const savedCurrent = holding?.salonUserId || null;
  const memberIds = new Set(teams.map((team) => Number(team.salon_user_id)));
  const currentTeam = teams.find((team) => Number(team.salon_user_id) === savedCurrent);
  const later = rows.find((row) => row.from > todayKey && (!row.salonUserId || memberIds.has(row.salonUserId)));
  const countBy = new Map(counts.map((row) => [Number(row.salon_id), Number(row.n) || 0]));
  return {
    current: takesClients(currentTeam) ? savedCurrent : null,
    savedCurrent: currentTeam ? savedCurrent : null,
    next: later ? { from: later.from, salonId: later.salonUserId } : null,
    teams: teams.map((team) => ({
      salonId: Number(team.salon_user_id),
      name: team.salon_name || "سالن",
      allowed: team.direct_allowed !== false,
      away: AWAY_STATES.includes(String(team.state || "").trim()),
      weekCount: countBy.get(Number(team.salon_user_id)) || 0
    }))
  };
}

/**
 * The artist says "from `startsOn` on, my clients come to `salonUserId`" (null = my own place). Every later switch
 * already set is replaced. With `moveBookings`, their live bookings from that day on move there too, except those
 * outside the salon's hours (they stay put and are counted) and those whose time has already come (they stay put, uncounted).
 * → { ok, moved: [rows to tell], kept } or a refusal.
 */
export async function setArtistWorkplace(artistUserId, { salonUserId = null, startsOn, moveBookings = false }) {
  const todayKey = dateKeyAfter(0);
  const lastKey = dateKeyAfter(MAX_SWITCH_AHEAD_DAYS);
  const from = String(startsOn || todayKey);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from < todayKey || from > lastKey) {
    return { ok: false, status: 400, error: "یه روز از امروز تا دو ماه دیگه انتخاب کن.", code: "BAD_DAY" };
  }
  const target = Number(salonUserId || 0) || null;
  return withTransaction(null, async (db) => {
    // One switch at a time per artist: two taps from two phones land one after the other.
    await run(db, "SELECT pg_advisory_xact_lock(51, $1)", [artistUserId]);
    let salon = null;
    if (target) {
      const team = (await memberTeams(artistUserId, db)).find((row) => Number(row.salon_user_id) === target);
      if (!team) return { ok: false, status: 404, error: "تو عضو تیم این سالن نیستی.", code: "NOT_MEMBER" };
      if (team.direct_allowed === false) return { ok: false, status: 409, error: `${team.salon_name || "سالن"} فعلاً مشتری‌های خودت رو قبول نمی‌کنه.`, code: "SALON_BLOCKED" };
      if (AWAY_STATES.includes(String(team.state || "").trim())) return { ok: false, status: 409, error: `توی ${team.salon_name || "سالن"} الان مرخصی یا غیرفعالی.`, code: "AWAY" };
      salon = { id: target, name: team.salon_name || "سالن", hours: await readSalonHours(target, db) };
    }
    await run(db, "DELETE FROM artist_workplace WHERE artist_user_id = $1 AND starts_on >= $2", [artistUserId, from]);
    // Already the place on the day before (a later switch being taken back): nothing to add.
    const before = await get(db, "SELECT salon_user_id FROM artist_workplace WHERE artist_user_id = $1 AND starts_on < $2 ORDER BY starts_on DESC LIMIT 1", [artistUserId, from]);
    const samePlace = before ? Number(before.salon_user_id || 0) === Number(target || 0) : !target;
    if (!samePlace) await run(db, "INSERT INTO artist_workplace (artist_user_id, salon_user_id, starts_on) VALUES ($1, $2, $3)", [artistUserId, target, from]);
    if (!moveBookings) return { ok: true, moved: [], kept: 0 };
    const live = await all(db, `
      SELECT b.id, b.client_user_id, b.service, b.booking_date, b.time, b.duration_minutes, b.status, b.place_salon_user_id
      FROM artist_bookings b
      WHERE b.artist_user_id = $1 AND b.source_salon_user_id IS NULL AND b.booking_date >= $2 AND b.status = ANY($3)
        AND b.place_salon_user_id IS DISTINCT FROM $4
      FOR UPDATE
    `, [artistUserId, from, LIVE_AT_SALON, target]);
    const moved = [];
    let kept = 0;
    for (const booking of live) {
      if (!notStartedYet(booking)) continue;
      if (salon && salonTimeBlock(salon.hours, booking.booking_date, booking.time, booking.duration_minutes || 60)) { kept += 1; continue; }
      await run(db, "UPDATE artist_bookings SET place_salon_user_id = $1 WHERE id = $2", [target, booking.id]);
      moved.push(booking);
    }
    return { ok: true, moved, kept, salonName: salon?.name || "" };
  });
}

/**
 * Where a new booking is held: the artist's workplace on that day. A workplace salon that is closed at that hour refuses
 * the booking (`block`), so a client is never sent to a closed salon. → { salonUserId, salonName, block }.
 */
export async function placeForBooking(artistUserId, { dateKey, time, minutes = 60 }, runner = null) {
  const db = runner || (await getDb());
  const salon = workplaceOn(await workplaceSchedule(artistUserId, db), dateKey);
  if (!salon) return { salonUserId: null, salonName: "", block: "" };
  return { salonUserId: salon.id, salonName: salon.name, block: salonTimeBlock(salon.hours, dateKey, time, minutes) };
}

/** The salons a booking can be moved to by its artist: the ones they are on the team of and that have not closed direct bookings. */
export async function movablePlaces(artistUserId, runner = null) {
  const db = runner || (await getDb());
  return (await memberTeams(artistUserId, db)).filter((team) => team.direct_allowed !== false && !["غیرفعال", "مرخصی"].includes(team.state));
}

/**
 * The artist leaves a salon or is removed: switches to it set for later days are dropped, and if it is where their clients
 * go today, they go to the artist's own place from today on.
 */
export async function forgetArtistPlace(artistUserId, salonUserId, runner = null) {
  const db = runner || (await getDb());
  const todayKey = dateKeyAfter(0);
  const holding = (await savedRows(artistUserId, db, todayKey)).filter((row) => row.from <= todayKey).pop();
  await run(db, "DELETE FROM artist_workplace WHERE artist_user_id = $1 AND salon_user_id = $2 AND starts_on > $3", [artistUserId, salonUserId, todayKey]);
  if (holding?.salonUserId === Number(salonUserId)) {
    await run(db, `
      INSERT INTO artist_workplace (artist_user_id, salon_user_id, starts_on) VALUES ($1, NULL, $2)
      ON CONFLICT (artist_user_id, starts_on) DO UPDATE SET salon_user_id = NULL
    `, [artistUserId, todayKey]);
  }
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

/**
 * What a salon's day list shows about its team's own clients (owner's decision of 2026-10-25), from `fromKey` to `toKey`:
 *  visits  the clients a member receives at this salon from their own page: when, how long, the service and the
 *          client's first name only (never the full name or number until the client connects to the salon);
 *  busy    a member's own clients held elsewhere (their own place or another salon): only when and how long, so the
 *          salon does not give that hour to someone else.
 */
export async function listTeamClientTimes(salonUserId, fromKey, toKey, runner = null) {
  const db = runner || (await getDb());
  const rows = await all(db, `
    SELECT b.id, b.artist_user_id, b.booking_date, b.time, b.duration_minutes, b.status, b.service,
      (b.place_salon_user_id = $1) AS here,
      COALESCE(NULLIF(cu.name, ''), b.client_name, '') AS client_name,
      COALESCE(NULLIF(st.name, ''), u.name) AS artist_name
    FROM salon_staff st
    JOIN artist_bookings b ON b.artist_user_id = st.artist_user_id
    JOIN users u ON u.id = b.artist_user_id
    LEFT JOIN users cu ON cu.id = b.client_user_id
    WHERE st.salon_user_id = $1 AND NOT st.is_owner AND st.artist_user_id IS NOT NULL
      AND b.source_salon_user_id IS NULL AND b.status = ANY($2)
      AND b.booking_date >= $3 AND b.booking_date <= $4
    ORDER BY b.booking_date, b.time
    LIMIT 400
  `, [salonUserId, LIVE_AT_SALON, fromKey, toKey]);
  const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "";
  return {
    visits: rows.filter((row) => row.here).map((row) => ({
      id: row.id,
      artistName: row.artist_name || "آرتیست",
      clientFirstName: firstName(row.client_name),
      date: row.booking_date,
      time: row.time,
      minutes: Number(row.duration_minutes) || 60,
      service: row.service || ""
    })),
    // Elsewhere and already started: that hour no longer matters to the salon.
    busy: rows.filter((row) => !row.here && notStartedYet(row)).map((row) => ({
      id: row.id,
      artistName: row.artist_name || "آرتیست",
      date: row.booking_date,
      time: row.time,
      minutes: Number(row.duration_minutes) || 60
    }))
  };
}

/**
 * Takes direct bookings back from a salon: the salon's place on them is cleared, so they are held at the artist's own place
 * (nothing is cancelled). Only live bookings that have not started yet; `artistUserId` null = every artist of that salon. Returns what moved, with
 * the names to tell the clients.
 */
export async function releasePlacedBookings(salonUserId, artistUserId = null, runner = null) {
  const db = runner || (await getDb());
  const rows = await all(db, `
    SELECT b.id, b.client_user_id, b.service, b.booking_date, b.time, au.name AS artist_name
    FROM artist_bookings b JOIN users au ON au.id = b.artist_user_id
    WHERE b.place_salon_user_id = $1 AND b.source_salon_user_id IS NULL AND b.status = ANY($2)
      AND ($3::int IS NULL OR b.artist_user_id = $3)
  `, [salonUserId, LIVE_AT_SALON, artistUserId]);
  // One whose time has come already happened at the salon: it stays there, and nobody is told it moved.
  const moved = rows.filter((row) => notStartedYet(row));
  if (moved.length) {
    await run(db, "UPDATE artist_bookings SET place_salon_user_id = NULL WHERE id = ANY($1) AND place_salon_user_id = $2", [moved.map((row) => row.id), salonUserId]);
  }
  return moved;
}

/**
 * The artist moves one of their own live bookings to one of their salons, or to their own place (salonUserId null).
 * → { ok, booking?: row before the move, changed } or { ok: false, status, error }.
 */
export async function moveBookingPlace(artistUserId, bookingId, salonUserId, runner = null) {
  const db = runner || (await getDb());
  const booking = await get(db, `
    SELECT b.id, b.client_user_id, b.service, b.booking_date, b.time, b.duration_minutes, b.status, b.place_salon_user_id
    FROM artist_bookings b WHERE b.id = $1 AND b.artist_user_id = $2 AND b.source_salon_user_id IS NULL
  `, [bookingId, artistUserId]);
  if (!booking) return { ok: false, status: 404, error: "این نوبت رو پیدا نکردیم." };
  if (!LIVE_AT_SALON.includes(booking.status) || !notStartedYet(booking)) return { ok: false, status: 409, error: "وقت این نوبت رسیده؛ جاش رو نمی‌شه عوض کرد." };
  const target = Number(salonUserId || 0) || null;
  if (target && !(await movablePlaces(artistUserId, db)).some((team) => Number(team.salon_user_id) === target)) {
    return { ok: false, status: 409, error: "این سالن فعلاً مشتری‌های خودت رو قبول نمی‌کنه.", code: "SALON_BLOCKED" };
  }
  if (target && salonTimeBlock(await readSalonHours(target, db), booking.booking_date, booking.time, booking.duration_minutes || 60)) {
    return { ok: false, status: 409, error: "سالن اون ساعت بسته‌ست؛ این نوبت رو نمی‌شه برد اونجا.", code: "SALON_CLOSED" };
  }
  const changed = Number(booking.place_salon_user_id || 0) !== Number(target || 0);
  if (changed) await run(db, "UPDATE artist_bookings SET place_salon_user_id = $1 WHERE id = $2", [target, bookingId]);
  return { ok: true, booking, changed };
}
