-- Up Migration
-- When a salon moves a client's booking to another time, the booking waits for the client
-- ('در انتظار مشتری') and keeps the time it had before here, so the client sees what changed
-- and can accept or decline. Empty otherwise. (Also added on first use by
-- app/lib/db/repos/salons/bookings.js, so the feature works before this migration runs.)
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS previous_booking_date TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS previous_time TEXT NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS previous_time;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS previous_booking_date;
