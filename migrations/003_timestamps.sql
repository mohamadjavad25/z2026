-- Up Migration
--
-- Converts TEXT timestamp columns (a SQLite-era convention -- Postgres
-- allowed CURRENT_TIMESTAMP's timestamptz result to assign into a TEXT
-- column, so this "worked" but gave up native comparison/indexing and
-- forced ad hoc ::timestamptz casts at every query site, e.g.
-- bookingExpirySweep.js) to native TIMESTAMPTZ.
--
-- Verified before writing this migration: every created_at/updated_at
-- write site in app/lib/db/repos/*.js uses the SQL literal CURRENT_TIMESTAMP
-- (never a JS-formatted date string), so existing TEXT values are always a
-- valid Postgres timestamp text representation -- a plain ::timestamptz
-- cast is safe. Index rebuilds (idx_posts_explore references created_at)
-- happen automatically as part of ALTER COLUMN TYPE.
--
-- One exception: sessions.expires_at stores epoch MILLISECONDS as a
-- decimal string (see createSession/getValidSession in
-- app/lib/db/repos/sessions.js), not a calendar-timestamp string -- it
-- needs to_timestamp(ms / 1000.0), not a plain text cast.
--
-- DROP DEFAULT before / SET DEFAULT after on every column whose default is
-- CURRENT_TIMESTAMP, same reasoning as migration 002 (no implicit cast for
-- the stored default expression). Nullable columns with no default
-- (users.last_seen_at, beauty_passports.expires_at,
-- password_reset_requests.resolved_at) only need the TYPE change.

-- sessions
ALTER TABLE sessions ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING to_timestamp(expires_at::bigint / 1000.0);
ALTER TABLE sessions ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE sessions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE sessions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- users
ALTER TABLE users ALTER COLUMN last_seen_at TYPE TIMESTAMPTZ USING last_seen_at::timestamptz;
ALTER TABLE users ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE users ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- posts
ALTER TABLE posts ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE posts ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE posts ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE posts ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE posts ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE posts ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- post_saves
ALTER TABLE post_saves ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE post_saves ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE post_saves ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- follows
ALTER TABLE follows ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE follows ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE follows ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- saved_profiles
ALTER TABLE saved_profiles ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE saved_profiles ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE saved_profiles ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- push_subscriptions
ALTER TABLE push_subscriptions ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE push_subscriptions ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE push_subscriptions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- artist_services
ALTER TABLE artist_services ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE artist_services ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE artist_services ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE artist_services ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_services ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE artist_services ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- artist_breaks
ALTER TABLE artist_breaks ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_breaks ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE artist_breaks ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- artist_hours
ALTER TABLE artist_hours ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE artist_hours ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE artist_hours ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE artist_hours ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_hours ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE artist_hours ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- artist_bookings
ALTER TABLE artist_bookings ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE artist_bookings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE artist_bookings ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE artist_bookings ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_bookings ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE artist_bookings ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- artist_collabs
ALTER TABLE artist_collabs ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE artist_collabs ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE artist_collabs ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE artist_collabs ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_collabs ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE artist_collabs ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- user_settings
ALTER TABLE user_settings ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE user_settings ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE user_settings ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- salons
ALTER TABLE salons ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salons ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE salons ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE salons ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE salons ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE salons ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- salon_services
ALTER TABLE salon_services ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_services ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE salon_services ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- salon_portfolio
ALTER TABLE salon_portfolio ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_portfolio ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE salon_portfolio ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- salon_bookings
ALTER TABLE salon_bookings ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_bookings ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE salon_bookings ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- salon_staff
ALTER TABLE salon_staff ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_staff ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE salon_staff ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE salon_staff ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE salon_staff ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE salon_staff ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- salon_artist_invites
ALTER TABLE salon_artist_invites ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_artist_invites ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE salon_artist_invites ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE salon_artist_invites ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE salon_artist_invites ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE salon_artist_invites ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- salon_hours
ALTER TABLE salon_hours ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_hours ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE salon_hours ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE salon_hours ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE salon_hours ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE salon_hours ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- beauty_passports
ALTER TABLE beauty_passports ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at::timestamptz;
ALTER TABLE beauty_passports ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE beauty_passports ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE beauty_passports ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE beauty_passports ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE beauty_passports ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at::timestamptz;
ALTER TABLE beauty_passports ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

-- password_reset_requests
ALTER TABLE password_reset_requests ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE password_reset_requests ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
ALTER TABLE password_reset_requests ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE password_reset_requests ALTER COLUMN resolved_at TYPE TIMESTAMPTZ USING resolved_at::timestamptz;

-- Down Migration

ALTER TABLE password_reset_requests ALTER COLUMN resolved_at TYPE TEXT USING resolved_at::text;
ALTER TABLE password_reset_requests ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE password_reset_requests ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE password_reset_requests ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE beauty_passports ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE beauty_passports ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE beauty_passports ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE beauty_passports ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE beauty_passports ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE beauty_passports ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE beauty_passports ALTER COLUMN expires_at TYPE TEXT USING expires_at::text;

ALTER TABLE salon_hours ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE salon_hours ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE salon_hours ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE salon_hours ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_hours ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE salon_hours ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE salon_artist_invites ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE salon_artist_invites ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE salon_artist_invites ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE salon_artist_invites ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_artist_invites ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE salon_artist_invites ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE salon_staff ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE salon_staff ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE salon_staff ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE salon_staff ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_staff ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE salon_staff ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE salon_bookings ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_bookings ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE salon_bookings ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE salon_portfolio ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_portfolio ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE salon_portfolio ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE salon_services ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salon_services ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE salon_services ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE salons ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE salons ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE salons ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE salons ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE salons ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE salons ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE user_settings ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE user_settings ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE user_settings ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE artist_collabs ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_collabs ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE artist_collabs ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE artist_collabs ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE artist_collabs ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE artist_collabs ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE artist_bookings ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_bookings ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE artist_bookings ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE artist_bookings ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE artist_bookings ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE artist_bookings ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE artist_hours ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_hours ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE artist_hours ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE artist_hours ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE artist_hours ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE artist_hours ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE artist_breaks ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_breaks ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE artist_breaks ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE artist_services ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE artist_services ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE artist_services ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE artist_services ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE artist_services ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE artist_services ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE push_subscriptions ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE push_subscriptions ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE push_subscriptions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE saved_profiles ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE saved_profiles ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE saved_profiles ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE follows ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE follows ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE follows ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE post_saves ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE post_saves ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE post_saves ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE posts ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE posts ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE posts ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE posts ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE posts ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE posts ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE users ALTER COLUMN updated_at DROP DEFAULT;
ALTER TABLE users ALTER COLUMN updated_at TYPE TEXT USING updated_at::text;
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE users ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ALTER COLUMN last_seen_at TYPE TEXT USING last_seen_at::text;

ALTER TABLE sessions ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE sessions ALTER COLUMN created_at TYPE TEXT USING created_at::text;
ALTER TABLE sessions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sessions ALTER COLUMN expires_at TYPE TEXT USING (EXTRACT(EPOCH FROM expires_at) * 1000)::bigint::text;
