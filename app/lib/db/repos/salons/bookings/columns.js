/**
 * The booking columns added after the first release, made on first use so a deploy works before its migrations ran.
 * One of the parts of ../bookings.js.
 */
import { getDb, run } from "../../../connection.js";

let partsColumnsReady;
/**
 * salon_bookings.parts and artist_bookings.salon_booking_id (migration 029) and the previous
 * time of a booking waiting on its client (migration 030), and the client's chosen response window
 * and backup salon (migration 040), also added on first use so the features work before the
 * migrations are run.
 */
export function ensureBookingPartsColumns() {
  partsColumnsReady ??= (async () => {
    const db = await getDb();
    await run(db, "ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS parts TEXT NOT NULL DEFAULT ''");
    await run(db, "ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS salon_booking_id INTEGER");
    await run(db, "ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS previous_booking_date TEXT NOT NULL DEFAULT ''");
    await run(db, "ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS previous_time TEXT NOT NULL DEFAULT ''");
    await run(db, "ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS wait_minutes INTEGER DEFAULT 60");
    await run(db, "ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS wait_minutes INTEGER DEFAULT 60");
    await run(db, "ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS fallback_salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL");
    await run(db, "ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS moved_to_booking_id INTEGER");
    await run(db, "ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS moved_from_booking_id INTEGER");
    await run(db, "ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS fallback_artist_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL");
    await run(db, "ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS moved_to_booking_id INTEGER");
    await run(db, "ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS moved_from_booking_id INTEGER");
    // When a new time was offered to the client (migration 044): an offer nobody answers is held 6 hours.
    await run(db, "ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS offer_at TIMESTAMPTZ");
    // «آره، میام» (migration 058).
    await run(db, "ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ");
    await run(db, "ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ");
  })().catch((error) => {
    partsColumnsReady = undefined;
    throw error;
  });
  return partsColumnsReady;
}
