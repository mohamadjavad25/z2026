-- Up Migration
-- A salon booking with several services (one visit, back to back) keeps them in `parts`
-- (JSON list: service, minutes, staff, in visit order); empty for an ordinary booking.
-- Each artist's copy of such a booking points straight at it through salon_booking_id,
-- instead of being matched by client/service/day/time. (Both are also added on first use
-- by app/lib/db/repos/salons/bookings.js, so the feature works before this migration runs.)
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS parts TEXT NOT NULL DEFAULT '';
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS salon_booking_id INTEGER;
CREATE INDEX IF NOT EXISTS artist_bookings_salon_booking_id_idx ON artist_bookings (salon_booking_id);

-- Down Migration
DROP INDEX IF EXISTS artist_bookings_salon_booking_id_idx;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS salon_booking_id;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS parts;
