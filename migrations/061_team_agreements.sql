-- Up Migration
-- Leave, terms and the ledger between a salon and a team artist (owner's decision 2026-10-28, docs/DECISIONS.md).
-- Dates are Persian date keys (YYYY-MM-DD, like booking_date); times are the app's «۱۴:۰۰».

-- An artist's leave («نمی‌تونم بیام»): whole days or the same hours on each day of date_from..date_to. It blocks new
-- bookings (listArtistBusyRanges) everywhere the artist works; cancelled_at keeps the row for the record.
CREATE TABLE IF NOT EXISTS artist_leaves (
  id SERIAL PRIMARY KEY,
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_artist_leaves_artist ON artist_leaves (artist_user_id, date_to);

-- The agreed terms of one pair, from a day on. The newest row whose effective_from has come is the current one; a pair with
-- no row here still has the invite's text terms (read-only history). share_percent is the artist's share of what the
-- salon's clients pay; own_share_percent (optional) the share for the artist's own clients held at the salon.
CREATE TABLE IF NOT EXISTS team_terms (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  effective_from TEXT NOT NULL,
  days TEXT NOT NULL DEFAULT '',
  from_time TEXT NOT NULL DEFAULT '',
  to_time TEXT NOT NULL DEFAULT '',
  share_percent INTEGER CHECK (share_percent BETWEEN 0 AND 100),
  own_share_percent INTEGER CHECK (own_share_percent BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_team_terms_pair ON team_terms (salon_user_id, artist_user_id, effective_from);

-- A proposal to change the terms, from either side; the other side accepts, rejects or counters (a counter is a new
-- proposal and supersedes this one). Until accepted the old terms stand.
CREATE TABLE IF NOT EXISTS team_term_proposals (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_by TEXT NOT NULL CHECK (proposed_by IN ('salon', 'artist')),
  days TEXT NOT NULL DEFAULT '',
  from_time TEXT NOT NULL DEFAULT '',
  to_time TEXT NOT NULL DEFAULT '',
  share_percent INTEGER CHECK (share_percent BETWEEN 0 AND 100),
  own_share_percent INTEGER CHECK (own_share_percent BETWEEN 0 AND 100),
  note TEXT NOT NULL DEFAULT '',
  effective_from TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_team_term_proposals_pair ON team_term_proposals (salon_user_id, artist_user_id, status);

-- A settlement: one side says what was paid, the other confirms (or says another amount). A confirmed one closes the lines
-- it covers (team_ledger_lines.settlement_id).
CREATE TABLE IF NOT EXISTS team_settlements (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expected_amount BIGINT NOT NULL,
  paid_amount BIGINT NOT NULL,
  started_by TEXT NOT NULL CHECK (started_by IN ('salon', 'artist')),
  salon_pays BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'confirmed', 'disputed', 'cancelled')),
  other_amount BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_team_settlements_pair ON team_settlements (salon_user_id, artist_user_id, status);

-- One line per finished booking (the artist's calendar row, which exists for every salon booking and every direct one
-- held at a salon). amount is the price the service had when the line was written; the salon may change it until the
-- line is settled (original_amount keeps the first one). share_percent is the artist's share on that booking's day.
CREATE TABLE IF NOT EXISTS team_ledger_lines (
  id SERIAL PRIMARY KEY,
  salon_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_booking_id INTEGER NOT NULL UNIQUE,
  booking_date TEXT NOT NULL,
  service TEXT NOT NULL DEFAULT '',
  client_first TEXT NOT NULL DEFAULT '',
  own_client BOOLEAN NOT NULL DEFAULT FALSE,
  original_amount BIGINT NOT NULL DEFAULT 0,
  amount BIGINT NOT NULL DEFAULT 0,
  share_percent INTEGER,
  settlement_id INTEGER REFERENCES team_settlements(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_team_ledger_pair ON team_ledger_lines (salon_user_id, artist_user_id, booking_date);

-- Down Migration
DROP TABLE IF EXISTS team_ledger_lines;
DROP TABLE IF EXISTS team_settlements;
DROP TABLE IF EXISTS team_term_proposals;
DROP TABLE IF EXISTS team_terms;
DROP TABLE IF EXISTS artist_leaves;
