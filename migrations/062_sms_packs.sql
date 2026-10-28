-- Up Migration
-- SMS packs (owner's decision 2026-10-28). Every salon and artist account has 200 SMS a month for its clients inside the
-- subscription; a pack adds more that never expire.
--   * sms_wallet: one row per account. `included_used` counts this month's SMS against the 200 (reset when the Persian
--     month changes, stored in `period_key`), `pack_credits` is what the account bought and has not used.
--   * payments.kind: "plan" is a subscription (days > 0), "sms_pack" is a pack (days = 0, sms_credits > 0). A pack is paid
--     through the same gateway flow and ledger as a plan; only what settling does differs (billing.js settlePayment).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'plan' CHECK (kind IN ('plan', 'sms_pack'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS sms_credits INTEGER NOT NULL DEFAULT 0 CHECK (sms_credits >= 0);
DO $$ BEGIN ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_days_check; IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_kind_shape' AND conrelid = 'payments'::regclass) THEN ALTER TABLE payments ADD CONSTRAINT payments_kind_shape CHECK ((kind = 'plan' AND days > 0) OR (kind = 'sms_pack' AND days = 0 AND sms_credits > 0)); END IF; END $$;
CREATE TABLE IF NOT EXISTS sms_wallet (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL DEFAULT '',
  included_used INTEGER NOT NULL DEFAULT 0 CHECK (included_used >= 0),
  pack_credits INTEGER NOT NULL DEFAULT 0 CHECK (pack_credits >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Down Migration
-- Destructive: deletes the SMS pack payments (real money records) and the wallets. Export them first; never run it on a live database.
DROP TABLE IF EXISTS sms_wallet;
DELETE FROM payments WHERE kind = 'sms_pack';
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_kind_shape;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_days_check;
ALTER TABLE payments ADD CONSTRAINT payments_days_check CHECK (days > 0);
ALTER TABLE payments DROP COLUMN IF EXISTS sms_credits;
ALTER TABLE payments DROP COLUMN IF EXISTS kind;
