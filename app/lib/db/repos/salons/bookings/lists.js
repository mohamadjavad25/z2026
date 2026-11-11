/** The two lists of salon bookings: the salon's own (with each client's history beside them) and a client's. */
import { getDb, all, get } from "../../../connection.js";
import { clientReliability } from "../../reliability.js";
import { buildClientHistoryLookup, visitLevels } from "../../clientHistory.js";
import { clientBookingMatch, clientVisibleStatus } from "../../../clientMatch.js";
import { publicLocation } from "../../../../location.js";
import { proposalView } from "../../../../../shared/lib/providerRules.js";
import { normalizePhone } from "../common.js";
import { listSalonStaff } from "../staff.js";
import { ensureBookingPartsColumns } from "./columns.js";

// Safety cap: a salon's dashboard never needs its entire lifetime of rows, and an
// unbounded SELECT grows linearly with every booking ever made.
const LIST_BOOKINGS_LIMIT = 1500;

async function findBookingClient(row, runner) {
  const rawPhone = String(row.phone || "").trim();
  const phone = normalizePhone(rawPhone);
  if (phone) {
    // users.phone is already normalized (Persian/Arabic digits -> ASCII) at
    // write time in app/api/auth/register/route.js, so a plain equality
    // check is correct here and, unlike a REPLACE()-wrapped comparison,
    // can use the column's own UNIQUE index.
    const byNormalized = await get(runner, `
      SELECT id, name, (avatar <> '' OR avatar_url IS NOT NULL) AS avatar, avatar_position FROM users WHERE phone = $1 LIMIT 1
    `, [phone]);
    if (byNormalized) return byNormalized;
    const byRaw = await get(runner, `
      SELECT id, name, (avatar <> '' OR avatar_url IS NOT NULL) AS avatar, avatar_position FROM users WHERE phone = $1 LIMIT 1
    `, [rawPhone]);
    if (byRaw) return byRaw;
  }
  // Only the phone ties a booking to an account. A name is typed by anyone, so it never does (owner's decision 2026-10-22).
  return null;
}

export async function listSalonBookings(salonUserId) {
  await ensureBookingPartsColumns();
  const db = await getDb();
  const staffList = await listSalonStaff(salonUserId, db);
  const staffByName = new Map(
    staffList.map((person) => [String(person.name || "").trim(), person])
  );
  const rows = await all(db, `SELECT * FROM salon_bookings WHERE salon_user_id = $1 ORDER BY id DESC LIMIT ${LIST_BOOKINGS_LIMIT}`, [salonUserId]);

  // findBookingClient runs an unindexed, 10-nested-REPLACE phone-matching
  // scan over the whole users table (a name never counts) --
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
    // Which other salon the client picked as a backup, and where an unanswered request went, is the
    // client's business only.
    const { fallback_salon_user_id: _fallback, moved_to_booking_id: _movedTo, ...own } = row;
    return {
      ...own,
      proposal: proposalView(row),
      client_user_id: row.client_user_id || client?.id || null,
      // The account's own name (the booking's `client` is what the salon typed): the customers list uses it as the main
      // name of a number that has a frfro account (owner's decision 2026-10-31).
      client_account_name: client?.name || "",
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

  const historyOf = buildClientHistoryLookup(enrichedRows, (row) => ({
    userId: row.client_user_id || null,
    phone: normalizePhone(row.phone || row.client_phone || ""),
    name: String(row.client || row.client_name || "").trim()
  }));
  // The client's came / «نیومد» record across all of frfro, beside their name (owner's decision of 2026-10-27).
  const records = await clientReliability(enrichedRows.map((row) => row.client_user_id), db);
  return enrichedRows.map((row, index) => {
    const history = historyOf(index);
    const visits = visitLevels(history);
    return {
      ...row,
      visits,
      visit_count: visits.filter((level) => level > 0).length,
      reliability: row.client_user_id ? records.get(Number(row.client_user_id)) || null : null
    };
  });
}

export async function listClientSalonBookings(user) {
  await ensureBookingPartsColumns();
  const db = await getDb();
  const match = clientBookingMatch(user);
  if (!match.sql) return [];
  // The backup salon's name, and for a request that was moved, the salon it went to / came from.
  const rows = await all(db, `
    SELECT b.*, s.name AS salon_name, s.area AS salon_area, s.phone AS salon_phone, s.user_id AS source_salon_user_id, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS salon_avatar,
      u.geo_lat AS salon_geo_lat, u.geo_lng AS salon_geo_lng,
      fs.name AS fallback_name, ts.name AS moved_to_name, os.name AS moved_from_name
    FROM salon_bookings b
    LEFT JOIN salons s ON s.user_id = b.salon_user_id
    LEFT JOIN users u ON u.id = b.salon_user_id
    LEFT JOIN salons fs ON fs.user_id = b.fallback_salon_user_id
    LEFT JOIN salon_bookings tb ON tb.id = b.moved_to_booking_id
    LEFT JOIN salons ts ON ts.user_id = tb.salon_user_id
    LEFT JOIN salon_bookings ob ON ob.id = b.moved_from_booking_id
    LEFT JOIN salons os ON os.user_id = ob.salon_user_id
    WHERE ${match.sql}
    ORDER BY b.id DESC
  `, match.params);
  return rows.map((row) => ({
    ...row,
    status: clientVisibleStatus(row.status, "salon"),
    // A proposal from the salon on this confirmed booking (another time / artist) and whether the salon has left frfro.
    proposal: proposalView(row),
    placeGone: !row.salon_user_id || row.cancelled_by === "gone",
    // salon_user_id is now nullable (see migration v34 — deleting a salon
    // account no longer destroys the client's own booking history with it),
    // so a booking can legitimately outlive its salon. Distinguish that from
    // any other reason the join came up empty, matching this codebase's
    // existing "‹thing› حذف‌شده" convention for a deleted parent row.
    salonName: row.salon_name || (row.salon_user_id ? "سالن" : "سالن حذف‌شده"),
    salonArea: row.salon_area || "",
    // The salon's pin for «کجا» in the client's booking details (the same pin as on its public page).
    placeLocation: publicLocation({ area: row.salon_area, geo_lat: row.salon_geo_lat, geo_lng: row.salon_geo_lng }),
    salonPhone: row.salon_phone || "",
    salonAvatar: row.salon_avatar && row.source_salon_user_id ? `/api/media/avatar/${row.source_salon_user_id}` : "",
    sourceSalonUserId: row.source_salon_user_id || row.salon_user_id
  }));
}
