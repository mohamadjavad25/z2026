-- Up Migration
-- One-time codes sent by SMS (sign-up verification and password reset) and a log of every SMS attempt.
CREATE TABLE IF NOT EXISTS otp_codes (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,                       -- 'register' | 'reset'
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes (phone, purpose, id DESC);

CREATE TABLE IF NOT EXISTS sms_log (
  id SERIAL PRIMARY KEY,
  phone_masked TEXT NOT NULL,                  -- 0912***4567
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,                        -- 'sent' | 'failed'
  detail TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',               -- stored only by the 'test' provider
  phone TEXT NOT NULL DEFAULT '',              -- stored only by the 'test' provider
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sms_log_created ON sms_log (created_at DESC);

-- Down Migration
DROP TABLE IF EXISTS sms_log;
DROP TABLE IF EXISTS otp_codes;
