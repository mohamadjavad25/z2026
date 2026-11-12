-- Up Migration
-- A client asks a salon or artist that is not on frfro yet, picked from the phone's contacts (owner, 2026-11-12):
-- frfro sends that number one SMS with a link (frfro.ir/r/<code>); once that number signs up as a salon or artist, the
-- request becomes a normal booking request in the new account (booking_kind/booking_id). Until then it waits here and
-- closes three hours before its time (expired), when the client takes it back (cancelled) or when the number asks
-- for no more messages (declined). Own tables, nothing else changes.
CREATE TABLE IF NOT EXISTS contact_requests (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,                 -- the link's code; random, says nothing by itself
  client_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,                       -- the salon's or artist's mobile, 09xxxxxxxxx
  contact_name TEXT NOT NULL DEFAULT '',     -- the name in the client's contacts, shown only to that client
  service TEXT NOT NULL,
  service_emoji TEXT NOT NULL DEFAULT '',
  booking_date TEXT NOT NULL,                -- Persian date key, like every booking
  time TEXT NOT NULL,                        -- "HH:MM"
  status TEXT NOT NULL DEFAULT 'waiting',    -- waiting | delivered | expired | cancelled | declined
  sms_status TEXT NOT NULL DEFAULT '',       -- sent | joined (the day's SMS already went) | off | failed
  business_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  booking_kind TEXT,                         -- 'salon' | 'artist' once delivered
  booking_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_contact_requests_phone_waiting ON contact_requests (phone) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_contact_requests_client ON contact_requests (client_user_id, created_at DESC);

-- Numbers that asked, on the link page, not to get these messages again.
CREATE TABLE IF NOT EXISTS contact_request_optouts (
  phone TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration
DROP TABLE IF EXISTS contact_request_optouts;
DROP TABLE IF EXISTS contact_requests;
