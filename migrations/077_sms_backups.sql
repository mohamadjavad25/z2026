-- Up Migration
-- SMS backup for app-only booking notices (owner, 2026-11-08): when the frfro Android app's push was taken by Google,
-- the booking SMS is held here instead of dropped. Ten minutes later the 5-minute sweep (bookingSmsBackup.js) sends it
-- only if the person has not opened frfro since (users.last_seen_at) and the booking still has the status it had when
-- the notice went. One row per (booking, person, template); rows are cleared a week after they are settled.
-- Own table, nothing else changes.
CREATE TABLE IF NOT EXISTS sms_backups (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template TEXT NOT NULL,              -- smsTemplates.js key: booking_request | booking_answer
  sms_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  payer_user_id INTEGER,               -- whose SMS wallet pays (smsCredits.js); NULL = sent at frfro's cost
  booking_kind TEXT NOT NULL,          -- 'salon' | 'artist'
  booking_id INTEGER NOT NULL,
  booking_status TEXT NOT NULL,        -- the booking's status when the notice went; a change cancels the backup
  booking_date TEXT,
  booking_time TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ,
  outcome TEXT,                        -- sent | seen | changed | past | failed
  UNIQUE (booking_kind, booking_id, user_id, template)
);
CREATE INDEX IF NOT EXISTS idx_sms_backups_due ON sms_backups (due_at) WHERE settled_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS sms_backups;
