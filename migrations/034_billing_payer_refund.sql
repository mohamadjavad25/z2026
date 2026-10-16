-- Up Migration
-- 1. A salon may pay an artist's subscription (optional; otherwise the artist pays). payments.user_id stays the account
--    whose subscription is extended; payer_user_id is the salon that paid, when it is not the account itself. The
--    payer's name is copied like user_name, so the ledger still reads right if the salon is renamed or deleted.
-- 2. Refunds (terms, section 4): the money goes back through the gateway's own panel; the admin records it here, which
--    takes the refunded days off the subscription. A refunded payment stays "paid" (status only moves forward); the
--    refund is these columns, set once.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payer_name TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments (payer_user_id, id DESC) WHERE payer_user_id IS NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_rial BIGINT NOT NULL DEFAULT 0 CHECK (refund_rial >= 0);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_days INTEGER NOT NULL DEFAULT 0 CHECK (refund_days >= 0);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_note TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_admin TEXT NOT NULL DEFAULT '';

-- Down Migration
ALTER TABLE payments DROP COLUMN IF EXISTS refund_admin;
ALTER TABLE payments DROP COLUMN IF EXISTS refund_note;
ALTER TABLE payments DROP COLUMN IF EXISTS refund_days;
ALTER TABLE payments DROP COLUMN IF EXISTS refund_rial;
ALTER TABLE payments DROP COLUMN IF EXISTS refunded_at;
DROP INDEX IF EXISTS idx_payments_payer;
ALTER TABLE payments DROP COLUMN IF EXISTS payer_name;
ALTER TABLE payments DROP COLUMN IF EXISTS payer_user_id;
