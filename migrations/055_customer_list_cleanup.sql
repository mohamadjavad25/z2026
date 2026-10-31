-- Up Migration
-- The customers page of a salon or artist (owner's decision 2026-10-26):
-- client_account_deleted_at marks the bookings whose client deleted their frfro account (set when the account is
-- deleted, together with cutting the phone off), so the page says «حسابش رو پاک کرده» instead of «شماره نداره».
-- customers_hidden_at is the salon's or artist's «از لیست مشتری‌هام بردار»: the booking stays in the calendar and
-- the numbers, it only stops making a row on the customers page.
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS client_account_deleted_at TIMESTAMPTZ;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS client_account_deleted_at TIMESTAMPTZ;
ALTER TABLE salon_bookings ADD COLUMN IF NOT EXISTS customers_hidden_at TIMESTAMPTZ;
ALTER TABLE artist_bookings ADD COLUMN IF NOT EXISTS customers_hidden_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS client_account_deleted_at;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS client_account_deleted_at;
ALTER TABLE salon_bookings DROP COLUMN IF EXISTS customers_hidden_at;
ALTER TABLE artist_bookings DROP COLUMN IF EXISTS customers_hidden_at;
