-- Up Migration
-- Sample photos on services, second step (owner, 2026-11-06): linked photos can replace the service icon in lists
-- (the default) or leave the icon and show only a small «عکس» button. One flag per service, own columns only.
ALTER TABLE artist_services ADD COLUMN IF NOT EXISTS photo_as_cover BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE salon_services ADD COLUMN IF NOT EXISTS photo_as_cover BOOLEAN NOT NULL DEFAULT TRUE;

-- Down Migration
ALTER TABLE artist_services DROP COLUMN IF EXISTS photo_as_cover;
ALTER TABLE salon_services DROP COLUMN IF EXISTS photo_as_cover;
