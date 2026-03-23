-- ============================================================
-- MIGRATION 007 — Payment Methods
-- Requires: 001_profiles.sql (is_superadmin)
--
-- Idempotent: safe to re-run on an existing database.
--
-- Compatible with dashboard.html renderBilling() payment methods section:
--
--   SELECT * FROM payment_methods WHERE user_id = uid
--
--   Used fields:
--     priority       → pm.priority === 1  means "Default" badge
--     type           → 'sepa' | 'credit_card' | 'paypal'
--     iban           → last 4 chars shown for SEPA
--     account_holder → shown as SEPA detail
--     card_brand     → e.g. 'Visa', 'Mastercard'
--     card_last4     → last 4 digits
--     card_expiry    → e.g. '12/26'
--     paypal_email   → shown for PayPal methods
--
-- priority = 1 → primary / default payment method
-- priority = 2 → fallback payment method
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_methods (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                text         NOT NULL
                        CHECK (type IN ('sepa', 'credit_card', 'paypal')),
  priority            smallint     NOT NULL DEFAULT 1
                        CHECK (priority IN (1, 2)),
  -- SEPA fields
  iban                text,
  bic                 text,
  account_holder      text,
  mandate_reference   text         UNIQUE,
  mandate_date        timestamptz,
  mandate_confirmed   boolean      DEFAULT false,
  -- Credit card fields
  card_last4          text,
  card_brand          text,
  card_expiry         text,
  -- PayPal fields
  paypal_email        text,
  -- Status
  status              text         NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('active', 'pending', 'revoked', 'failed')),
  created_at          timestamptz  DEFAULT now(),
  updated_at          timestamptz  DEFAULT now(),
  -- Enforce one primary (1) and one fallback (2) per user at most
  UNIQUE (user_id, priority)
);

-- Ensure columns exist when table was created by an earlier migration run
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS type              text        NOT NULL DEFAULT 'sepa';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS priority          smallint    NOT NULL DEFAULT 1;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS iban              text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS bic               text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS account_holder    text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS mandate_reference text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS mandate_date      timestamptz;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS mandate_confirmed boolean     DEFAULT false;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS card_last4        text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS card_brand        text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS card_expiry       text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS paypal_email      text;
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS status            text        NOT NULL DEFAULT 'pending';
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS created_at        timestamptz DEFAULT now();
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS updated_at        timestamptz DEFAULT now();

-- Ensure CHECK constraints exist
DO $$ BEGIN
  ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_type_check CHECK (type IN ('sepa', 'credit_card', 'paypal'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_priority_check CHECK (priority IN (1, 2));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_status_check CHECK (status IN ('active', 'pending', 'revoked', 'failed'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_payment_methods_all"   ON payment_methods;
DROP POLICY IF EXISTS "users_own_payment_methods_select" ON payment_methods;
DROP POLICY IF EXISTS "users_own_payment_methods_insert" ON payment_methods;
DROP POLICY IF EXISTS "users_own_payment_methods_update" ON payment_methods;
DROP POLICY IF EXISTS "users_own_payment_methods_delete" ON payment_methods;

CREATE POLICY "superadmin_payment_methods_all"   ON payment_methods FOR ALL    USING (is_superadmin());
CREATE POLICY "users_own_payment_methods_select" ON payment_methods FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_payment_methods_insert" ON payment_methods FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_payment_methods_update" ON payment_methods FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_payment_methods_delete" ON payment_methods FOR DELETE USING (user_id = auth.uid());

-- Auto updated_at
CREATE OR REPLACE FUNCTION update_payment_methods_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER payment_methods_updated
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_payment_methods_timestamp();

-- Index
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
