-- Up Migration
-- Support inbox: messages from users and reports about a post or an account. One table; `kind` tells them apart.
-- (Also created lazily by app/lib/db/repos/support.js so a deploy never needs a manual database step.)
CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('support', 'report')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  contact_phone TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT '' CHECK (target_type IN ('', 'post', 'user')),
  target_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
  admin_note TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_support_status_created ON support_tickets (status, created_at DESC);
-- One live report per reporter and target: reporting the same thing twice does not stack up.
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_report_once ON support_tickets (user_id, target_type, target_id) WHERE kind = 'report' AND status <> 'closed';

-- Down Migration
DROP TABLE IF EXISTS support_tickets;
