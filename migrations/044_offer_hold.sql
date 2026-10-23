-- Up Migration
-- A new time the salon offered a client (status 'در انتظار مشتری') is held for 6 hours only (user's decision
-- 2026-10-21, "Package 1"): offer_at is when the offer was made, so a silent client frees the slot, and both sides
-- are told. Offers already waiting get a fresh 6 hours from now. (Also added on first use by
-- app/lib/db/repos/salons/bookings.js, so the feature works before this migration runs.)
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS offer_at TIMESTAMPTZ;
UPDATE salon_bookings SET offer_at = NOW() WHERE status = 'در انتظار مشتری' AND offer_at IS NULL;

-- Down Migration
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS offer_at;
