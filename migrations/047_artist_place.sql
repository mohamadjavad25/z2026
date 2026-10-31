-- Up Migration
-- Where an artist on a salon team sees the clients who book them directly (owner's idea of 2026-10-24: the artist
-- chooses; the salon only keeps a switch):
--  * artist_place_prefs: the artist's choice for ONE salon they are on the team of. mode 'own' (the artist's own place,
--    what always happened before), 'salon', or 'days' (a letter per weekday from شنبه to جمعه: 's' = at the salon,
--    'o' = the artist's own place). No row = 'own', so nothing changes for anyone until they choose.
--  * salon_staff.direct_allowed: the salon's switch «نوبت مستقیم توی سالن» for that member (on by default).
--  * artist_bookings.place_salon_user_id: the salon a direct booking is held at (NULL = the artist's own place).
--    SET NULL when the salon goes away, so the booking is never lost, only moved back to the artist's own place.
CREATE TABLE IF NOT EXISTS artist_place_prefs (
  artist_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'own' CHECK (mode IN ('own', 'salon', 'days')),
  days TEXT NOT NULL DEFAULT 'ooooooo' CHECK (days ~ '^[so]{7}$'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE salon_staff ADD COLUMN IF NOT EXISTS direct_allowed BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS place_salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS artist_bookings_place_salon_idx ON artist_bookings (place_salon_user_id, booking_date) WHERE place_salon_user_id IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS artist_bookings_place_salon_idx;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS place_salon_user_id;
ALTER TABLE salon_staff DROP COLUMN IF EXISTS direct_allowed;
DROP TABLE IF EXISTS artist_place_prefs;
