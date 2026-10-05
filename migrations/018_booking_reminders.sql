-- Up Migration
-- One row per reminder already sent (or claimed) so a booking is reminded at most once per kind,
-- even if the scheduler fires twice or two sweeps overlap.
CREATE TABLE IF NOT EXISTS booking_reminders (
  source TEXT NOT NULL,            -- 'salon' | 'artist'
  booking_id INTEGER NOT NULL,
  kind TEXT NOT NULL,              -- 'day' (about a day before) | 'soon' (about two hours before)
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, booking_id, kind)
);

-- Down Migration
DROP TABLE IF EXISTS booking_reminders;
