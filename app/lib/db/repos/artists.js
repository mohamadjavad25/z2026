import { getDb, withTransaction, all, get, run } from "../connection.js";
import { countFollowers, countFollowCountsMany, getUserProfileById, getUserLiteById, isFollowing } from "./users.js";
import { buildClientHistoryLookup } from "./clientHistory.js";
import { listPostsByOwner } from "./posts.js";
import { formatPersianDateKey, isPersianDateKey, resolveRollingPersianDateKey } from "../../../shared/lib/persianCalendar.js";
import { normalizeBookingTimeLabel } from "../../../shared/lib/time.js";
import { normalizePhone } from "./salons/common.js";
import { isProfileSaved } from "./social.js";
import { normalizeServiceEmoji, resolveBookingServiceEmoji } from "./serviceEmoji.js";
import { getSettings, DEFAULT_SETTINGS } from "./userSettings.js";
import { listArtistHoursPublic } from "./artists/hours.js";

export { ensureArtistHours, listArtistHours, updateArtistHour } from "./artists/hours.js";

export async function listArtistServices(userId, runner = null) {
  const db = runner || (await getDb());
  return all(db, `
    SELECT id, name, price, duration, hint, badge, tone, emoji
    FROM artist_services WHERE user_id = $1 ORDER BY id ASC
  `, [userId]);
}

export async function addArtistService(userId, data) {
  const db = await getDb();
  const info = await run(db, `
    INSERT INTO artist_services (user_id, name, price, duration, hint, badge, tone, emoji)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [
    userId,
    data.name || "",
    data.price || "",
    data.duration || "",
    data.hint || "",
    data.badge || "",
    data.tone || "soft",
    normalizeServiceEmoji(data.emoji)
  ]);
  return get(db, "SELECT * FROM artist_services WHERE id = $1", [Number(info.rows[0].id)]);
}

export async function updateArtistService(id, userId, data) {
  const db = await getDb();
  const current = await get(db, "SELECT * FROM artist_services WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!current) return null;
  await run(db, `
    UPDATE artist_services SET
      name = $1, price = $2, duration = $3, hint = $4, badge = $5, tone = $6, emoji = $7, updated_at = CURRENT_TIMESTAMP
    WHERE id = $8 AND user_id = $9
  `, [
    data.name ?? current.name,
    data.price ?? current.price,
    data.duration ?? current.duration,
    data.hint ?? current.hint,
    data.badge ?? current.badge,
    data.tone ?? current.tone,
    Object.prototype.hasOwnProperty.call(data, "emoji") ? normalizeServiceEmoji(data.emoji) : current.emoji,
    id,
    userId
  ]);
  return get(db, "SELECT * FROM artist_services WHERE id = $1", [id]);
}

export async function deleteArtistService(id, userId) {
  const db = await getDb();
  const result = await run(db, "DELETE FROM artist_services WHERE id = $1 AND user_id = $2", [id, userId]);
  return result.rowCount > 0;
}

function mapArtistCollab(row) {
  if (!row) return null;
  return {
    id: row.id,
    salonId: row.salon_user_id,
    salonName: row.salon_name,
    salonAvatar: row.salon_avatar && row.salon_user_id ? `/api/media/avatar/${row.salon_user_id}` : "",
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

export async function listArtistCollabs(userId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT c.*, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS salon_avatar
    FROM artist_collabs c
    LEFT JOIN users u ON u.id = c.salon_user_id
    WHERE c.artist_user_id = $1
    ORDER BY c.id DESC
  `, [userId]);
  return rows.map(mapArtistCollab).filter(Boolean);
}

