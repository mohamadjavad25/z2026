-- Up Migration
-- Which account a crash report came from (owner, 2026-11-05: «میتونی بفهمی که گوشی کدوم یکی از کاربرا بود»).
-- Taken from the session on the server, never from the report itself; empty for someone not signed in.
-- A deleted account leaves the report and takes the link with it.
ALTER TABLE client_errors ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Down Migration
ALTER TABLE client_errors DROP COLUMN IF EXISTS user_id;
