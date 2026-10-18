-- Up Migration
-- A booking's status is plain text that the code compares exactly ('لغو', 'تایید شده', ...). A typo in a future
-- change, or a value no screen knows, would quietly drop a booking from every list and from the slot checks.
-- These constraints list every value the app writes today (plus the two legacy cancel spellings older rows may
-- carry and the read paths still accept). NOT VALID: new and changed rows are checked, existing rows are left alone
-- so the migration can never fail on old data; `ALTER TABLE ... VALIDATE CONSTRAINT ...` checks those too, later.
ALTER TABLE salon_bookings DROP CONSTRAINT IF EXISTS salon_bookings_status_known;
ALTER TABLE salon_bookings ADD CONSTRAINT salon_bookings_status_known CHECK (
  status IN ('تازه', 'درخواست', 'تایید شده', 'در انتظار مشتری', 'لغو', 'منقضی شده', 'لغو شده', 'cancelled')
) NOT VALID;
ALTER TABLE artist_bookings DROP CONSTRAINT IF EXISTS artist_bookings_status_known;
ALTER TABLE artist_bookings ADD CONSTRAINT artist_bookings_status_known CHECK (
  status IN ('تازه', 'درخواست', 'تایید', 'تایید شده', 'در انتظار مشتری', 'لغو', 'منقضی شده', 'لغو شده', 'cancelled')
) NOT VALID;

-- Down Migration
ALTER TABLE salon_bookings DROP CONSTRAINT IF EXISTS salon_bookings_status_known;
ALTER TABLE artist_bookings DROP CONSTRAINT IF EXISTS artist_bookings_status_known;
