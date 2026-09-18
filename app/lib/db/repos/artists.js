import { getDb, withTransaction } from "../connection.js";
import { storyFieldsFor } from "./stories.js";
import { countFollowers, getUserById, isFollowing } from "./users.js";
import { listPostsByOwner } from "./posts.js";
import { resolveRollingPersianDateKey } from "../../../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel } from "../../../shared/lib/time.js";
import { normalizePhone } from "./salons/common.js";
import { getTargetRatingSummary, isProfileSaved } from "./social.js";

export { ensureArtistHours, listArtistHours, updateArtistHour } from "./artists/hours.js";

export function listArtistServices(userId) {
  return getDb().prepare(`
    SELECT id, name, price, duration, hint, badge, tone
    FROM artist_services WHERE user_id = ? ORDER BY id ASC
  `).all(userId);
}

export function addArtistService(userId, data) {
  const info = getDb().prepare(`
    INSERT INTO artist_services (user_id, name, price, duration, hint, badge, tone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    data.name || "",
    data.price || "",
    data.duration || "",
    data.hint || "",
    data.badge || "",
    data.tone || "soft"
  );
  return getDb().prepare("SELECT * FROM artist_services WHERE id = ?").get(Number(info.lastInsertRowid));
}

export function updateArtistService(id, userId, data) {
  const current = getDb().prepare("SELECT * FROM artist_services WHERE id = ? AND user_id = ?").get(id, userId);
  if (!current) return null;
  getDb().prepare(`
    UPDATE artist_services SET
      name = ?, price = ?, duration = ?, hint = ?, badge = ?, tone = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    data.name ?? current.name,
    data.price ?? current.price,
    data.duration ?? current.duration,
    data.hint ?? current.hint,
    data.badge ?? current.badge,
    data.tone ?? current.tone,
    id,
    userId
  );
  return getDb().prepare("SELECT * FROM artist_services WHERE id = ?").get(id);
}

