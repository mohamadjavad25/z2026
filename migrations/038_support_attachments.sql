-- Up Migration
-- Pictures and voice notes in support conversations. Kept as bytes here, never in the public Storage bucket: they are
-- served only to the ticket's owner and to admins (app/api/support/attachments/[id]).
-- (Also applied lazily by app/lib/db/repos/support.js so a deploy never needs a manual database step.)
CREATE TABLE IF NOT EXISTS support_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'voice')),
  content_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  size_bytes INTEGER NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_attachments_message ON support_attachments (message_id, id);

-- Down Migration
DROP TABLE IF EXISTS support_attachments;
