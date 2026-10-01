import { getDb, withTransaction, all, get, run } from "../../connection.js";
import { getUserByPhone } from "../users.js";
import * as artists from "../artists.js";
import { formatPersianDateKey, isPersianDateKey, resolveRollingPersianDateKey } from "../../../../shared/lib/persianCalendar.js";
import {
  normalizeBookingTimeLabel,
  parseServiceDurationMinutes,
  rangesOverlap,
  timeLabelToMinutes
} from "../../../../shared/lib/time.js";
import { normalizePhone } from "./common.js";
import { listSalonServices } from "./services.js";
import { findSalonStaffForBooking, listSalonStaff } from "./staff.js";

async function findBookingClient(row, runner) {
  const rawPhone = String(row.phone || "").trim();
  const phone = normalizePhone(rawPhone);
  if (phone) {
    const byNormalized = await get(runner, `
      SELECT * FROM users
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,
        '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9') = ?
      LIMIT 1
    `, [phone]);
    if (byNormalized) return byNormalized;
    const byRaw = await getUserByPhone(rawPhone, runner);
    if (byRaw) return byRaw;
  }
  const clientName = String(row.client || "").trim();
  if (!clientName) return null;
  return get(runner, `
    SELECT * FROM users WHERE type = 'client' AND name = ? LIMIT 1
  `, [clientName]);
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

async function resolveSalonBookingDuration(salonUserId, data, runner) {
  const explicit = Number(data.durationMinutes || data.duration_minutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(15, explicit);
  if (data.duration) return parseServiceDurationMinutes(data.duration);
  const serviceName = String(data.service || "").trim();
  if (serviceName) {
    const services = await listSalonServices(salonUserId, runner);
    const match = services.find((item) => String(item.name || "").trim() === serviceName);
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

// 'منقضی شده' (auto-expired: salon never responded within the booking-request
// window — see app/lib/bookingExpirySweep.js) must be excluded here exactly
// like 'لغو': an expired request no longer holds its slot, same as an
// actively-cancelled one. It's kept as a DISTINCT status value from 'لغو'
// only so the client-facing UI can tell "salon said no" apart from "nobody
// answered in time" — it must never be treated as "still active" for
// conflict/availability purposes.
async function listActiveDayBookings(db, salonUserId, bookingDate, excludeId = null) {
  if (excludeId == null) {
    return all(db, `
      SELECT id, staff, time, duration_minutes, service, status
      FROM salon_bookings
      WHERE salon_user_id = ? AND booking_date = ? AND status NOT IN ('لغو', 'منقضی شده')
    `, [salonUserId, bookingDate]);
  }
  return all(db, `
    SELECT id, staff, time, duration_minutes, service, status
    FROM salon_bookings
    WHERE salon_user_id = ? AND booking_date = ? AND status NOT IN ('لغو', 'منقضی شده') AND id != ?
  `, [salonUserId, bookingDate, excludeId]);
}

async function findOverlapConflict(db, {
  salonUserId,
  bookingDate,
  time,
  durationMinutes,
  staff,
  excludeId = null
}) {
  const start = timeLabelToMinutes(time);
  const end = start + Math.max(15, Number(durationMinutes) || 60);
  const rows = await listActiveDayBookings(db, salonUserId, bookingDate, excludeId);
  return rows.find((row) => {
    if (!staffScopesConflict(staff, row.staff)) return false;
    const bookedStart = timeLabelToMinutes(row.time);
    const bookedDuration = Math.max(15, Number(row.duration_minutes) || 60);
    const bookedEnd = bookedStart + bookedDuration;
    return rangesOverlap(start, end, bookedStart, bookedEnd);
  }) || null;
}

export async function listSalonBookings(salonUserId) {
  const db = await getDb();
  const staffList = await listSalonStaff(salonUserId, db);
  const staffByName = new Map(
    staffList.map((person) => [String(person.name || "").trim(), person])
  );
  const rows = await all(db, "SELECT * FROM salon_bookings WHERE salon_user_id = ? ORDER BY id DESC", [salonUserId]);

  // findBookingClient runs an unindexed, 10-nested-REPLACE phone-matching
  // scan over the whole users table (falling back to a name lookup) --
  // expensive on its own, and this used to run it once per booking,
  // sequentially, so a salon with many bookings from the same handful of
  // repeat customers re-ran that same expensive scan for every single one
  // of their visits. Look each unique customer (by phone, or by name when
  // there's no phone) up once, concurrently, instead.
  const clientKey = (row) => normalizePhone(row.phone || "") || `name:${String(row.client || "").trim()}`;
  const uniqueKeys = [...new Set(rows.map(clientKey))];
  const clientByKey = new Map(
    await Promise.all(
      uniqueKeys.map(async (key) => [key, await findBookingClient(rows.find((row) => clientKey(row) === key), db)])
    )
  );

  const enrichedRows = rows.map((row) => {
    const client = clientByKey.get(clientKey(row));
    const avatar = client?.avatar ? `/api/media/avatar/${client.id}` : "";
    const avatarPosition = client?.avatar_position || "";
    const staffPerson = staffByName.get(String(row.staff || "").trim()) || null;
    const staffAvatar = staffPerson?.avatar || staffPerson?.staff_avatar || "";
    return {
      ...row,
      client_user_id: client?.id || null,
      client_avatar: avatar,
      clientAvatar: avatar,
      client_avatar_position: avatarPosition,
      clientAvatarPosition: avatarPosition,
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

export async function listClientSalonBookings(user) {
  const db = await getDb();
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
  const rows = await all(db, `
    SELECT b.*, s.name AS salon_name, s.area AS salon_area, s.phone AS salon_phone, s.user_id AS source_salon_user_id, u.avatar AS salon_avatar
    FROM salon_bookings b
    LEFT JOIN salons s ON s.user_id = b.salon_user_id
    LEFT JOIN users u ON u.id = b.salon_user_id
    WHERE ${conditions.join(" OR ")}
    ORDER BY b.id DESC
  `, params);
  return rows.map((row) => ({
    ...row,
    // salon_user_id is now nullable (see migration v34 — deleting a salon
    // account no longer destroys the client's own booking history with it),
    // so a booking can legitimately outlive its salon. Distinguish that from
    // any other reason the join came up empty, matching this codebase's
    // existing "‹thing› حذف‌شده" convention for a deleted parent row.
    salonName: row.salon_name || (row.salon_user_id ? "سالن" : "سالن حذف‌شده"),
    salonArea: row.salon_area || "",
    salonPhone: row.salon_phone || "",
    salonAvatar: row.salon_avatar && row.source_salon_user_id ? `/api/media/avatar/${row.source_salon_user_id}` : "",
    sourceSalonUserId: row.source_salon_user_id || row.salon_user_id
  }));
}

export async function addSalonBooking(salonUserId, data) {
  const bookingDate = resolveRollingPersianDateKey(data.bookingDate || data.booking_date || data.date || "");
  const staff = data.staff || "";
  const time = normalizeBookingTimeLabel(data.time || "");
  const durationMinutes = await resolveSalonBookingDuration(salonUserId, data, await getDb());

  return withTransaction(null, async (db) => {
    const conflict = await findOverlapConflict(db, {
      salonUserId,
      bookingDate,
      time,
      durationMinutes,
      staff
    });
    if (conflict) return { ok: false, error: "conflict" };

    const info = await run(db, `
      INSERT INTO salon_bookings
        (salon_user_id, client_user_id, client, phone, service, staff, booking_date, time, duration_minutes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [
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
    ]);
    return {
      ok: true,
      booking: await get(db, "SELECT * FROM salon_bookings WHERE id = ?", [Number(info.rows[0].id)])
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
async function updateSalonBookingInTx(db, id, salonUserId, current, data) {
  const next = buildSalonBookingNext(current, data);

  if (next.status !== "لغو") {
    const conflict = await findOverlapConflict(db, {
      salonUserId,
      bookingDate: next.booking_date,
      time: next.time,
      durationMinutes: next.duration_minutes,
      staff: next.staff,
      excludeId: id
    });
    if (conflict) return { ok: false, error: "conflict" };
  }

  await run(db, `
    UPDATE salon_bookings
    SET client = ?, phone = ?, service = ?, staff = ?, booking_date = ?, time = ?, duration_minutes = ?, status = ?
    WHERE id = ? AND salon_user_id = ?
  `, [
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
  ]);

  return {
    ok: true,
    booking: await get(db, "SELECT * FROM salon_bookings WHERE id = ?", [id])
  };
}

export async function updateSalonBooking(id, salonUserId, data) {
  const pool = await getDb();
  const current = await get(pool, `
    SELECT * FROM salon_bookings WHERE id = ? AND salon_user_id = ?
  `, [id, salonUserId]);
  if (!current) return { ok: false, error: "missing" };

  return withTransaction(null, (db) => updateSalonBookingInTx(db, id, salonUserId, current, data));
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
export async function patchSalonBookingWithArtistSync(id, salonUserId, data) {
  const pool = await getDb();
  const current = await get(pool, `
    SELECT * FROM salon_bookings WHERE id = ? AND salon_user_id = ?
  `, [id, salonUserId]);
  if (!current) return { ok: false, error: "missing" };

  // Past bookings are review-only. Persian date keys (YYYY-MM-DD, zero
  // padded) sort lexicographically, so a plain string compare is enough.
  if (isPersianDateKey(current.booking_date) && current.booking_date < formatPersianDateKey(new Date())) {
    return { ok: false, error: "past" };
  }

  // An already-expired request (bookingExpirySweep.js) already told the client
  // "the salon never answered in time" and freed its slot — it must not be
  // silently resurrected back to "تایید شده" through the normal confirm PATCH
  // (that would re-serve a client who was already told the request timed out,
  // with zero notification that it happened). Cancel-to-"لغو" is intentionally
  // left alone here — cancelling an already-expired row is a harmless no-op,
  // not a resurrection.
  if (current.status === "منقضی شده" && data.status === "تایید شده") {
    return { ok: false, error: "expired" };
  }

  const oldStaff = await findSalonStaffForBooking(salonUserId, current.staff, current.service, pool);
  const oldArtistId = oldStaff?.artist_user_id ? Number(oldStaff.artist_user_id) : null;
  const oldArtistBooking = oldArtistId
    ? await artists.findLinkedSalonArtistBooking(oldArtistId, salonUserId, current, pool)
    : null;

  try {
    return await withTransaction(null, async (db) => {
      const salonResult = await updateSalonBookingInTx(db, id, salonUserId, current, data);
      if (!salonResult.ok) return salonResult;

      const next = salonResult.booking;
      const newStaff = await findSalonStaffForBooking(salonUserId, next.staff, next.service, db);
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
          await artists.cancelArtistBookingRow(oldArtistBooking.id, db);
          if (oldArtistId) linkedArtistIds.push(oldArtistId);
        }
      } else if (oldArtistId && newArtistId && oldArtistId === newArtistId) {
        if (oldArtistBooking) {
          if (await artists.isArtistSlotBlocked(
            newArtistId,
            next.booking_date,
            next.time,
            next.duration_minutes,
            oldArtistBooking.id,
            db
          )) {
            failArtist("ARTIST_SLOT_TAKEN", "این ساعت برای آرتیست قبلاً رزرو شده است.");
          }
          await artists.updateArtistBookingRow(oldArtistBooking.id, {
            client: next.client,
            phone: next.phone,
            service: next.service,
            booking_date: next.booking_date,
            time: next.time,
            duration_minutes: next.duration_minutes,
            status: next.status || "تازه"
          }, db);
        } else {
          const created = await artists.addArtistBookingInTx(newArtistId, {
            client: next.client,
            phone: next.phone,
            service: next.service,
            bookingDate: next.booking_date,
            time: next.time,
            durationMinutes: next.duration_minutes,
            sourceSalonUserId: salonUserId,
            status: next.status || "تازه"
          }, db);
          if (!created.ok) failArtist(created.code || "ARTIST_BOOKING_FAILED", created.error);
        }
        linkedArtistIds.push(newArtistId);
      } else {
        if (oldArtistBooking) {
          await artists.cancelArtistBookingRow(oldArtistBooking.id, db);
          if (oldArtistId) linkedArtistIds.push(oldArtistId);
        }
        if (newArtistId) {
          const created = await artists.addArtistBookingInTx(newArtistId, {
            client: next.client,
            phone: next.phone,
            service: next.service,
            bookingDate: next.booking_date,
            time: next.time,
            durationMinutes: next.duration_minutes,
            sourceSalonUserId: salonUserId,
            status: next.status || "تازه"
          }, db);
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

export async function cancelSalonBooking(id, salonUserId) {
  return patchSalonBookingWithArtistSync(id, salonUserId, { status: "لغو" });
}
