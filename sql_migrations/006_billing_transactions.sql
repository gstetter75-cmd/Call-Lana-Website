-- ============================================================
-- MIGRATION 006 — Billing Transactions
-- Requires: 001_profiles.sql
--
-- Idempotent: safe to re-run on an existing database.
--
-- Columns mapped to dashboard.html renderBilling():
--
--   SELECT * FROM billing_transactions
--   WHERE user_id = uid
--   ORDER BY created_at DESC LIMIT 5
--
--   Used fields:
--     amount_cents   → displayed as € value (Math.abs / 100)
--     description    → shown as transaction label
--     type           → fallback label if description is empty
--     created_at     → date display
--
-- Transactions are written by your backend/payment webhook only.
-- Positive amount_cents = credit added (top-up).
-- Negative amount_cents = charge deducted.
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_transactions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text        NOT NULL DEFAULT 'charge'
                 CHECK (type IN ('topup', 'charge', 'refund', 'adjustment')),
  amount_cents integer     NOT NULL,
  description  text,
  reference    text,
  created_at   timestamptz DEFAULT now()
);

-- Ensure columns exist when table was created by an earlier migration run
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS type         text        NOT NULL DEFAULT 'charge';
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS amount_cents integer     NOT NULL DEFAULT 0;
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS description  text;
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS reference    text;
ALTER TABLE billing_transactions ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();

-- Ensure CHECK constraint exists
DO $$ BEGIN
  ALTER TABLE billing_transactions ADD CONSTRAINT billing_transactions_type_check
    CHECK (type IN ('topup', 'charge', 'refund', 'adjustment'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- RLS
ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_billing_tx_all"   ON billing_transactions;
DROP POLICY IF EXISTS "users_own_billing_tx_select" ON billing_transactions;

CREATE POLICY "superadmin_billing_tx_all"   ON billing_transactions FOR ALL    USING (is_superadmin());
CREATE POLICY "users_own_billing_tx_select" ON billing_transactions FOR SELECT USING (user_id = auth.uid());
-- Users cannot insert/update/delete transactions (backend/webhooks only)

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_tx_user_id    ON billing_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_tx_created_at ON billing_transactions(created_at DESC);