export async function listSalonCollabRequests(salonUserId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT
      c.*,
      u.name AS artist_name,
      (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS artist_avatar,
      u.service AS artist_service,
      u.area AS artist_area
    FROM artist_collabs c
    JOIN users u ON u.id = c.artist_user_id
    WHERE c.salon_user_id = $1
    ORDER BY c.id DESC
  `, [salonUserId]);
  return rows.map((row) => ({
    ...mapArtistCollab(row),
    artistId: row.artist_user_id,
    artistName: row.artist_name || "آرتیست فرفرو",
    artistAvatar: row.artist_avatar && row.artist_user_id ? `/api/media/avatar/${row.artist_user_id}` : "",
    artistService: row.artist_service || "",
    artistArea: row.artist_area || ""
  }));
}

const COLLAB_PENDING = "آماده ارسال";
const COLLAB_ACCEPTED = "تایید شد";
const COLLAB_REJECTED = "رد شد";
const COLLAB_ENDED = "پایان یافت";

function cleanText(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

/**
 * An artist's collaboration proposal to a salon. Validated server-side: the
 * salon must exist, the artist must not already be on its team, and there must
 * be no live invite or proposal for the same pair (the invite and proposal
 * flows are two doors into the same team, so each checks the other). The status
 * is always "pending" -- only the salon can move it (updateSalonCollabStatus).
 */
export async function addArtistCollab(userId, data) {
  const db = await getDb();
  const salonUserId = Number(data.salonId || data.salon_user_id || 0) || null;
  if (!salonUserId) {
    return { ok: false, error: "سالن نامعتبر است.", code: "INVALID_SALON" };
  }
  const salon = await get(db, `
    SELECT u.id, COALESCE(NULLIF(s.name, ''), u.name) AS name, COALESCE(s.area, '') AS area
    FROM users u
    LEFT JOIN salons s ON s.user_id = u.id
    WHERE u.id = $1 AND u.type = 'salon'
  `, [salonUserId]);
  if (!salon) {
    return { ok: false, error: "سالن پیدا نشد.", code: "SALON_NOT_FOUND" };
  }

  const alreadyStaff = await get(db, `
    SELECT id FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 LIMIT 1
  `, [salonUserId, userId]);
  if (alreadyStaff) {
    return { ok: false, error: "تو همین حالا عضو تیم این سالن هستی.", code: "ALREADY_STAFF" };
  }

  const pendingInvite = await get(db, `
    SELECT id FROM salon_artist_invites
    WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'در انتظار تایید' LIMIT 1
  `, [salonUserId, userId]);
  if (pendingInvite) {
    return {
      ok: false,
      error: "این سالن قبلاً تو را دعوت کرده؛ از بخش «دعوت‌ها» به آن پاسخ بده.",
      code: "INVITE_PENDING"
    };
  }

  const pendingProposal = await get(db, `
    SELECT id FROM artist_collabs
    WHERE artist_user_id = $1 AND salon_user_id = $2 AND status = $3 LIMIT 1
  `, [userId, salonUserId, COLLAB_PENDING]);
  if (pendingProposal) {
    return { ok: false, error: "پیشنهاد قبلی‌ات هنوز در انتظار پاسخ این سالن است.", code: "PENDING_EXISTS" };
  }

  const info = await run(db, `
    INSERT INTO artist_collabs
      (artist_user_id, salon_user_id, salon_name, area, service, days, from_time, to_time, share_percent, capacity, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `, [
    userId,
    salonUserId,
    salon.name || "",
    salon.area || "",
    cleanText(data.service),
    cleanText(data.days, 200),
    cleanText(data.from || data.fromTime || data.from_time, 12),
    cleanText(data.to || data.toTime || data.to_time, 12),
    cleanText(data.share || data.sharePercent || data.share_percent, 12),
    cleanText(data.capacity, 12),
    COLLAB_PENDING
  ]);
  const row = await get(db, `
    SELECT c.*, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS salon_avatar
    FROM artist_collabs c
    LEFT JOIN users u ON u.id = c.salon_user_id
    WHERE c.id = $1
  `, [Number(info.rows[0].id)]);
  return { ok: true, collab: mapArtistCollab(row) };
}

export async function deleteArtistCollab(id, userId) {
  const db = await getDb();
  const result = await run(db, "DELETE FROM artist_collabs WHERE id = $1 AND artist_user_id = $2", [id, userId]);
  return result.rowCount > 0;
}

// Only forward moves: a pending proposal is accepted or declined, an accepted
// collaboration can later be ended. Anything else (re-accepting a declined one,
// "accepting" an ended one) is refused so a stale screen can't resurrect it.
const COLLAB_TRANSITIONS = {
  [COLLAB_PENDING]: new Set([COLLAB_ACCEPTED, COLLAB_REJECTED]),
  [COLLAB_ACCEPTED]: new Set([COLLAB_ENDED])
};

export async function updateSalonCollabStatus(id, salonUserId, status) {
  const db = await getDb();
  const current = await get(db, `
    SELECT status FROM artist_collabs WHERE id = $1 AND salon_user_id = $2
  `, [id, salonUserId]);
  if (!current) return { ok: false, code: "NOT_FOUND", error: "پیشنهاد پیدا نشد." };
  if (!COLLAB_TRANSITIONS[current.status]?.has(status)) {
    return { ok: false, code: "INVALID_TRANSITION", error: "این پیشنهاد دیگر قابل تغییر نیست." };
  }
  await run(db, `
    UPDATE artist_collabs
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND salon_user_id = $3
  `, [status, id, salonUserId]);
  const rows = await listSalonCollabRequests(salonUserId);
  return { ok: true, collab: rows.find((item) => Number(item.id) === Number(id)) || null };
}

export async function endSalonCollabsForArtist(salonUserId, artistUserId) {
  const artistId = Number(artistUserId || 0);
  if (!salonUserId || !artistId) return 0;
  const db = await getDb();
  const result = await run(db, `
    UPDATE artist_collabs
    SET status = 'پایان یافت', updated_at = CURRENT_TIMESTAMP
    WHERE salon_user_id = $1
      AND artist_user_id = $2
      AND status IN ('تایید شد', 'آماده ارسال')
  `, [salonUserId, artistId]);
  return result.rowCount;
}

export async function getArtistBreak(userId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, `
    SELECT start_time, end_time FROM artist_breaks WHERE user_id = $1
  `, [userId]);
  if (!row?.start_time || !row?.end_time) return null;
  return { start: row.start_time, end: row.end_time };
}

export async function setArtistBreak(userId, startTime, endTime) {
  const db = await getDb();
  const start = String(startTime || "").trim();
  const end = String(endTime || "").trim();
  if (!start || !end) {
    await run(db, "DELETE FROM artist_breaks WHERE user_id = $1", [userId]);
    return null;
  }
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (!(endMinutes > startMinutes)) {
    return { ok: false, error: "پایان استراحت باید بعد از شروع باشد." };
  }
  await run(db, `
    INSERT INTO artist_breaks (user_id, start_time, end_time, updated_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, start, end]);
  return { ok: true, break: { start, end } };
}

export async function clearArtistBreak(userId) {
  const db = await getDb();
  await run(db, "DELETE FROM artist_breaks WHERE user_id = $1", [userId]);
  return null;
}

export async function listArtistBookings(artistUserId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT
      b.*,
      salon.name AS source_salon_name,
      (salon.avatar <> '' OR salon.avatar_url IS NOT NULL) AS source_salon_avatar,
      salon.area AS source_salon_area
    FROM artist_bookings b
    LEFT JOIN users salon ON salon.id = b.source_salon_user_id
    WHERE b.artist_user_id = $1
    ORDER BY b.id DESC
    LIMIT 1500
  `, [artistUserId]);

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

  // Many rows share the same client_user_id (repeat customers) -- fetch
  // each unique client once, concurrently, instead of re-querying the same
  // user row over and over, sequentially, once per booking.
  const uniqueClientIds = [...new Set(rows.map((row) => row.client_user_id).filter(Boolean))];
  const clientsById = new Map(
    (await Promise.all(uniqueClientIds.map((id) => getUserLiteById(id, db))))
      .map((client, index) => [uniqueClientIds[index], client])
  );

  const historyOf = buildClientHistoryLookup(rows, (row) => ({
    userId: row.client_user_id || null,
    phone: String(row.client_phone || "").trim(),
    name: String(row.client_name || "").trim()
  }));
  const result = rows.map((row, index) => {
    const client = row.client_user_id ? clientsById.get(row.client_user_id) || null : null;
    const history = historyOf(index);
    const visits = buildVisits(history);
    return {
      ...row,
      visits,
      visit_count: visits.filter((level) => level > 0).length,
      sourceSalon: row.source_salon_user_id
        ? {
            id: row.source_salon_user_id,
            name: row.source_salon_name || "",
            avatar: row.source_salon_avatar ? `/api/media/avatar/${row.source_salon_user_id}` : "",
            area: row.source_salon_area || ""
          }
        : null,
      clientProfile: client
        ? {
            id: client.id,
            name: client.name || row.client_name || "",
            phone: client.phone || row.client_phone || "",
            area: client.area || "",
            avatar: client.avatar ? `/api/media/avatar/${client.id}` : "",
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
  return result;
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
export async function listClientArtistBookings(user) {
  const db = await getDb();
  const userId = Number(user?.id || 0);
  const phone = normalizePhone(user?.phone || "");
  const name = String(user?.name || "").trim();
  if (!userId && !phone && !name) return [];
  const conditions = [];
  const params = [];
  if (userId) {
    params.push(userId);
    conditions.push(`b.client_user_id = $${params.length}`);
  }
  // Same matching rule as listClientSalonBookings: rows with no account id match by phone, or by
  // name only when they have no phone at all (never a bare name against everyone's rows).
  if (phone) {
    // b.phone_normalized is a generated column (migrations/005_normalized_phone.sql)
    // that runs the same digit-normalization at write time, indexed --
    // unlike wrapping b.client_phone in REPLACE() on every read, this is sargable.
    params.push(phone);
    conditions.push(`(b.client_user_id IS NULL AND b.phone_normalized = $${params.length})`);
  }
  if (name) {
    params.push(name);
    conditions.push(`(b.client_user_id IS NULL AND COALESCE(b.client_phone, '') = '' AND b.client_name = $${params.length})`);
  }
  const rows = await all(db, `
    SELECT b.*, u.name AS artist_name, u.area AS artist_area, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS artist_avatar, u.phone AS artist_phone
    FROM artist_bookings b
    LEFT JOIN users u ON u.id = b.artist_user_id
    -- source_salon_user_id IS NOT NULL = the artist-calendar copy of a SALON booking; the client
    -- already has that booking from listClientSalonBookings, so listing it again showed every
    -- salon-with-staff booking twice, once per table, each with its own (diverging) status.
    WHERE b.source_salon_user_id IS NULL AND (${conditions.join(" OR ")})
    ORDER BY b.id DESC
  `, params);
  return rows.map((row) => ({
    ...row,
    client: row.client_name || "",
    // NOTE: unlike salon bookings' `phone` column (the booking client's own
    // number), artist_bookings has no such plain `phone` column — reuse it
    // here for the client's number and put the artist's own number under
    // salonPhone/salon_phone (below), matching what ClientBookingSettingsModal
    // actually calls for "تماس" (booking.salonPhone || booking.salon_phone || booking.phone).
    phone: row.client_phone || "",
    // artist_user_id is now nullable (see migration v34 — deleting an
    // artist account no longer destroys the client's own booking history
    // with them), same distinction as listClientSalonBookings' salonName.
    salonName: row.artist_name || (row.artist_user_id ? "آرتیست" : "آرتیست حذف‌شده"),
    salon_name: row.artist_name || (row.artist_user_id ? "آرتیست" : "آرتیست حذف‌شده"),
    salonArea: row.artist_area || "",
    salon_area: row.artist_area || "",
    salonAvatar: row.artist_avatar && row.artist_user_id ? `/api/media/avatar/${row.artist_user_id}` : "",
    salon_avatar: row.artist_avatar && row.artist_user_id ? `/api/media/avatar/${row.artist_user_id}` : "",
    salonPhone: row.artist_phone || "",
    salon_phone: row.artist_phone || "",
    bookingSource: "artist",
    artistUserId: row.artist_user_id,
    sourceArtistUserId: row.artist_user_id
  }));
}

export async function syncSalonBookingsForArtist(artistUserId) {
  const db = await getDb();
  const linkedSalonBookings = await all(db, `
    SELECT b.*
    FROM salon_bookings b
    JOIN salon_staff st
      ON st.salon_user_id = b.salon_user_id
      AND st.name = b.staff
    WHERE st.artist_user_id = $1
      AND b.status != 'لغو'
    ORDER BY b.id ASC
  `, [artistUserId]);

  let synced = 0;
  for (const booking of linkedSalonBookings) {
    const exact = await get(db, `
      SELECT id, source_salon_user_id
      FROM artist_bookings
      WHERE artist_user_id = $1
        AND client_name = $2
        AND client_phone = $3
        AND service = $4
        AND booking_date = $5
        AND time = $6
      LIMIT 1
    `, [
      artistUserId,
      booking.client || "",
      booking.phone || "",
      booking.service || "",
      booking.booking_date || "",
      booking.time || ""
    ]);

    if (exact) {
      if (!exact.source_salon_user_id) {
        await run(db, `
          UPDATE artist_bookings
          SET source_salon_user_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [booking.salon_user_id, booking.status || "تازه", exact.id]);
        synced += 1;
      }
      continue;
    }

    const result = await addArtistBooking(artistUserId, {
      client: booking.client,
      phone: booking.phone,
      service: booking.service,
      serviceEmoji: booking.service_emoji,
      bookingDate: booking.booking_date,
      time: booking.time,
      sourceSalonUserId: booking.salon_user_id,
      status: booking.status || "تازه"
    });
    if (result.ok) synced += 1;
  }
  return { synced };
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

