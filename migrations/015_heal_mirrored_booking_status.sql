-- Up Migration
-- A staff artist's answer on the calendar copy of a salon booking never reached the salon's own
-- booking, so the two rows disagreed (artist: confirmed/cancelled, salon + client: still waiting).
-- The app now keeps them together; this brings the rows that already diverged back in line.
UPDATE salon_bookings sb
SET status = ab.status
FROM artist_bookings ab
WHERE ab.source_salon_user_id = sb.salon_user_id
  AND ab.client_name = sb.client
  AND ab.client_phone = sb.phone
  AND ab.service = sb.service
  AND ab.booking_date = sb.booking_date
  AND ab.time = sb.time
  AND ab.status IN ('تایید شده', 'لغو')
  AND sb.status IN ('تازه', 'درخواست');

-- Down Migration
-- Data repair only; nothing to undo.
