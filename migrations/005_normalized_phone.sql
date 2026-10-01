-- Up Migration
--
-- Fixes the non-sargable phone-lookup queries in
-- app/lib/db/repos/salons/bookings.js (listClientSalonBookings) and
-- app/lib/db/repos/artists.js (listClientArtistBookings): both wrap the
-- stored column in a 10-level nested REPLACE() chain (Persian/Arabic digit
-- -> Latin digit normalization) on every read, which Postgres cannot use
-- any index through -- forcing a full sequential scan of salon_bookings/
-- artist_bookings every time a client's own bookings are listed.
--
-- salon_bookings.phone and artist_bookings.client_phone are stored exactly
-- as submitted at booking time (never normalized at write) -- that's WHY
-- the read-time REPLACE() chain exists. Fix: normalize once, at write
-- time, via a GENERATED ALWAYS ... STORED column that runs the identical
-- REPLACE() chain automatically on every INSERT/UPDATE, then index that
-- generated column. The raw `phone`/`client_phone` column is untouched
-- (still shows exactly what the client typed); the generated column is a
-- pure derived lookup key.
--
-- (users.phone is a separate case, not touched by this migration: it's
-- already normalized at write time in app/api/auth/register/route.js via
-- normalizePhone(), so the REPLACE() wrapper around it in
-- salons/bookings.js's findBookingClient and salons/staff.js was always
-- redundant, not a missing-normalization bug -- fixed by simply removing
-- the wrapper in the matching code change, no schema change needed.)

ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS phone_normalized TEXT
  GENERATED ALWAYS AS (
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,
      '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_salon_bookings_phone_normalized ON salon_bookings(phone_normalized);

ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS phone_normalized TEXT
  GENERATED ALWAYS AS (
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(client_phone,
      '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_artist_bookings_phone_normalized ON artist_bookings(phone_normalized);

-- Down Migration

DROP INDEX IF EXISTS idx_artist_bookings_phone_normalized;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS phone_normalized;

DROP INDEX IF EXISTS idx_salon_bookings_phone_normalized;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS phone_normalized;
