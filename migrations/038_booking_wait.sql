-- Up Migration
-- How long a client's booking request waits for an answer is the client's choice (user's decision
-- 2026-10-18): wait_minutes is the window in minutes (60 = «فقط ۱ ساعت») or NULL («تا هر وقت»: it
-- waits until its appointment starts). Rows that already exist keep the hour they were sent with.
-- A request with the hour may name a backup (one the client follows): a salon for a salon request
-- (fallback_salon_user_id), an artist for a direct artist request (fallback_artist_user_id). When the
-- hour runs out unanswered, the request is sent there instead. The expired row points at the new one
-- (moved_to_booking_id) and the new one back (moved_from_booking_id), in the same table.
-- (All also added on first use by app/lib/db/repos/salons/bookings.js, so the feature works
-- before this migration runs.)
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS wait_minutes INTEGER DEFAULT 60;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS wait_minutes INTEGER DEFAULT 60;
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS fallback_salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS moved_to_booking_id INTEGER;
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS moved_from_booking_id INTEGER;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS fallback_artist_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS moved_to_booking_id INTEGER;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS moved_from_booking_id INTEGER;

-- Down Migration
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS moved_from_booking_id;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS moved_to_booking_id;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS fallback_artist_user_id;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS moved_from_booking_id;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS moved_to_booking_id;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS fallback_salon_user_id;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS wait_minutes;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS wait_minutes;
