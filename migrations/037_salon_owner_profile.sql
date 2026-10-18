-- Up Migration
-- What the salon manager entered to work on their own team (name, fields of work, an optional photo of their own).
-- It outlives the is_owner salon_staff row: switching "I work here too" off deletes that row, switching it back on
-- rejoins with this profile instead of asking for everything again. use_photo picks the photo over the salon's picture.
CREATE TABLE IF NOT EXISTS salon_owner_profile (
  salon_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  use_photo BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO salon_owner_profile (salon_user_id, name, role)
SELECT salon_user_id, name, role FROM salon_staff WHERE is_owner
ON CONFLICT (salon_user_id) DO NOTHING;

-- Down Migration
DROP TABLE IF EXISTS salon_owner_profile;
