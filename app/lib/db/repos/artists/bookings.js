/**
 * Writing an artist's bookings (artist_bookings): a direct booking with the artist, and the calendar copy of a salon
 * booking that this artist does. Reading "is the artist free" lives in ./calendar.js.
 */
import { getDb, withTransaction, all, get, run } from "../../connection.js";
import { lockArtistDays, lockClientRequests } from "../../locks.js";
import { TOO_MANY_OPEN_CODE, TOO_MANY_OPEN_MESSAGE, findIdenticalArtistRequest, openRequestLimitReached } from "../openRequests.js";
import { resolveBookingServiceEmoji } from "../serviceEmoji.js";
import { clientBookingMatch } from "../../clientMatch.js";
import { formatPersianDateKey, isPersianDateKey, resolveRollingPersianDateKey } from "../../../../shared/lib/persianCalendar.js";
import { minutesUntilSlotStart } from "../../../../shared/lib/bookingWindow.js";
import { normalizeBookingTimeLabel, parseBookingTime, parseServiceDurationMinutes } from "../../../../shared/lib/time.js";
import { ARTIST_LIVE, SQL_ARTIST_LIVE } from "../../../../shared/lib/bookingStates.js";
import { isArtistSlotBlocked } from "./calendar.js";

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
      durationMinutes: booking.duration_minutes,
      sourceSalonUserId: booking.salon_user_id,
      status: booking.status || "تازه"
    });
    if (result.ok) synced += 1;
  }
  return { synced };
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
  const time = parseBookingTime(String(data.time ?? ""));
  // Never shorter than 15 minutes nor longer than half a day, whatever the caller sent.
  const durationMinutes = Math.min(720, Math.max(
    15,
    Number(data.durationMinutes || data.duration_minutes)
      || parseServiceDurationMinutes(data.duration)
      || 60
  ));
  if (!bookingDate || !time) {
    return { ok: false, error: "روز و ساعت رو انتخاب کن.", code: "MISSING_SLOT" };
  }
  // Held until the surrounding transaction ends, so two requests for this artist's day are checked one after the other.
  await lockArtistDays(db, [artistUserId], bookingDate);
  if (await isArtistSlotBlocked(artistUserId, bookingDate, time, durationMinutes, data.excludeBookingId ?? null, db)) {
    return { ok: false, error: "این ساعت با یه نوبت دیگه‌ت هم‌پوشونی داره.", code: "SLOT_TAKEN" };
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
      (artist_user_id, client_user_id, source_salon_user_id, client_name, client_phone, service, service_emoji, booking_date, time, duration_minutes, status, place_salon_user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
    data.status || "تازه",
    // The salon a direct booking is received at (shared/lib/artistPlace.js); null = the artist's own place.
    Number(data.placeSalonUserId || 0) || null
  ]);
  // A share of a multi-service salon booking points straight at it (the column is made by
  // salons/bookings.js ensureBookingPartsColumns before any caller passes this).
  if (data.salonBookingId) {
    await run(db, "UPDATE artist_bookings SET salon_booking_id = $1 WHERE id = $2", [Number(data.salonBookingId), Number(info.rows[0].id)]);
  }
  // How long a client's request waits (60, or null = until its appointment), its backup artist and the
  // request it was moved from (columns made the same way, migration 040).
  if (data.waitMinutes !== undefined || data.fallbackArtistUserId || data.movedFromBookingId) {
    await run(db, `
      UPDATE artist_bookings SET wait_minutes = $1, fallback_artist_user_id = $2, moved_from_booking_id = $3 WHERE id = $4
    `, [
      data.waitMinutes === undefined ? 60 : data.waitMinutes,
      Number(data.fallbackArtistUserId || 0) || null,
      Number(data.movedFromBookingId || 0) || null,
      Number(info.rows[0].id)
    ]);
  }
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
  return withTransaction(null, async (client) => {
    // A client's own request (not the artist's entry, not a salon's calendar copy): the same request sent twice is
    // one request (the existing one comes back as it is), and one client has only a few open at once.
    const clientUserId = Number(data.clientUserId || 0);
    if (data.clientRequest && clientUserId) {
      await lockClientRequests(client, clientUserId);
      const bookingDate = resolveRollingPersianDateKey(data.bookingDate || data.booking_date || data.date || "");
      const time = parseBookingTime(String(data.time ?? ""));
      if (bookingDate && time) {
        const same = await findIdenticalArtistRequest(client, {
          artistUserId,
          clientUserId,
          bookingDate,
          time,
          service: data.service || ""
        });
        if (same) return { ok: true, booking: same, duplicate: true };
      }
      if (await openRequestLimitReached(client, clientUserId, { kind: "artist", id: artistUserId })) {
        return { ok: false, error: TOO_MANY_OPEN_MESSAGE, code: TOO_MANY_OPEN_CODE };
      }
    }
    return addArtistBookingInTx(artistUserId, data, client);
  });
}

/** A client cancels their OWN direct artist booking (active and not in the past only). */
export async function cancelArtistBookingByClient(id, client) {
  const db = await getDb();
  // Found by the rule the client's own list uses, so a booking they can see is one they can cancel.
  const user = typeof client === "object" && client ? client : { id: client };
  const match = clientBookingMatch(user, { alias: "b", startAt: 2 });
  const current = match.sql
    ? await get(db, `SELECT b.* FROM artist_bookings b WHERE b.id = $1 AND b.source_salon_user_id IS NULL AND ${match.sql}`, [id, ...match.params])
    : null;
  if (!current) return { ok: false, error: "missing" };
  if (!ARTIST_LIVE.includes(current.status)) return { ok: false, error: "inactive" };
  if (isPersianDateKey(current.booking_date) && current.booking_date < formatPersianDateKey(new Date())) {
    return { ok: false, error: "past" };
  }
  const until = minutesUntilSlotStart(current.booking_date, current.time);
  if (until !== null && until <= 0) return { ok: false, error: "past" };
  // Conditional on it still being active: the sweep or the artist may have closed it since the read above.
  const changed = await run(db, `
    UPDATE artist_bookings SET status = 'لغو', cancelled_by = 'client', proposal_date = '', proposal_time = '', proposal_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND status IN (${SQL_ARTIST_LIVE})
  `, [id]);
  if (!changed.rowCount) return { ok: false, error: "inactive" };
  return { ok: true, booking: { ...current, status: "لغو" }, artistUserId: current.artist_user_id };
}
