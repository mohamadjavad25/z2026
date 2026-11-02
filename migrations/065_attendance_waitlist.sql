-- Up Migration
-- «اطمینان بدون بیعانه» (owner's decision of 2026-10-27, roadmap ۱۹).
-- «میای؟»: the day before a confirmed visit the client is asked whether they are coming. «آره، میام» is stored here
-- (NULL = not answered yet); «نمی‌تونم» is the client's ordinary cancel, so it needs no column.
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ;

-- «خبرم کن»: a client waits for a time to free up on one day at one salon or independent artist, for the services
-- they picked. Whenever a time opens for those services that day, everyone waiting is told at once (first to book
-- gets it). free_signature is the free times last told about, so the same opening is never announced twice.
CREATE TABLE IF NOT EXISTS booking_waitlist (
  id SERIAL PRIMARY KEY,
  client_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('salon', 'artist')),
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_date TEXT NOT NULL,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  free_signature TEXT NOT NULL DEFAULT '',
  UNIQUE (client_user_id, owner_kind, owner_user_id, booking_date)
);
CREATE INDEX IF NOT EXISTS booking_waitlist_owner_day ON booking_waitlist (owner_kind, owner_user_id, booking_date);
CREATE INDEX IF NOT EXISTS booking_waitlist_day ON booking_waitlist (booking_date);

-- Down Migration
DROP TABLE IF EXISTS booking_waitlist;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS client_confirmed_at;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS client_confirmed_at;
