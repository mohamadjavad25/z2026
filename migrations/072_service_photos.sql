-- Up Migration
-- Sample photos on services (owner's idea from the welcome survey, 2026-11-06): a service shows up to 3 of its owner's
-- own portfolio posts. One row links one service (artist's or salon's) to one post; the first by position is the cover.
-- Deleting the service or the post removes the link, nothing else.
CREATE TABLE IF NOT EXISTS service_photos (
  id SERIAL PRIMARY KEY,
  artist_service_id INTEGER REFERENCES artist_services(id) ON DELETE CASCADE,
  salon_service_id INTEGER REFERENCES salon_services(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_photos_one_service CHECK ((artist_service_id IS NOT NULL) <> (salon_service_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS service_photos_artist_unique ON service_photos (artist_service_id, post_id) WHERE artist_service_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS service_photos_salon_unique ON service_photos (salon_service_id, post_id) WHERE salon_service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS service_photos_post ON service_photos (post_id);

-- Down Migration
DROP TABLE IF EXISTS service_photos;
