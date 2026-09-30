-- Up Migration
--
-- Baseline capture of the schema previously applied by the old
-- app/lib/db/schema.js on every cold start (idempotent `IF NOT EXISTS`
-- DDL, no real migration history). This migration is a faithful, 1:1 port
-- of that exact DDL so it is a safe no-op against a database that already
-- has these tables (from the old bootstrap) and also builds the full
-- schema from scratch on an empty database. No column types or shapes are
-- changed here -- that starts in migration 002 onward.
--
-- Dialect notes carried over from schema.js:
-- - Booleans (in_explore, featured, active, ...) are still INTEGER 0/1,
--   not native BOOLEAN -- converted in a later migration.
-- - Timestamps are still TEXT, not TIMESTAMPTZ -- converted in a later
--   migration.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('client', 'artist', 'salon')),
  name TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  poster TEXT NOT NULL DEFAULT '',
  avatar_position TEXT NOT NULL DEFAULT '',
  poster_position TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  experience_years TEXT NOT NULL DEFAULT '',
  manager_name TEXT NOT NULL DEFAULT '',
  last_seen_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- sessions.expires_at stores epoch milliseconds as a decimal string (e.g. "1788249600000").

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  in_explore INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  saves_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_saves (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS follows (
  follower_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_user_id, target_user_id),
  CHECK (follower_user_id != target_user_id)
);

-- Real (server-side) "save" for a salon or independent artist's public
-- profile -- the bookmark button on their page. Same shape/conventions as
-- follows: both salons and artists are just rows in users
-- (salons.user_id / users.id with type='artist'), so one table with a
-- target_user_id covers both kinds; the target's users.type tells a
-- reader which kind it is. Mirrors post_saves for the composite-PK /
-- idempotent-toggle convention. Not reused for posts -- that's post_saves.
CREATE TABLE IF NOT EXISTS saved_profiles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, target_user_id),
  CHECK (user_id != target_user_id)
);

-- One row per browser/device a user granted Web Push permission on (see
-- app/lib/push.js). A user can have several (phone + desktop, two
-- browsers). endpoint is globally unique -- it's the push service's own
-- per-registration URL, never reused across users/devices.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS artist_services (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  hint TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'soft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artist_breaks (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artist_hours (
  id SERIAL PRIMARY KEY,
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  open_time TEXT NOT NULL DEFAULT '',
  close_time TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 8,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(artist_user_id, day)
);

CREATE TABLE IF NOT EXISTS artist_bookings (
  id SERIAL PRIMARY KEY,
  artist_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source_salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_phone TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  booking_date TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'تازه',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artist_collabs (
  id SERIAL PRIMARY KEY,
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  salon_name TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  days TEXT NOT NULL DEFAULT '',
  from_time TEXT NOT NULL DEFAULT '',
  to_time TEXT NOT NULL DEFAULT '',
  share_percent TEXT NOT NULL DEFAULT '',
  capacity TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'آماده ارسال',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Real persistence for the profile settings toggles (public/private
-- portfolio, reservation alerts, etc.) -- one JSON blob per user, merged
-- with defaults in app/lib/db/repos/userSettings.js.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salons (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  price TEXT NOT NULL DEFAULT '',
  open TEXT NOT NULL DEFAULT '',
  match_score TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  post_count INTEGER NOT NULL DEFAULT 0,
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salon_services (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  hint TEXT NOT NULL DEFAULT '',
  staff_id INTEGER,
  staff_ids TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salon_portfolio (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  tile TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salon_bookings (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  client_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  client TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  staff TEXT NOT NULL DEFAULT '',
  booking_date TEXT NOT NULL DEFAULT '',
  time TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'تازه',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salon_staff (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  booked TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL DEFAULT 'آرتیست',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salon_artist_invites (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL DEFAULT 'همکار',
  days TEXT NOT NULL DEFAULT '',
  from_time TEXT NOT NULL DEFAULT '',
  to_time TEXT NOT NULL DEFAULT '',
  share_percent TEXT NOT NULL DEFAULT '',
  capacity TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'در انتظار تایید',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(salon_user_id, artist_user_id)
);

CREATE TABLE IF NOT EXISTS salon_hours (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  open_time TEXT NOT NULL DEFAULT '',
  close_time TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 8,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(salon_user_id, day)
);

CREATE TABLE IF NOT EXISTS beauty_passports (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active INTEGER NOT NULL DEFAULT 0,
  skin_tone TEXT NOT NULL DEFAULT '',
  undertone TEXT NOT NULL DEFAULT '',
  face_shape TEXT NOT NULL DEFAULT '',
  hair_type TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);

CREATE INDEX IF NOT EXISTS idx_posts_owner ON posts(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_posts_explore ON posts(in_explore, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(target_user_id);
CREATE INDEX IF NOT EXISTS idx_artist_services_user ON artist_services(user_id);
CREATE INDEX IF NOT EXISTS idx_artist_collabs_artist ON artist_collabs(artist_user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_salon_artist_invites_artist ON salon_artist_invites(artist_user_id, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_salon_artist_invites_salon ON salon_artist_invites(salon_user_id, status, id DESC);

-- Backs the booking-conflict/day-listing hot path (listActiveDayBookings
-- in repos/salons/bookings.js).
CREATE INDEX IF NOT EXISTS idx_salon_bookings_day ON salon_bookings (salon_user_id, booking_date, status);

-- salon_artist_invites gained collaboration-terms columns (days/hours/
-- share/capacity, mirroring artist_collabs) after this table already
-- existed in production -- CREATE TABLE IF NOT EXISTS above never
-- touches an already-existing table, so the columns are added here
-- explicitly for databases that created the table before this change.
ALTER TABLE salon_artist_invites ADD COLUMN IF NOT EXISTS days TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_artist_invites ADD COLUMN IF NOT EXISTS from_time TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_artist_invites ADD COLUMN IF NOT EXISTS to_time TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_artist_invites ADD COLUMN IF NOT EXISTS share_percent TEXT NOT NULL DEFAULT '';
ALTER TABLE salon_artist_invites ADD COLUMN IF NOT EXISTS capacity TEXT NOT NULL DEFAULT '';

-- users gained avatar_position/poster_position (a CSS object-position
-- string like "50% 30%", set from the crop/reposition editor) after this
-- table already existed in production.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_position TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS poster_position TEXT NOT NULL DEFAULT '';

-- Down Migration
DROP TABLE IF EXISTS password_reset_requests CASCADE;
DROP TABLE IF EXISTS beauty_passports CASCADE;
DROP TABLE IF EXISTS salon_hours CASCADE;
DROP TABLE IF EXISTS salon_artist_invites CASCADE;
DROP TABLE IF EXISTS salon_staff CASCADE;
DROP TABLE IF EXISTS salon_bookings CASCADE;
DROP TABLE IF EXISTS salon_portfolio CASCADE;
DROP TABLE IF EXISTS salon_services CASCADE;
DROP TABLE IF EXISTS salons CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS artist_collabs CASCADE;
DROP TABLE IF EXISTS artist_bookings CASCADE;
DROP TABLE IF EXISTS artist_hours CASCADE;
DROP TABLE IF EXISTS artist_breaks CASCADE;
DROP TABLE IF EXISTS artist_services CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS saved_profiles CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS post_saves CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
