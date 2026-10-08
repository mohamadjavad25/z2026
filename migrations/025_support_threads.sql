-- Up Migration
-- Support becomes a conversation: every ticket has messages from the user and from the admin.
-- (Also applied lazily by app/lib/db/repos/support.js so a deploy never needs a manual database step.)
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_actor TEXT NOT NULL DEFAULT 'user';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS user_read_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS from_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS support_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('user', 'admin')),
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages (ticket_id, id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets (user_id, last_message_at DESC);

-- Tickets created before threads existed: their text becomes the first message.
INSERT INTO support_messages (ticket_id, author, author_user_id, body, created_at)
SELECT t.id, 'user', t.user_id, t.body, t.created_at FROM support_tickets t
WHERE t.body <> '' AND NOT EXISTS (SELECT 1 FROM support_messages m WHERE m.ticket_id = t.id);

-- Down Migration
DROP TABLE IF EXISTS support_messages;
ALTER TABLE support_tickets DROP COLUMN IF EXISTS from_admin, DROP COLUMN IF EXISTS user_read_at, DROP COLUMN IF EXISTS last_message_at, DROP COLUMN IF EXISTS last_actor;
