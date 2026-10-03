-- Up Migration
--
-- Snapshot of the service's icon id (app/shared/constants/beautyEmoji.js) on
-- each booking, taken when the booking is created / its service changes.
-- Bookings only stored the service *name*, so the UI had to guess an icon;
-- the snapshot shows the icon the owner actually picked and survives the
-- service being renamed or deleted later. '' = none (UI falls back to a
-- name-based guess).

ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS service_emoji TEXT NOT NULL DEFAULT '';
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS service_emoji TEXT NOT NULL DEFAULT '';

-- Backfill existing bookings from the owner's current service of the same name.
UPDATE salon_bookings b
SET service_emoji = s.emoji
FROM (
  SELECT DISTINCT ON (salon_user_id, name) salon_user_id, name, emoji
  FROM salon_services
  WHERE emoji <> ''
  ORDER BY salon_user_id, name, id
) s
WHERE b.service_emoji = '' AND s.salon_user_id = b.salon_user_id AND s.name = b.service;

UPDATE artist_bookings b
SET service_emoji = s.emoji
FROM (
  SELECT DISTINCT ON (user_id, name) user_id, name, emoji
  FROM artist_services
  WHERE emoji <> ''
  ORDER BY user_id, name, id
) s
WHERE b.service_emoji = '' AND s.user_id = b.artist_user_id AND s.name = b.service;

-- Down Migration

ALTER TABLE artist_bookings DROP COLUMN IF EXISTS service_emoji;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS service_emoji;
