-- Up Migration
-- Where an artist's own clients are received, third version (owner's decision of 2026-10-25, replaces the ordered salon
-- list of 048): one place at a time, the artist's «محل کار». A row says "from this day on, my clients come to this salon"
-- (salon_user_id NULL = the artist's own place). The place on a day is the row with the latest starts_on not after it; no
-- row = the artist's own place, as before the feature. starts_on is a Persian date key like booking_date ("1405-08-04").
-- SET NULL when the salon account goes away, so that stretch falls back to the artist's own place, never to another salon.
CREATE TABLE IF NOT EXISTS artist_workplace (
  id SERIAL PRIMARY KEY,
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  starts_on TEXT NOT NULL CHECK (starts_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (artist_user_id, starts_on)
);
CREATE INDEX IF NOT EXISTS artist_workplace_salon_idx ON artist_workplace (salon_user_id) WHERE salon_user_id IS NOT NULL;

-- Down Migration
DROP TABLE IF EXISTS artist_workplace;
