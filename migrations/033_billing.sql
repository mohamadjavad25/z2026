-- Up Migration
-- Subscriptions for salons and artists (clients never pay). Three tables:
--   subscriptions:   per account, the end of the last paid (or admin-granted) period. The free month is not stored:
--                    it is computed from users.created_at and the day billing was switched on (app/lib/billing/period.js).
--   payments:        the ledger. One row per checkout attempt or admin grant, with the amount copied from the plan at
--                    that moment. Kept when the account is deleted (user_id becomes NULL; name and phone stay as a snapshot).
--   billing_notices: which reminder (5 days left, 1 day left, ended, closed) was already sent for which end date, so a
--                    reminder is claimed before it is sent and never goes out twice.
-- (Also created lazily by app/lib/db/repos/billing.js, the same DDL, so a deploy never needs a manual database step.)
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  paid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_type TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  user_phone TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL,
  plan_title TEXT NOT NULL DEFAULT '',
  days INTEGER NOT NULL CHECK (days > 0),
  amount_rial BIGINT NOT NULL CHECK (amount_rial >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  source TEXT NOT NULL DEFAULT 'gateway' CHECK (source IN ('gateway', 'admin')),
  gateway TEXT NOT NULL DEFAULT '',
  authority TEXT,
  ref_id TEXT,
  card_pan TEXT NOT NULL DEFAULT '',
  gateway_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  return_token TEXT UNIQUE,
  receipt_no TEXT UNIQUE,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  failure TEXT NOT NULL DEFAULT '',
  verify_attempts INTEGER NOT NULL DEFAULT 0,
  last_verify_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  admin_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- A gateway's token for one checkout, and its tracking code for one real transfer, each belong to one payment only:
-- one bank transfer can never extend two subscriptions.
CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_authority ON payments (gateway, authority) WHERE authority IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_ref ON payments (gateway, ref_id) WHERE ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_paid ON payments (paid_at DESC) WHERE status = 'paid';

CREATE TABLE IF NOT EXISTS billing_notices (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, kind, period_end)
);

-- Down Migration
DROP TABLE IF EXISTS billing_notices;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS subscriptions;
