-- Up Migration
-- «وقتش شده» (owner's decisions of 2026-10-25): some weeks after a visit the client gets one push that the service is
-- due again. Each salon or artist confirms once (users.due_confirmed_at); until then nothing is sent for them. Per
-- service they may change the gap (0 = off) and the text (one of three ready ones, or their own up to 80 characters).
ALTER TABLE users ADD COLUMN IF NOT EXISTS due_confirmed_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS due_reminder_rules (
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  gap_days INTEGER NOT NULL,
  text_id TEXT NOT NULL DEFAULT 'a',
  custom_text TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_user_id, service)
);
-- One push per booking, however many sweeps run at once (the insert is the claim).
CREATE TABLE IF NOT EXISTS due_reminders_sent (
  booking_kind TEXT NOT NULL,
  booking_id INTEGER NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_kind, booking_id)
);

-- Down Migration
DROP TABLE IF EXISTS due_reminders_sent;
DROP TABLE IF EXISTS due_reminder_rules;
ALTER TABLE users DROP COLUMN IF EXISTS due_confirmed_at;
