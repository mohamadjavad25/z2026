-- Up Migration
-- A switch of workplace (artist_workplace, migration 051) also moved bookings of the switch day whose time had already
-- come (owner's report of 2026-10-26: a visit done in the morning showed up at the salon joined in the afternoon). Those
-- go back to where they were held before: the artist's own place, since a switch day is the first day at that salon.
-- Only bookings made before the switch and starting before the moment of the switch (Tehran clock) are touched.
UPDATE artist_bookings b SET place_salon_user_id = NULL
FROM artist_workplace w
WHERE b.source_salon_user_id IS NULL
  AND b.place_salon_user_id IS NOT NULL
  AND w.artist_user_id = b.artist_user_id
  AND w.salon_user_id = b.place_salon_user_id
  AND w.starts_on = b.booking_date
  AND b.created_at < w.created_at
  AND b.time ~ '^[0-9]{1,2}:[0-9]{2}$'
  AND split_part(b.time, ':', 1)::int * 60 + split_part(b.time, ':', 2)::int
    < EXTRACT(HOUR FROM w.created_at AT TIME ZONE 'Asia/Tehran')::int * 60 + EXTRACT(MINUTE FROM w.created_at AT TIME ZONE 'Asia/Tehran')::int
  AND NOT EXISTS (
    SELECT 1 FROM artist_workplace p
    WHERE p.artist_user_id = w.artist_user_id AND p.starts_on < w.starts_on AND p.salon_user_id = w.salon_user_id
  );

-- Down Migration
-- Data repair only; nothing to undo.
