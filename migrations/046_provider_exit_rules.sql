-- Up Migration
-- The owner's rules of 2026-10-22 («نوبت تأییدشده هرگز بی‌خبر به هم نمی‌خورد»):
--  * who cancelled a booking ('client' | 'provider' | 'gone' = the salon/artist left frfro | 'admin'), so the client's
--    screen can say «سالن … نوبت تو را لغو کرد» or «سالن دیگر در فرفرو نیست»;
--  * a counter of the cancellations of CONFIRMED bookings by their provider (users.provider_cancel_count; shown in the
--    admin accounts list, count only);
--  * a proposal on a confirmed booking: the provider asks the client for another time (and/or another artist) while
--    the ORIGINAL time stays valid until the client accepts (proposal_*; expires in 6 hours or 2 hours before the booking);
--  * the artist's calendar copy of a salon booking is deleted with its salon (it used to lose source_salon_user_id and
--    then look like the client's own direct artist booking).
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT NOT NULL DEFAULT '';
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_cancel_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS proposal_date TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS proposal_time TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS proposal_staff TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS proposal_from TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS proposal_at TIMESTAMPTZ;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS proposal_date TEXT NOT NULL DEFAULT '';
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS proposal_time TEXT NOT NULL DEFAULT '';
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS proposal_at TIMESTAMPTZ;

DO $$
DECLARE fk TEXT;
BEGIN
  SELECT c.conname INTO fk FROM pg_constraint c
    WHERE c.conrelid = 'artist_bookings'::regclass AND c.contype = 'f'
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'artist_bookings'::regclass AND attname = 'source_salon_user_id')];
  IF fk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE artist_bookings DROP CONSTRAINT %I', fk);
  END IF;
  ALTER TABLE artist_bookings ADD CONSTRAINT artist_bookings_source_salon_user_id_fkey
    FOREIGN KEY (source_salon_user_id) REFERENCES users(id) ON DELETE CASCADE;
END $$;

-- Down Migration
ALTER TABLE artist_bookings DROP CONSTRAINT IF EXISTS artist_bookings_source_salon_user_id_fkey;
ALTER TABLE artist_bookings ADD CONSTRAINT artist_bookings_source_salon_user_id_fkey
  FOREIGN KEY (source_salon_user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS proposal_at;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS proposal_time;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS proposal_date;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS proposal_at;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS proposal_from;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS proposal_staff;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS proposal_time;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS proposal_date;
ALTER TABLE users DROP COLUMN IF EXISTS provider_cancel_count;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS cancelled_by;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS cancelled_by;
