-- Up Migration
-- Where an artist's clients are received, second version (owner's idea of 2026-10-24, evening): the artist keeps an ORDERED
-- list of the salons they work at. A client only picks a day and an hour; the system gives the booking to the first salon in
-- the list that can take it (member on duty, direct bookings on, open, has room that day), else it stays «مثل قبل»
-- (as before the feature) or, if the artist chose so, waits for the artist to say where.
--  * artist_place_order: the artist's list (position 0 = first). Only salons they are on the team of; rows go with the team.
--  * artist_place_settings.fallback: 'own' (as before) or 'ask' (tell me, the booking waits for my answer).
-- The version-1 table artist_place_prefs stays in place, unused; its salon choices are carried over below.
CREATE TABLE IF NOT EXISTS artist_place_order (
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (artist_user_id, salon_user_id)
);

CREATE TABLE IF NOT EXISTS artist_place_settings (
  artist_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  fallback TEXT NOT NULL DEFAULT 'own' CHECK (fallback IN ('own', 'ask')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO artist_place_order (artist_user_id, salon_user_id, position)
SELECT artist_user_id, salon_user_id, 0 FROM artist_place_prefs
WHERE mode IN ('salon', 'days') AND days LIKE '%s%'
ON CONFLICT DO NOTHING;

-- Down Migration
DROP TABLE IF EXISTS artist_place_settings;
DROP TABLE IF EXISTS artist_place_order;
