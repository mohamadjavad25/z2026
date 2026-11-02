-- Up Migration
-- The artist's break (owner's decision 2026-11-02): the daily window holds only on the weekdays switched on
-- (digits 0 = شنبه … 6 = جمعه, every day by default, so every break saved before keeps holding every day),
-- and «الان استراحت می‌کنم» holds one window today only (now_date is a date key like 1405-08-11).
ALTER TABLE artist_breaks ADD COLUMN IF NOT EXISTS days TEXT NOT NULL DEFAULT '0123456';
ALTER TABLE artist_breaks ADD COLUMN IF NOT EXISTS now_date TEXT NOT NULL DEFAULT '';
ALTER TABLE artist_breaks ADD COLUMN IF NOT EXISTS now_start TEXT NOT NULL DEFAULT '';
ALTER TABLE artist_breaks ADD COLUMN IF NOT EXISTS now_end TEXT NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE artist_breaks DROP COLUMN IF EXISTS now_end;
ALTER TABLE artist_breaks DROP COLUMN IF EXISTS now_start;
ALTER TABLE artist_breaks DROP COLUMN IF EXISTS now_date;
ALTER TABLE artist_breaks DROP COLUMN IF EXISTS days;
