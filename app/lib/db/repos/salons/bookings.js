import { getDb, withTransaction } from "../../connection.js";
import { getUserByPhone } from "../users.js";
import * as artists from "../artists.js";
import { resolveRollingPersianDateKey } from "../../../../shared/lib/persianCalendar.js";
import {
  normalizeBookingTimeLabel,
  parseServiceDurationMinutes,
  rangesOverlap,
  timeLabelToMinutes
} from "../../../../shared/lib/time.js";
import { normalizePhone } from "./common.js";
import { listSalonServices } from "./services.js";
import { findSalonStaffForBooking, listSalonStaff } from "./staff.js";

function findBookingClient(row) {
  const rawPhone = String(row.phone || "").trim();
  const phone = normalizePhone(rawPhone);
  if (phone) {
    const byNormalized = getDb().prepare(`
      SELECT * FROM users
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,
        '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9') = ?
      LIMIT 1
    `).get(phone);
    if (byNormalized) return byNormalized;
    const byRaw = getUserByPhone(rawPhone);
    if (byRaw) return byRaw;
  }
  const clientName = String(row.client || "").trim();
  if (!clientName) return null;
  return getDb().prepare(`
    SELECT * FROM users WHERE type = 'client' AND name = ? LIMIT 1
  `).get(clientName);
}
function buildClientVisitLevels(historyRows) {
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

function sameSalonClient(a, b) {
  if (!a || !b) return false;
  const aUserId = a.client_user_id || a.clientUserId || null;
  const bUserId = b.client_user_id || b.clientUserId || null;
  if (aUserId && bUserId && String(aUserId) === String(bUserId)) return true;
  const aPhone = normalizePhone(a.phone || a.client_phone || "");
  const bPhone = normalizePhone(b.phone || b.client_phone || "");
  if (aPhone && bPhone && aPhone === bPhone) return true;
  const aName = String(a.client || a.client_name || "").trim();
  const bName = String(b.client || b.client_name || "").trim();
  return Boolean(aName && bName && aName === bName);
}

function resolveSalonBookingDuration(salonUserId, data) {
  const explicit = Number(data.durationMinutes || data.duration_minutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(15, explicit);
  if (data.duration) return parseServiceDurationMinutes(data.duration);
  const serviceName = String(data.service || "").trim();
  if (serviceName) {
    const match = listSalonServices(salonUserId).find((item) => String(item.name || "").trim() === serviceName);
    if (match?.duration) return parseServiceDurationMinutes(match.duration);
  }
  return 60;
}

/**
 * Staff conflict policy (product decision):
 * - staff="" (unassigned): conflicts with ANY overlapping non-cancelled booking that day
 *   (same as legacy exact-time SQL when staff was empty).
 * - staff set: conflicts only with overlapping bookings for that same staff name.
 */
function staffScopesConflict(newStaff, existingStaff) {
  const next = String(newStaff || "").trim();
  const prev = String(existingStaff || "").trim();
  if (!next) return true;
  return next === prev;
}

function listActiveDayBookings(db, salonUserId, bookingDate, excludeId = null) {
  if (excludeId == null) {
    return db.prepare(`
      SELECT id, staff, time, duration_minutes, service, status
      FROM salon_bookings
      WHERE salon_user_id = ? AND booking_date = ? AND status != 'لغو'
    `).all(salonUserId, bookingDate);
  }
  return db.prepare(`
    SELECT id, staff, time, duration_minutes, service, status
    FROM salon_bookings
    WHERE salon_user_id = ? AND booking_date = ? AND status != 'لغو' AND id != ?
  `).all(salonUserId, bookingDate, excludeId);
}

function findOverlapConflict(db, {
  salonUserId,
  bookingDate,
  time,
  durationMinutes,
  staff,
  excludeId = null
}) {
  const start = timeLabelToMinutes(time);
  const end = start + Math.max(15, Number(durationMinutes) || 60);
  const rows = listActiveDayBookings(db, salonUserId, bookingDate, excludeId);
  return rows.find((row) => {
    if (!staffScopesConflict(staff, row.staff)) return false;
    const bookedStart = timeLabelToMinutes(row.time);
    const bookedDuration = Math.max(15, Number(row.duration_minutes) || 60);
    const bookedEnd = bookedStart + bookedDuration;
    return rangesOverlap(start, end, bookedStart, bookedEnd);
  }) || null;
}

export function listSalonBookings(salonUserId) {
  const staffByName = new Map(
    listSalonStaff(salonUserId).map((person) => [String(person.name || "").trim(), person])
  );
  const rows = getDb().prepare("SELECT * FROM salon_bookings WHERE salon_user_id = ? ORDER BY id DESC").all(salonUserId);
  const enrichedRows = rows.map((row) => {
    const client = findBookingClient(row);
    const avatar = client?.avatar || "";
    const staffPerson = staffByName.get(String(row.staff || "").trim()) || null;
    const staffAvatar = staffPerson?.avatar || staffPerson?.staff_avatar || "";
    return {
      ...row,
      client_user_id: client?.id || null,
      client_avatar: avatar,
      clientAvatar: avatar,
      staff_avatar: staffAvatar,
      staffAvatar,
      staff_artist_user_id: staffPerson?.artist_user_id || null,
      staff_has_artist_profile: Boolean(staffPerson?.has_artist_profile)
    };
  });

  return enrichedRows.map((row) => {
    const history = enrichedRows.filter((item) => sameSalonClient(item, row));
    const visits = buildClientVisitLevels(history);
    return {
      ...row,
      visits,
      visit_count: visits.filter((level) => level > 0).length
    };
  });
}

export function listClientSalonBookings(user) {
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
    conditions.push(`REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(b.phone,
      '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9') = ?`);
    params.push(phone);
  }
  if (name) {
    conditions.push("b.client = ?");
    params.push(name);
  }
  return getDb().prepare(`
    SELECT b.*, s.name AS salon_name, s.area AS salon_area, s.phone AS salon_phone, s.user_id AS source_salon_user_id, u.avatar AS salon_avatar
    FROM salon_bookings b
    LEFT JOIN salons s ON s.user_id = b.salon_user_id
    LEFT JOIN users u ON u.id = b.salon_user_id
    WHERE ${conditions.join(" OR ")}
    ORDER BY b.id DESC
  `).all(...params).map((row) => ({
    ...row,
    salonName: row.salon_name || "سالن",
    salonArea: row.salon_area || "",
    salonPhone: row.salon_phone || "",
    salonAvatar: row.salon_avatar || "",
    sourceSalonUserId: row.source_salon_user_id || row.salon_user_id
  }));
}

export function addSalonBooking(salonUserId, data) {
  const db = getDb();
  const bookingDate = resolveRollingPersianDateKey(data.bookingDate || data.booking_date || data.date || "");
  const staff = data.staff || "";
  const time = normalizeBookingTimeLabel(data.time || "");
  const durationMinutes = resolveSalonBookingDuration(salonUserId, data);

  return withTransaction(db, () => {
    const conflict = findOverlapConflict(db, {
      salonUserId,
      bookingDate,
      time,
      durationMinutes,
      staff
    });
    if (conflict) return { ok: false, error: "conflict" };

    const info = db.prepare(`
      INSERT INTO salon_bookings
        (salon_user_id, client_user_id, client, phone, service, staff, booking_date, time, duration_minutes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      salonUserId,
      data.clientUserId || data.client_user_id || null,
      data.client || "",
      data.phone || "",
      data.service || "",
      staff,
      bookingDate,
      time,
      durationMinutes,
      data.status || "تازه"
    );
    return {
      ok: true,
      booking: db.prepare("SELECT * FROM salon_bookings WHERE id = ?").get(Number(info.lastInsertRowid))
    };
  });
}

function buildSalonBookingNext(current, data) {
  const next = {
    client: data.client ?? current.client,
    phone: data.phone ?? current.phone,
    service: data.service ?? current.service,
    staff: data.staff ?? current.staff,
    booking_date: resolveRollingPersianDateKey(data.booking_date ?? data.bookingDate ?? data.date ?? current.booking_date),
    time: normalizeBookingTimeLabel(data.time ?? current.time),
    duration_minutes: Number(data.durationMinutes ?? data.duration_minutes ?? current.duration_minutes) || 60,
    status: data.status ?? current.status
  };
  if (data.duration && data.durationMinutes == null && data.duration_minutes == null) {
    next.duration_minutes = parseServiceDurationMinutes(data.duration);
  }
  next.duration_minutes = Math.max(15, Number(next.duration_minutes) || 60);
  return next;
}

/** Salon-row update inside an open transaction (no BEGIN/COMMIT of its own). */
function updateSalonBookingInTx(db, id, salonUserId, current, data) {
  const next = buildSalonBookingNext(current, data);

  if (next.status !== "لغو") {
    const conflict = findOverlapConflict(db, {
      salonUserId,
      bookingDate: next.booking_date,
      time: next.time,
      durationMinutes: next.duration_minutes,
      staff: next.staff,
      excludeId: id
    });
    if (conflict) return { ok: false, error: "conflict" };
  }

  db.prepare(`
    UPDATE salon_bookings
    SET client = ?, phone = ?, service = ?, staff = ?, booking_date = ?, time = ?, duration_minutes = ?, status = ?
    WHERE id = ? AND salon_user_id = ?
  `).run(
    next.client || "",
    next.phone || "",
    next.service || "",
    next.staff || "",
    next.booking_date || "",
    next.time || "",
    next.duration_minutes,
    next.status || "تازه",
    id,
    salonUserId
  );

  return {
    ok: true,
    booking: db.prepare("SELECT * FROM salon_bookings WHERE id = ?").get(id)
  };
}

export function updateSalonBooking(id, salonUserId, data) {
  const db = getDb();
  const current = db.prepare(`
    SELECT * FROM salon_bookings WHERE id = ? AND salon_user_id = ?
  `).get(id, salonUserId);
  if (!current) return { ok: false, error: "missing" };

  return withTransaction(db, () => updateSalonBookingInTx(db, id, salonUserId, current, data));
}

/**
 * PATCH-path update: salon_bookings + linked artist_bookings in one atomic transaction.
 *
 * Staff-link policy:
 * - Same linked artist → update mirrored artist row (time/date/service/status/…).
 * - Cancel → soft-cancel mirrored artist row (status لغو).
 * - Linked A → unlinked staff → soft-cancel A's artist booking (no delete).
 * - Linked A → linked B → soft-cancel A, create on B (artist slot conflict rolls back both tables).
 * - Unlinked → linked B → create on B.
 */
export function patchSalonBookingWithArtistSync(id, salonUserId, data) {
  const db = getDb();
  const current = db.prepare(`
    SELECT * FROM salon_bookings WHERE id = ? AND salon_user_id = ?
  `).get(id, salonUserId);
  if (!current) return { ok: false, error: "missing" };

  const oldStaff = findSalonStaffForBooking(salonUserId, current.staff, current.service);
  const oldArtistId = oldStaff?.artist_user_id ? Number(oldStaff.artist_user_id) : null;
  const oldArtistBooking = oldArtistId
    ? artists.findLinkedSalonArtistBooking(oldArtistId, salonUserId, current)
    : null;

  try {
    return withTransaction(db, () => {
      const salonResult = updateSalonBookingInTx(db, id, salonUserId, current, data);
      if (!salonResult.ok) return salonResult;

      const next = salonResult.booking;
      const newStaff = findSalonStaffForBooking(salonUserId, next.staff, next.service);
      const newArtistId = newStaff?.artist_user_id ? Number(newStaff.artist_user_id) : null;
      const linkedArtistIds = [];
      const cancelled = next.status === "لغو";

      function failArtist(code, error) {
        const err = new Error(error || code);
        err.code = code;
        err.rollbackArtist = true;
        throw err;
      }

      // Isolated-test hook: simulate mid-flight failure after salon row write (must roll back both).
      if (
        process.env.ZIBABAN_BOOKING_PATCH_SYNC_TEST === "1"
        && data.__testForceFail === true
      ) {
        failArtist("TEST_FORCE_FAIL", "forced patch sync rollback");
      }

      if (cancelled) {
        if (oldArtistBooking) {
          artists.cancelArtistBookingRow(oldArtistBooking.id);
          if (oldArtistId) linkedArtistIds.push(oldArtistId);
        }
      } else if (oldArtistId && newArtistId && oldArtistId === newArtistId) {
        if (oldArtistBooking) {
          if (artists.isArtistSlotBlocked(
            newArtistId,
            next.booking_date,
            next.time,
            next.duration_minutes,
            oldArtistBooking.id
          )) {
            failArtist("ARTIST_SLOT_TAKEN", "این ساعت برای آرتیست قبلاً رزرو شده است.");
          }
          artists.updateArtistBookingRow(oldArtistBooking.id, {
            client: next.client,
            phone: next.phone,
            service: next.service,
            booking_date: next.booking_date,
            time: next.time,
            duration_minutes: next.duration_minutes,
            status: next.status || "تازه"
          });
        } else {
          const created = artists.addArtistBookingInTx(newArtistId, {
            client: next.client,
            phone: next.phone,
            service: next.service,
            bookingDate: next.booking_date,
            time: next.time,
            durationMinutes: next.duration_minutes,
            sourceSalonUserId: salonUserId,
            status: next.status || "تازه"
          });
          if (!created.ok) failArtist(created.code || "ARTIST_BOOKING_FAILED", created.error);
        }
        linkedArtistIds.push(newArtistId);
      } else {
        if (oldArtistBooking) {
          artists.cancelArtistBookingRow(oldArtistBooking.id);
          if (oldArtistId) linkedArtistIds.push(oldArtistId);
        }
        if (newArtistId) {
          const created = artists.addArtistBookingInTx(newArtistId, {
            client: next.client,
            phone: next.phone,
            service: next.service,
            bookingDate: next.booking_date,
            time: next.time,
            durationMinutes: next.duration_minutes,
            sourceSalonUserId: salonUserId,
            status: next.status || "تازه"
          });
          if (!created.ok) failArtist(created.code || "ARTIST_BOOKING_FAILED", created.error);
          linkedArtistIds.push(newArtistId);
        }
      }

      const uniqueIds = [...new Set(linkedArtistIds.filter(Boolean))];
      return {
        ok: true,
        booking: next,
        linkedArtistIds: uniqueIds,
        linkedArtistId: uniqueIds.length ? uniqueIds[uniqueIds.length - 1] : null
      };
    });
  } catch (error) {
    if (error?.rollbackArtist) {
      return {
        ok: false,
        error: "artist_conflict",
        code: error.code || "ARTIST_SLOT_TAKEN",
        message: error.message
      };
    }
    throw error;
  }
}

export function cancelSalonBooking(id, salonUserId) {
  return patchSalonBookingWithArtistSync(id, salonUserId, { status: "لغو" });
}

/** Full booking snapshot for a booking-card chat bubble. Live status — callers should re-fetch, never cache. */
export function getSalonBookingById(bookingId) {
  const row = getDb().prepare("SELECT * FROM salon_bookings WHERE id = ?").get(bookingId);
  if (!row) return null;
  return {
    id: row.id,
    salonUserId: row.salon_user_id,
    clientUserId: row.client_user_id,
    client: row.client,
    phone: row.phone,
    service: row.service,
    staff: row.staff,
    bookingDate: row.booking_date,
    time: row.time,
    durationMinutes: row.duration_minutes,
    status: row.status,
    createdAt: row.created_at
  };
}
