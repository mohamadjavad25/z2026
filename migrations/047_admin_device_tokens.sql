-- Up Migration
-- The «فرفرو مدیر» app's live wallpaper and "always on" notification read a few numbers (support waiting,
-- bookings waiting, payments today, ...) every few minutes, long after the short admin session has ended.
-- Each admin phone gets one long-lived, read-only key for that, made from inside a live admin session and
-- stored here only as a hash. It opens nothing but those counts (GET /api/admin/device/feed), and stops
-- working when the admin turns both features off, the phone leaves FRFRO_ADMIN_PHONES, or it is unused
-- for 30 days. See app/lib/db/repos/adminDevice.js.
CREATE TABLE IF NOT EXISTS admin_device_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_device_tokens_user ON admin_device_tokens(user_id);

-- Down Migration
DROP TABLE IF EXISTS admin_device_tokens;
