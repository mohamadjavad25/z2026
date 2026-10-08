-- Up Migration
-- The salon's manager can also work as a member of their own team (does services, takes bookings).
-- That member is an ordinary salon_staff row flagged is_owner: it has no artist account behind it and
-- there is at most one per salon.
ALTER TABLE salon_staff ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS salon_staff_one_owner ON salon_staff (salon_user_id) WHERE is_owner;

-- Down Migration
DROP INDEX IF EXISTS salon_staff_one_owner;
ALTER TABLE salon_staff DROP COLUMN IF EXISTS is_owner;