export function deleteArtistService(id, userId) {
  return getDb().prepare("DELETE FROM artist_services WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

function mapArtistCollab(row) {
  if (!row) return null;
  return {
    id: row.id,
    salonId: row.salon_user_id,
    salonName: row.salon_name,
    salonAvatar: row.salon_avatar || "",
    area: row.area,
    service: row.service,
    days: row.days,
    from: row.from_time,
    to: row.to_time,
    share: row.share_percent,
    capacity: row.capacity,
    status: row.status,
    createdAt: row.created_at
  };
}

export function listArtistCollabs(userId) {
  return getDb().prepare(`
    SELECT c.*, u.avatar AS salon_avatar
    FROM artist_collabs c
    LEFT JOIN users u ON u.id = c.salon_user_id
    WHERE c.artist_user_id = ?
    ORDER BY c.id DESC
  `).all(userId).map(mapArtistCollab).filter(Boolean);
}

export function listSalonCollabRequests(salonUserId) {
  return getDb().prepare(`
    SELECT
      c.*,
      u.name AS artist_name,
      u.avatar AS artist_avatar,
      u.service AS artist_service,
      u.area AS artist_area
    FROM artist_collabs c
    JOIN users u ON u.id = c.artist_user_id
    WHERE c.salon_user_id = ?
    ORDER BY c.id DESC
  `).all(salonUserId).map((row) => ({
    ...mapArtistCollab(row),
    artistId: row.artist_user_id,
    artistName: row.artist_name || "آرتیست زیبابان",
    artistAvatar: row.artist_avatar || "",
    artistService: row.artist_service || "",
    artistArea: row.artist_area || ""
  }));
}

export function addArtistCollab(userId, data) {
  const info = getDb().prepare(`
    INSERT INTO artist_collabs
      (artist_user_id, salon_user_id, salon_name, area, service, days, from_time, to_time, share_percent, capacity, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    data.salonId || data.salon_user_id || null,
    data.salonName || data.salon_name || "",
    data.area || "",
    data.service || "",
    data.days || "",
    data.from || data.fromTime || data.from_time || "",
    data.to || data.toTime || data.to_time || "",
    data.share || data.sharePercent || data.share_percent || "",
    data.capacity || "",
    data.status || "آماده ارسال"
  );
  return mapArtistCollab(getDb().prepare(`
    SELECT c.*, u.avatar AS salon_avatar
    FROM artist_collabs c
    LEFT JOIN users u ON u.id = c.salon_user_id
    WHERE c.id = ?
  `).get(Number(info.lastInsertRowid)));
}

export function deleteArtistCollab(id, userId) {
  return getDb().prepare("DELETE FROM artist_collabs WHERE id = ? AND artist_user_id = ?").run(id, userId).changes > 0;
}

export function updateSalonCollabStatus(id, salonUserId, status) {
  const allowed = new Set(["تایید شد", "رد شد", "آماده ارسال", "پایان یافت"]);
  const nextStatus = allowed.has(status) ? status : "آماده ارسال";
  const result = getDb().prepare(`
    UPDATE artist_collabs
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND salon_user_id = ?
  `).run(nextStatus, id, salonUserId);
  if (result.changes < 1) return null;
  return listSalonCollabRequests(salonUserId).find((item) => Number(item.id) === Number(id)) || null;
}

export function endSalonCollabsForArtist(salonUserId, artistUserId) {
  const artistId = Number(artistUserId || 0);
  if (!salonUserId || !artistId) return 0;
  return getDb().prepare(`
    UPDATE artist_collabs
    SET status = 'پایان یافت', updated_at = CURRENT_TIMESTAMP
    WHERE salon_user_id = ?
      AND artist_user_id = ?
      AND status IN ('تایید شد', 'آماده ارسال')
  `).run(salonUserId, artistId).changes;
}

export function getArtistBreak(userId) {
  const row = getDb().prepare(`
    SELECT start_time, end_time FROM artist_breaks WHERE user_id = ?
  `).get(userId);
  if (!row?.start_time || !row?.end_time) return null;
  return { start: row.start_time, end: row.end_time };
}

export function setArtistBreak(userId, startTime, endTime) {
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  if (!start || !end) {
    getDb().prepare("DELETE FROM artist_breaks WHERE user_id = ?").run(userId);
    return null;
  }
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (!(endMinutes > startMinutes)) {
    return { ok: false, error: "پایان استراحت باید بعد از شروع باشد." };
  }
  getDb().prepare(`
    INSERT INTO artist_breaks (user_id, start_time, end_time, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, start, end);
  return { ok: true, break: { start, end } };
}

export function clearArtistBreak(userId) {
  getDb().prepare("DELETE FROM artist_breaks WHERE user_id = ?").run(userId);
  return null;
}

export function listArtistBookings(artistUserId) {
  ensureArtistBookingDurationColumn();
  const rows = getDb().prepare(`
    SELECT
      b.*,
      salon.name AS source_salon_name,
      salon.avatar AS source_salon_avatar,
      salon.area AS source_salon_area
    FROM artist_bookings b
    LEFT JOIN users salon ON salon.id = b.source_salon_user_id
    WHERE b.artist_user_id = ?
    ORDER BY b.id DESC
  `).all(artistUserId);

  function sameArtistClient(a, b) {
    if (!a || !b) return false;
    if (a.client_user_id && b.client_user_id && Number(a.client_user_id) === Number(b.client_user_id)) return true;
    const aPhone = String(a.client_phone || "").trim();
    const bPhone = String(b.client_phone || "").trim();
    if (aPhone && bPhone && aPhone === bPhone) return true;
    const aName = String(a.client_name || "").trim();
    const bName = String(b.client_name || "").trim();
    return Boolean(aName && bName && aName === bName);
  }

  function buildVisits(historyRows) {
    const recent = [...historyRows]
      .filter((item) => item && item.status !== "لغو")
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
      .slice(-10);
    const visits = Array.from({ length: 10 }, () => 0);
    recent.forEach((item, index) => {
      visits[index] = item.status === "VIP" ? 2 : 1;
    });
    return visits;
  }

  return rows.map((row) => {
    const client = row.client_user_id ? getUserById(row.client_user_id) : null;
    const history = rows.filter((item) => sameArtistClient(item, row));
    const visits = buildVisits(history);
    return {
      ...row,
      visits,
      visit_count: visits.filter((level) => level > 0).length,
      sourceSalon: row.source_salon_user_id
        ? {
            id: row.source_salon_user_id,
            name: row.source_salon_name || "",
            avatar: row.source_salon_avatar || "",
            area: row.source_salon_area || ""
          }
        : null,
      clientProfile: client
        ? {
            id: client.id,
            name: client.name || row.client_name || "",
            phone: client.phone || row.client_phone || "",
            area: client.area || "",
            avatar: client.avatar || "",
            bio: client.bio || "",
            type: client.type || "client"
          }
        : {
            id: null,
            name: row.client_name || "",
            phone: row.client_phone || "",
            area: "",
            avatar: "",
            bio: "",
            type: "client"
          }
    };
  });
}

/**
 * A client's own bookings made directly with an independent artist
 * (artist_bookings table). Mirrors listClientSalonBookings in
 * app/lib/db/repos/salons/bookings.js (same client_user_id/phone/name
 * match, same "OR" match strategy for legacy rows with no client_user_id).
 *
 * Field names intentionally reuse the salon-booking shape
 * (salonName/salon_name/salonArea/.../salonAvatar/...) so the client
 * bookings UI (ClientBookingsPanel.getBookingMeta: booking.salonName ||
 * booking.salon_name, etc.) renders an artist-sourced row with zero
 * changes. bookingSource/artistUserId are kept as their OWN distinct
 * fields (never aliased to salon_user_id) so "رزرو دوباره" can tell an
 * artist booking apart from a salon booking and route to the artist's
 * public profile instead — see rebookFromBooking in HomeApp.jsx.
 */
export function listClientArtistBookings(user) {
  ensureArtistBookingDurationColumn();
  const userId = Number(user?.id || 0);
  const phone = normalizePhone(user?.phone || "");
  const name = String(user?.name || "").trim();
  if (!userId && !phone && !name) return [];
  const conditions = [];
  const params = [];
  if (userId) {
    conditions.push("b.client_user_id = ?");
    params.push(userId);
  }
  if (phone) {
    conditions.push(`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(b.client_phone,
      '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9') = ?`);
    params.push(phone);
  }
  if (name) {
    conditions.push("b.client_name = ?");
    params.push(name);
  }
  return getDb().prepare(`
    SELECT b.*, u.name AS artist_name, u.area AS artist_area, u.avatar AS artist_avatar, u.phone AS artist_phone
    FROM artist_bookings b
    LEFT JOIN users u ON u.id = b.artist_user_id
    WHERE ${conditions.join(" OR ")}
    ORDER BY b.id DESC
  `).all(...params).map((row) => ({
    ...row,
    client: row.client_name || "",
    // NOTE: unlike salon bookings' `phone` column (the booking client's own
    // number), artist_bookings has no such plain `phone` column — reuse it
    // here for the client's number and put the artist's own number under
    // salonPhone/salon_phone (below), matching what ClientBookingSettingsModal
    // actually calls for "تماس" (booking.salonPhone || booking.salon_phone || booking.phone).
    phone: row.client_phone || "",
    salonName: row.artist_name || "آرتیست",
    salon_name: row.artist_name || "آرتیست",
    salonArea: row.artist_area || "",
    salon_area: row.artist_area || "",
    salonAvatar: row.artist_avatar || "",
    salon_avatar: row.artist_avatar || "",
    salonPhone: row.artist_phone || "",
    salon_phone: row.artist_phone || "",
    bookingSource: "artist",
    artistUserId: row.artist_user_id,
    sourceArtistUserId: row.artist_user_id
  }));
}

export function syncSalonBookingsForArtist(artistUserId) {
  ensureArtistBookingDurationColumn();
  const linkedSalonBookings = getDb().prepare(`
    SELECT b.*
    FROM salon_bookings b
    JOIN salon_staff st
      ON st.salon_user_id = b.salon_user_id
      AND st.name = b.staff
    WHERE st.artist_user_id = ?
      AND b.status != 'لغو'
    ORDER BY b.id ASC
  `).all(artistUserId);

  let synced = 0;
  for (const booking of linkedSalonBookings) {
    const exact = getDb().prepare(`
      SELECT id, source_salon_user_id
      FROM artist_bookings
      WHERE artist_user_id = ?
        AND client_name = ?
        AND client_phone = ?
        AND service = ?
        AND booking_date = ?
        AND time = ?
      LIMIT 1
    `).get(
      artistUserId,
      booking.client || "",
      booking.phone || "",
      booking.service || "",
      booking.booking_date || "",
      booking.time || ""
    );

    if (exact) {
      if (!exact.source_salon_user_id) {
        getDb().prepare(`
          UPDATE artist_bookings
          SET source_salon_user_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(booking.salon_user_id, booking.status || "تازه", exact.id);
        synced += 1;
      }
      continue;
    }

    const result = addArtistBooking(artistUserId, {
      client: booking.client,
      phone: booking.phone,
      service: booking.service,
      bookingDate: booking.booking_date,
      time: booking.time,
      sourceSalonUserId: booking.salon_user_id,
      status: booking.status || "تازه"
    });
    if (result.ok) synced += 1;
  }
  return { synced };
}

function ensureArtistBookingDurationColumn() {
  const cols = getDb().prepare("PRAGMA table_info(artist_bookings)").all();
  if (!cols.some((col) => col.name === "duration_minutes")) {
    getDb().exec("ALTER TABLE artist_bookings ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 60");
  }
  if (!cols.some((col) => col.name === "source_salon_user_id")) {
    getDb().exec("ALTER TABLE artist_bookings ADD COLUMN source_salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL");
  }
}

function toAsciiDigits(value) {
  return String(value ?? "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

function parseDurationMinutes(value) {
  const match = toAsciiDigits(value).match(/(\d+)/);
  return Math.max(15, Number(match?.[1] || 60));
}

function timeToMinutes(value) {
  const [hours = "0", minutes = "0"] = toAsciiDigits(value).split(":");
  return (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

export function listArtistBookedSlots(artistUserId, { excludeBookingId = null } = {}) {
  ensureArtistBookingDurationColumn();
  const services = listArtistServices(artistUserId);
  const serviceDurationMap = Object.fromEntries(
    services.map((service) => [service.name, parseDurationMinutes(service.duration)])
  );
  const excludeId = excludeBookingId != null ? Number(excludeBookingId) : null;
  return getDb().prepare(`
    SELECT id, booking_date, time, status, service, duration_minutes
    FROM artist_bookings
    WHERE artist_user_id = ?
      AND status NOT IN ('لغو', 'لغو شده', 'cancelled', 'منقضی شده')
    ORDER BY id ASC
  `).all(artistUserId).filter((row) => excludeId == null || Number(row.id) !== excludeId).map((row) => ({
    id: row.id,
    booking_date: row.booking_date,
    time: row.time,
    status: row.status,
    service: row.service,
    duration_minutes: Number(row.duration_minutes)
      || serviceDurationMap[row.service]
      || 60
  }));
}

export function isArtistSlotBlocked(artistUserId, bookingDate, time, durationMinutes = 60, excludeBookingId = null) {
  if (!artistUserId || !bookingDate || !time) return false;
  const bookingDateKey = resolveRollingPersianDateKey(bookingDate);
  const start = timeToMinutes(time);
  const end = start + Math.max(15, Number(durationMinutes) || 60);

  const artistBreak = getArtistBreak(artistUserId);
  if (artistBreak) {
    const breakStart = timeToMinutes(artistBreak.start);
    const breakEnd = timeToMinutes(artistBreak.end);
    if (breakEnd > breakStart && rangesOverlap(start, end, breakStart, breakEnd)) {
      return true;
    }
  }

  return listArtistBookedSlots(artistUserId, { excludeBookingId })
    .filter((item) => resolveRollingPersianDateKey(item.booking_date) === bookingDateKey)
    .some((item) => {
      const bookedStart = timeToMinutes(item.time);
      const bookedEnd = bookedStart + Math.max(15, Number(item.duration_minutes) || 60);
      return rangesOverlap(start, end, bookedStart, bookedEnd);
    });
}

/**
 * Find the artist_bookings row mirrored from a salon booking (by source salon + slot fingerprint).
 * Prefer active (non-cancelled) rows when duplicates exist.
 */
export function findLinkedSalonArtistBooking(artistUserId, salonUserId, salonBookingRow) {
  if (!artistUserId || !salonUserId || !salonBookingRow) return null;
  ensureArtistBookingDurationColumn();
  const bookingDate = resolveRollingPersianDateKey(salonBookingRow.booking_date || "");
  const timeNorm = normalizeBookingTimeLabel(salonBookingRow.time || "");
  if (!bookingDate || !timeNorm) return null;

  const rows = getDb().prepare(`
    SELECT *
    FROM artist_bookings
    WHERE artist_user_id = ?
      AND source_salon_user_id = ?
      AND client_name = ?
      AND client_phone = ?
      AND service = ?
      AND booking_date = ?
    ORDER BY
      CASE WHEN status IN ('لغو', 'لغو شده', 'cancelled') THEN 1 ELSE 0 END ASC,
      id DESC
  `).all(
    Number(artistUserId),
    Number(salonUserId),
    salonBookingRow.client || "",
    salonBookingRow.phone || "",
    salonBookingRow.service || "",
    bookingDate
  );

  return rows.find((row) => normalizeBookingTimeLabel(row.time || "") === timeNorm) || null;
}

export function updateArtistBookingRow(bookingId, fields = {}) {
  ensureArtistBookingDurationColumn();
  const current = getDb().prepare("SELECT * FROM artist_bookings WHERE id = ?").get(Number(bookingId));
  if (!current) return null;
  const next = {
    client_name: fields.client_name ?? fields.client ?? current.client_name,
    client_phone: fields.client_phone ?? fields.phone ?? current.client_phone,
    service: fields.service ?? current.service,
    booking_date: resolveRollingPersianDateKey(
      fields.booking_date ?? fields.bookingDate ?? fields.date ?? current.booking_date
    ),
    time: normalizeBookingTimeLabel(fields.time ?? current.time),
    duration_minutes: Math.max(
      15,
      Number(fields.duration_minutes ?? fields.durationMinutes ?? current.duration_minutes) || 60
    ),
    status: fields.status ?? current.status
  };
  getDb().prepare(`
    UPDATE artist_bookings
    SET client_name = ?, client_phone = ?, service = ?, booking_date = ?, time = ?,
        duration_minutes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    next.client_name || "",
    next.client_phone || "",
    next.service || "",
    next.booking_date || "",
    next.time || "",
    next.duration_minutes,
    next.status || "تازه",
    Number(bookingId)
  );
  return getDb().prepare("SELECT * FROM artist_bookings WHERE id = ?").get(Number(bookingId));
}

/** Soft-cancel (status لغو) — keeps history aligned with salon cancel. */
export function cancelArtistBookingRow(bookingId) {
  return updateArtistBookingRow(bookingId, { status: "لغو" });
}

/**
 * Slot-conflict check + INSERT for an artist_bookings row, run against whatever
 * transaction is already open on the caller's connection (no BEGIN/COMMIT of its own).
 * Mirrors the salons/bookings.js `updateSalonBookingInTx` convention: callers that
 * already hold a `withTransaction`/`BEGIN IMMEDIATE` (e.g. patchSalonBookingWithArtistSync)
 * must call this directly instead of `addArtistBooking`, to avoid nesting BEGIN IMMEDIATE.
 */
export function addArtistBookingInTx(artistUserId, data) {
  ensureArtistBookingDurationColumn();
  const bookingDate = resolveRollingPersianDateKey(data.bookingDate || data.booking_date || data.date || "");
  const time = normalizeBookingTimeLabel(data.time || "");
  const durationMinutes = Math.max(
    15,
    Number(data.durationMinutes || data.duration_minutes)
      || parseDurationMinutes(data.duration)
      || 60
  );
  if (!bookingDate || !time) {
    return { ok: false, error: "روز و ساعت لازم است.", code: "MISSING_SLOT" };
  }
  if (isArtistSlotBlocked(artistUserId, bookingDate, time, durationMinutes, data.excludeBookingId ?? null)) {
    return { ok: false, error: "این بازه زمانی با نوبت دیگری تداخل دارد.", code: "SLOT_TAKEN" };
  }

  const info = getDb().prepare(`
    INSERT INTO artist_bookings
      (artist_user_id, client_user_id, source_salon_user_id, client_name, client_phone, service, booking_date, time, duration_minutes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    artistUserId,
    data.clientUserId || null,
    data.sourceSalonUserId || data.source_salon_user_id || null,
    data.clientName || data.client || "",
    data.clientPhone || data.phone || "",
    data.service || "",
    bookingDate,
    time,
    durationMinutes,
    data.status || "تازه"
  );
  return {
    ok: true,
    booking: getDb().prepare("SELECT * FROM artist_bookings WHERE id = ?").get(Number(info.lastInsertRowid))
  };
}

/**
 * Public entry point: wraps the check+INSERT above in its own `withTransaction`
 * (`BEGIN IMMEDIATE`) so two truly concurrent connections can't both pass the
 * overlap check before either commits. Use this from call sites that are NOT
 * already inside an open transaction (API routes, syncSalonBookingsForArtist).
 * Call sites already inside a transaction must use `addArtistBookingInTx` instead.
 */
export function addArtistBooking(artistUserId, data) {
  return withTransaction(getDb(), () => addArtistBookingInTx(artistUserId, data));
}

/** Full booking snapshot for a booking-card chat bubble. Live status — callers should re-fetch, never cache. */
export function getArtistBookingById(bookingId) {
  const row = getDb().prepare("SELECT * FROM artist_bookings WHERE id = ?").get(bookingId);
  if (!row) return null;
  return {
    id: row.id,
    artistUserId: row.artist_user_id,
    clientUserId: row.client_user_id,
    sourceSalonUserId: row.source_salon_user_id,
    client: row.client_name,
    phone: row.client_phone,
    service: row.service,
    bookingDate: row.booking_date,
    time: row.time,
    durationMinutes: row.duration_minutes,
    status: row.status,
    createdAt: row.created_at
  };
}

export function getPublicArtist(userId, viewerUserId = null) {
  const user = getUserById(userId);
  if (!user || user.type !== "artist") return null;
  const posts = listPostsByOwner(userId);
  const services = listArtistServices(userId);
  const reviews = getDb().prepare(`
    SELECT r.id, r.author_user_id, r.author_name AS name, r.rating, r.text, r.service, r.created_at, r.reply_text, r.replied_at,
           u.type AS author_type, u.avatar AS author_avatar, u.area AS author_area,
           (SELECT COUNT(*) FROM review_likes rl WHERE rl.review_id = r.id) AS like_count,
           EXISTS(SELECT 1 FROM review_likes rl2 WHERE rl2.review_id = r.id AND rl2.user_id = ?) AS liked_by_me
    FROM reviews r
    LEFT JOIN users u ON u.id = r.author_user_id
    WHERE r.target_user_id = ?
    ORDER BY r.id DESC LIMIT 50
  `).all(viewerUserId || 0, userId);
  const ratingAgg = getDb().prepare(`
    SELECT AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM reviews WHERE target_user_id = ?
  `).get(userId);
  return {
    id: user.id,
    name: user.name,
    role: user.service ? `آرتیست ${user.service}` : "آرتیست",
    area: user.area,
    bio: user.bio,
    avatar: user.avatar,
    service: user.service,
    experienceYears: user.experience_years || "",
    rating: ratingAgg?.cnt ? Number(ratingAgg.avg_rating).toFixed(1) : "۰",
    reviewCount: Number(ratingAgg?.cnt || 0),
    followers: countFollowers(user.id),
    isFollowing: viewerUserId ? isFollowing(viewerUserId, user.id) : false,
    isSaved: viewerUserId ? isProfileSaved(viewerUserId, user.id) : false,
    posts,
    services,
    reviews,
    bookedSlots: listArtistBookedSlots(userId),
    breakTime: getArtistBreak(userId),
    ...(storyFieldsFor(user.id) || {})
  };
}

export function listArtists() {
  return getDb().prepare(`
    SELECT id, name, area, service, avatar, bio FROM users WHERE type = 'artist' ORDER BY created_at DESC
  `).all();
}

/**
 * Card-sized list of independent artists the user has saved (bookmark
 * button on the artist's public profile) — for the "ذخیره‌شده‌ها" tab,
 * alongside saved posts and saved salons. Filters to type = 'artist' so a
 * saved salon (also stored in saved_profiles, target_user_id points at the
 * same users table) never leaks into this list.
 */
export function listSavedArtistsForUser(userId) {
  const rows = getDb().prepare(`
    SELECT u.* FROM saved_profiles sp
    JOIN users u ON u.id = sp.target_user_id
    WHERE sp.user_id = ? AND u.type = 'artist'
    ORDER BY sp.created_at DESC
  `).all(userId);
  return rows.map((user) => {
    const { rating, reviewCount } = getTargetRatingSummary(user.id);
    return {
      id: user.id,
      name: user.name,
      role: user.service ? `آرتیست ${user.service}` : "آرتیست",
      area: user.area,
      bio: user.bio,
      avatar: user.avatar,
      service: user.service,
      rating,
      reviewCount,
      followers: countFollowers(user.id)
    };
  });
}
