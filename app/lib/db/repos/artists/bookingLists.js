/** The lists of an artist's bookings: the artist's own (with each client's history beside them) and a client's. */
import { getDb, all, get } from "../../connection.js";
import { clientReliability } from "../reliability.js";
import { getUserLiteById } from "../users.js";
import { buildClientHistoryLookup, visitLevels } from "../clientHistory.js";
import { clientBookingMatch, clientVisibleStatus } from "../../clientMatch.js";
import { publicLocation } from "../../../location.js";
import { proposalView } from "../../../../shared/lib/providerRules.js";

export async function listArtistBookings(artistUserId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT
      b.*,
      salon.name AS source_salon_name,
      (salon.avatar <> '' OR salon.avatar_url IS NOT NULL) AS source_salon_avatar,
      salon.area AS source_salon_area,
      COALESCE(NULLIF(ps.name, ''), pu.name) AS place_salon_name
    FROM artist_bookings b
    LEFT JOIN users salon ON salon.id = b.source_salon_user_id
    LEFT JOIN users pu ON pu.id = b.place_salon_user_id
    LEFT JOIN salons ps ON ps.user_id = b.place_salon_user_id
    WHERE b.artist_user_id = $1
    ORDER BY b.id DESC
    LIMIT 1500
  `, [artistUserId]);

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
  const records = await clientReliability(rows.map((row) => row.client_user_id), db);
  const result = rows.map((row, index) => {
    const client = row.client_user_id ? clientsById.get(row.client_user_id) || null : null;
    const history = historyOf(index);
    const visits = visitLevels(history);
    // Which other artist the client picked as a backup, and where an unanswered request went, is the
    // client's business only.
    const { fallback_artist_user_id: _fallback, moved_to_booking_id: _movedTo, ...own } = row;
    return {
      ...own,
      proposal: proposalView(row),
      visits,
      visit_count: visits.filter((level) => level > 0).length,
      // The client's came / «نیومد» record across all of frfro (owner's decision of 2026-10-27).
      reliability: row.client_user_id ? records.get(Number(row.client_user_id)) || null : null,
      sourceSalon: row.source_salon_user_id
        ? {
            id: row.source_salon_user_id,
            name: row.source_salon_name || "",
            avatar: row.source_salon_avatar ? `/api/media/avatar/${row.source_salon_user_id}` : "",
            area: row.source_salon_area || ""
          }
        : null,
      // A direct booking the artist receives at their workplace salon (artist_workplace); the artist still answers it.
      placeSalon: row.place_salon_user_id ? { id: row.place_salon_user_id, name: row.place_salon_name || "سالن" } : null,
      clientProfile: client
        ? {
            id: client.id,
            name: client.name || row.client_name || "",
            phone: client.phone || row.client_phone || "",
            area: client.area || "",
            avatar: client.avatar ? `/api/media/avatar/${client.id}` : "",
            type: client.type || "client"
          }
        : {
            id: null,
            name: row.client_name || "",
            phone: row.client_phone || "",
            area: "",
            avatar: "",
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
/** A booking held at the artist's workplace salon tells its client so from the start (they saw it before booking). */
const placeShown = (row) => Boolean(row.place_salon_user_id);

export async function listClientArtistBookings(user) {
  const db = await getDb();
  const match = clientBookingMatch(user);
  if (!match.sql) return [];
  // The backup artist's name, and for a request that was moved, the artist it went to / came from
  // (the columns are made by salons/bookings.js ensureBookingPartsColumns, run by the route first).
  const rows = await all(db, `
    SELECT b.*, u.name AS artist_name, u.area AS artist_area, u.address_detail AS artist_detail, u.geo_lat AS artist_lat, u.geo_lng AS artist_lng, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS artist_avatar, u.phone AS artist_phone,
      fu.name AS fallback_name, tu.name AS moved_to_name, ou.name AS moved_from_name,
      COALESCE(NULLIF(ps.name, ''), pu.name) AS place_salon_name, pu.area AS place_salon_area, pu.address_detail AS place_salon_detail, pu.geo_lat AS place_salon_lat, pu.geo_lng AS place_salon_lng, pu.phone AS place_salon_phone
    FROM artist_bookings b
    LEFT JOIN users u ON u.id = b.artist_user_id
    LEFT JOIN users pu ON pu.id = b.place_salon_user_id
    LEFT JOIN salons ps ON ps.user_id = b.place_salon_user_id
    LEFT JOIN users fu ON fu.id = b.fallback_artist_user_id
    LEFT JOIN artist_bookings tb ON tb.id = b.moved_to_booking_id
    LEFT JOIN users tu ON tu.id = tb.artist_user_id
    LEFT JOIN artist_bookings ob ON ob.id = b.moved_from_booking_id
    LEFT JOIN users ou ON ou.id = ob.artist_user_id
    -- source_salon_user_id IS NOT NULL = the artist-calendar copy of a SALON booking; the client
    -- already has that booking from listClientSalonBookings, so listing it again showed every
    -- salon-with-staff booking twice, once per table, each with its own (diverging) status.
    WHERE b.source_salon_user_id IS NULL AND ${match.sql}
    ORDER BY b.id DESC
  `, match.params);
  return rows.map((row) => ({
    ...row,
    status: clientVisibleStatus(row.status, "artist"),
    proposal: proposalView(row),
    placeGone: !row.artist_user_id || row.cancelled_by === "gone",
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
    // Received at a salon: «کجا» is the salon's address; the name stays the artist's (the client booked a person).
    salonArea: (placeShown(row) ? row.place_salon_area : row.artist_area) || "",
    salon_area: (placeShown(row) ? row.place_salon_area : row.artist_area) || "",
    // Where to go: the salon's place when it is held there, else the artist's own (the pin the artist set in settings).
    placeLocation: placeShown(row)
      ? publicLocation({ area: row.place_salon_area, address_detail: row.place_salon_detail, geo_lat: row.place_salon_lat, geo_lng: row.place_salon_lng })
      : publicLocation({ area: row.artist_area, address_detail: row.artist_detail, geo_lat: row.artist_lat, geo_lng: row.artist_lng }),
    placeSalonName: placeShown(row) ? row.place_salon_name || "سالن" : "",
    placeSalonUserId: placeShown(row) ? row.place_salon_user_id : null,
    salonAvatar: row.artist_avatar && row.artist_user_id ? `/api/media/avatar/${row.artist_user_id}` : "",
    salon_avatar: row.artist_avatar && row.artist_user_id ? `/api/media/avatar/${row.artist_user_id}` : "",
    salonPhone: row.artist_phone || "",
    salon_phone: row.artist_phone || "",
    bookingSource: "artist",
    artistUserId: row.artist_user_id,
    sourceArtistUserId: row.artist_user_id
  }));
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
