-- Up Migration
-- When the account proved, with an SMS code, that it owns its phone number (sign-up or password reset).
-- Bookings a salon or artist typed in for a walk-in are matched to an account by phone only once this is set,
-- so nobody can sign up with someone else's number and see or cancel that person's bookings.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;

-- Down Migration
ALTER TABLE users DROP COLUMN IF EXISTS phone_verified_at;