export async function listArtistBookedSlots(artistUserId, { excludeBookingId = null } = {}, runner = null) {
  const db = runner || (await getDb());
  const services = await listArtistServices(artistUserId, db);
  const serviceDurationMap = Object.fromEntries(
    services.map((service) => [service.name, parseDurationMinutes(service.duration)])
  );
  const excludeId = excludeBookingId != null ? Number(excludeBookingId) : null;
  const rows = await all(db, `
    SELECT id, booking_date, time, status, service, duration_minutes
    FROM artist_bookings
    WHERE artist_user_id = $1
      AND status NOT IN ('لغو', 'لغو شده', 'cancelled', 'منقضی شده')
    ORDER BY id ASC
  `, [artistUserId]);
  return rows.filter((row) => excludeId == null || Number(row.id) !== excludeId).map((row) => ({
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

export async function isArtistSlotBlocked(artistUserId, bookingDate, time, durationMinutes = 60, excludeBookingId = null, runner = null) {
  if (!artistUserId || !bookingDate || !time) return false;
  const db = runner || (await getDb());
  const bookingDateKey = resolveRollingPersianDateKey(bookingDate);
  const start = timeToMinutes(time);
  const end = start + Math.max(15, Number(durationMinutes) || 60);

  const artistBreak = await getArtistBreak(artistUserId, db);
  if (artistBreak) {
    const breakStart = timeToMinutes(artistBreak.start);
    const breakEnd = timeToMinutes(artistBreak.end);
    if (breakEnd > breakStart && rangesOverlap(start, end, breakStart, breakEnd)) {
      return true;
    }
  }

  const bookedSlots = await listArtistBookedSlots(artistUserId, { excludeBookingId }, db);
  return bookedSlots
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
export async function findLinkedSalonArtistBooking(artistUserId, salonUserId, salonBookingRow, runner = null) {
  if (!artistUserId || !salonUserId || !salonBookingRow) return null;
  const db = runner || (await getDb());
  const bookingDate = resolveRollingPersianDateKey(salonBookingRow.booking_date || "");
  const timeNorm = normalizeBookingTimeLabel(salonBookingRow.time || "");
  if (!bookingDate || !timeNorm) return null;

  const rows = await all(db, `
    SELECT *
    FROM artist_bookings
    WHERE artist_user_id = $1
      AND source_salon_user_id = $2
      AND client_name = $3
      AND client_phone = $4
      AND service = $5
      AND booking_date = $6
    ORDER BY
      CASE WHEN status IN ('لغو', 'لغو شده', 'cancelled') THEN 1 ELSE 0 END ASC,
      id DESC
  `, [
    Number(artistUserId),
    Number(salonUserId),
    salonBookingRow.client || "",
    salonBookingRow.phone || "",
    salonBookingRow.service || "",
    bookingDate
  ]);

  return rows.find((row) => normalizeBookingTimeLabel(row.time || "") === timeNorm) || null;
}

export async function updateArtistBookingRow(bookingId, fields = {}, runner = null) {
  const db = runner || (await getDb());
  const current = await get(db, "SELECT * FROM artist_bookings WHERE id = $1", [Number(bookingId)]);
  if (!current) return null;
  const next = {
    client_name: fields.client_name ?? fields.client ?? current.client_name,
    client_phone: fields.client_phone ?? fields.phone ?? current.client_phone,
    service: fields.service ?? current.service,
    service_emoji: current.service_emoji || "",
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
  // Re-snapshot the icon only when the service changed (or one is supplied).
  if (fields.service_emoji != null || String(next.service || "") !== String(current.service || "")) {
    next.service_emoji = await resolveBookingServiceEmoji(db, {
      kind: "artist",
      ownerId: current.artist_user_id,
      service: next.service,
      explicit: fields.service_emoji
    }) || (current.source_salon_user_id
      ? await resolveBookingServiceEmoji(db, { kind: "salon", ownerId: current.source_salon_user_id, service: next.service })
      : "");
  }
  await run(db, `
    UPDATE artist_bookings
    SET client_name = $1, client_phone = $2, service = $3, booking_date = $4, time = $5,
        duration_minutes = $6, status = $7, service_emoji = $8, updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
  `, [
    next.client_name || "",
    next.client_phone || "",
    next.service || "",
    next.booking_date || "",
    next.time || "",
    next.duration_minutes,
    next.status || "تازه",
    next.service_emoji || "",
    Number(bookingId)
  ]);
  return get(db, "SELECT * FROM artist_bookings WHERE id = $1", [Number(bookingId)]);
}

/** Soft-cancel (status لغو) — keeps history aligned with salon cancel. */
export async function cancelArtistBookingRow(bookingId, runner = null) {
  return updateArtistBookingRow(bookingId, { status: "لغو" }, runner);
}

/**
 * Slot-conflict check + INSERT for an artist_bookings row, run against whatever
 * transaction is already open on the caller's connection (no BEGIN/COMMIT of its own).
 * Mirrors the salons/bookings.js `updateSalonBookingInTx` convention: callers that
 * already hold a `withTransaction` (e.g. patchSalonBookingWithArtistSync) must pass
 * their transaction `client` as `runner`, to avoid running these queries on a
 * different, non-transactional pooled connection.
 */
export async function addArtistBookingInTx(artistUserId, data, runner = null) {
  const db = runner || (await getDb());
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
  if (await isArtistSlotBlocked(artistUserId, bookingDate, time, durationMinutes, data.excludeBookingId ?? null, db)) {
    return { ok: false, error: "این بازه زمانی با نوبت دیگری تداخل دارد.", code: "SLOT_TAKEN" };
  }

  const sourceSalonUserId = data.sourceSalonUserId || data.source_salon_user_id || null;
  const serviceEmoji = await resolveBookingServiceEmoji(db, {
    kind: "artist",
    ownerId: artistUserId,
    service: data.service,
    explicit: data.serviceEmoji ?? data.service_emoji
  }) || (sourceSalonUserId
    ? await resolveBookingServiceEmoji(db, { kind: "salon", ownerId: sourceSalonUserId, service: data.service })
    : "");
  const info = await run(db, `
    INSERT INTO artist_bookings
      (artist_user_id, client_user_id, source_salon_user_id, client_name, client_phone, service, service_emoji, booking_date, time, duration_minutes, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `, [
    artistUserId,
    data.clientUserId || null,
    sourceSalonUserId,
    data.clientName || data.client || "",
    data.clientPhone || data.phone || "",
    data.service || "",
    serviceEmoji,
    bookingDate,
    time,
    durationMinutes,
    data.status || "تازه"
  ]);
  return {
    ok: true,
    booking: await get(db, "SELECT * FROM artist_bookings WHERE id = $1", [Number(info.rows[0].id)])
  };
}

/**
 * Public entry point: wraps the check+INSERT above in its own `withTransaction`
 * so two truly concurrent connections can't both pass the overlap check before
 * either commits. Use this from call sites that are NOT already inside an open
 * transaction (API routes, syncSalonBookingsForArtist). Call sites already
 * inside a transaction must use `addArtistBookingInTx` (with their tx client)
 * instead.
 */
export async function addArtistBooking(artistUserId, data) {
  return withTransaction(null, (client) => addArtistBookingInTx(artistUserId, data, client));
}

/** Full booking snapshot, camelCased. Live status — callers should re-fetch, never cache. */
export async function getArtistBookingById(bookingId) {
  const db = await getDb();
  const row = await get(db, "SELECT * FROM artist_bookings WHERE id = $1", [bookingId]);
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

export async function getPublicArtist(userId, viewerUserId = null) {
  const user = await getUserProfileById(userId);
  if (!user || user.type !== "artist") return null;
  const [
    posts,
    services,
    followers,
    settings,
    isFollowingViewer,
    isSaved,
    bookedSlots,
    breakTime,
    hours
  ] = await Promise.all([
    listPostsByOwner(userId, null, { publicOnly: Number(viewerUserId || 0) !== Number(userId) }),
    listArtistServices(userId),
    countFollowers(user.id),
    getSettings(user.id),
    viewerUserId ? isFollowing(viewerUserId, user.id) : false,
    viewerUserId ? isProfileSaved(viewerUserId, user.id) : false,
    listArtistBookedSlots(userId),
    getArtistBreak(userId),
    listArtistHoursPublic(userId)
  ]);
  return {
    id: user.id,
    name: user.name,
    role: user.service ? `آرتیست ${user.service}` : "آرتیست",
    area: user.area,
    bio: user.bio,
    avatar: user.avatar ? `/api/media/avatar/${user.id}` : "",
    avatarPosition: user.avatar_position || "",
    service: user.service,
    experienceYears: user.experience_years || "",
    followers,
    // Repo layer stays permissive (GET /api/artist/me calls this with
    // viewerUserId === userId for the artist's own dashboard, which must
    // always see itself regardless of the toggle) -- the public-visibility
    // gate based on this flag lives in the caller (GET /api/artists/[id]
    // route + the SSR /artists/[id] page), same split salons.js uses.
    isPublic: settings.publicPortfolio !== false,
    isFollowing: isFollowingViewer,
    isSaved,
    posts,
    services,
    bookedSlots,
    breakTime,
    hours
  };
}

/**
 * Cursor-paginated when `limit` is given (GET /api/artists); called with no
 * arguments (app/sitemap.js) returns the full, unbounded list -- see
 * salons.js's listSalons() for the identical reasoning (same nextCursor/
 * privacy-filter-after-fetch tradeoff, same why-not-created_at note).
 * Cursors on users.id, artists' own primary key.
 */
export async function listArtists({ cursor, limit } = {}) {
  const db = await getDb();
  const params = [];
  let where = "type = 'artist'";
  if (cursor != null) {
    params.push(Number(cursor));
    where += ` AND id < $${params.length}`;
  }
  let limitClause = "";
  const pageSize = limit ? Math.min(Math.max(Number(limit) || 20, 1), 50) : null;
  if (pageSize) {
    params.push(pageSize + 1);
    limitClause = `LIMIT $${params.length}`;
  }
  const rawRows = await all(db, `
    SELECT id, name, area, service, (avatar <> '' OR avatar_url IS NOT NULL) AS avatar, bio, avatar_position FROM users WHERE ${where} ORDER BY id DESC ${limitClause}
  `, params);
  const hasMore = pageSize ? rawRows.length > pageSize : false;
  const rows = pageSize ? rawRows.slice(0, pageSize) : rawRows;
  const nextCursor = hasMore ? rows[rows.length - 1].id : null;
  // An artist switched to "خصوصی" via تنظیمات → ویترین عمومی آرتیست must be
  // hidden from the public directory, same rule salons.listSalons()
  // already enforces for its equivalent toggle -- this was previously
  // never checked at all for artists. One batched query for every row's
  // settings instead of N round-trips (same fix as listSalons(), see its
  // comment for the round-trip-count reasoning).
  const userIds = rows.map((row) => row.id);
  const settingsRows = userIds.length
    ? await all(db, "SELECT user_id, settings FROM user_settings WHERE user_id = ANY($1)", [userIds])
    : [];
  const settingsByUser = new Map(settingsRows.map((r) => [
    r.user_id,
    r.settings && typeof r.settings === "object" ? r.settings : {}
  ]));
  const visible = rows.filter((row) => {
    const settings = { ...DEFAULT_SETTINGS, ...(settingsByUser.get(row.id) || {}) };
    return settings.publicPortfolio !== false;
  });
  // Media URL, not raw base64 -- see app/api/media/avatar/[userId]/route.js.
  const mapped = visible.map((row) => ({
    ...row,
    avatar: row.avatar ? `/api/media/avatar/${row.id}` : "",
    avatarPosition: row.avatar_position || ""
  }));
  return pageSize ? { artists: mapped, nextCursor } : mapped;
}

/**
 * Card-sized list of independent artists the user has saved (bookmark
 * button on the artist's public profile) — for the "ذخیره‌شده‌ها" tab,
 * alongside saved posts and saved salons. Filters to type = 'artist' so a
 * saved salon (also stored in saved_profiles, target_user_id points at the
 * same users table) never leaks into this list.
 */
export async function listSavedArtistsForUser(userId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT u.id, u.name, u.service, u.area, u.bio, u.avatar_position, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS avatar FROM saved_profiles sp
    JOIN users u ON u.id = sp.target_user_id
    WHERE sp.user_id = $1 AND u.type = 'artist'
    ORDER BY sp.created_at DESC
  `, [userId]);
  const counts = await countFollowCountsMany(rows.map((user) => user.id), db);
  const result = rows.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.service ? `آرتیست ${user.service}` : "آرتیست",
    area: user.area,
    bio: user.bio,
    avatar: user.avatar ? `/api/media/avatar/${user.id}` : "",
    avatarPosition: user.avatar_position || "",
    service: user.service,
    followers: counts.followers.get(Number(user.id)) || 0
  }));
  return result;
}

/** A client cancels their OWN direct artist booking (active and not in the past only). */
export async function cancelArtistBookingByClient(id, clientUserId) {
  const db = await getDb();
  const current = await get(db, "SELECT * FROM artist_bookings WHERE id = $1 AND client_user_id = $2", [id, clientUserId]);
  if (!current) return { ok: false, error: "missing" };
  if (!["تازه", "درخواست", "تایید شده"].includes(current.status)) return { ok: false, error: "inactive" };
  if (isPersianDateKey(current.booking_date) && current.booking_date < formatPersianDateKey(new Date())) {
    return { ok: false, error: "past" };
  }
  await run(db, "UPDATE artist_bookings SET status = 'لغو', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
  return { ok: true, booking: { ...current, status: "لغو" }, artistUserId: current.artist_user_id };
}
