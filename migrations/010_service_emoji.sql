-- Up Migration
--
-- Icon id (from app/shared/constants/beautyEmoji.js) shown next to a service
-- in menus and booking flows. Empty string = no explicit icon chosen; the UI
-- then guesses one from the service name.

ALTER TABLE artist_services ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_services ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '';

-- Down Migration

ALTER TABLE salon_services DROP COLUMN IF EXISTS emoji;
ALTER TABLE artist_services DROP COLUMN IF EXISTS emoji;
