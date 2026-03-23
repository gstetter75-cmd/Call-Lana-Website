-- ============================================================
-- MIGRATION 004 — Subscriptions
-- Requires: 001_profiles.sql
--
-- Idempotent: safe to re-run on an existing database.
--
-- Columns mapped to dashboard.html renderBilling():
--   SELECT * FROM subscriptions WHERE user_id = uid (maybeSingle)
--
--   Used fields:
--     balance_cents        → billing-balance display  (/ 100 → euros)
--     used_minutes         → usage bar current value  (Math.round'd by JS)
--     included_minutes     → usage bar maximum
--     plan                 → 'trial' | 'solo' | 'team' | 'business'
--     current_period_end   → renewal date display
--
-- Dashboard handles gracefully when no row exists (sub = null).
-- Rows are created/updated only by the backend payment webhook.
--
-- ── Design decisions ───────────────────────────────────────
--
--   status DEFAULT 'trialing'
--     A new row always means a user just signed up for a trial,
--     never an immediately active paid subscription.
--
--   balance_cents CHECK (>= 0)
--     Credit balance cannot go negative. Deductions must be
--     capped at zero by the backend before writing.
--
--   used_minutes integer (not numeric)
--     dashboard.html already applies Math.round() on read:
--       const usedMin = Math.round(Number(sub.used_minutes) || 0)
--     Storing as integer is consistent with that intent.
--     The backend rounds up to the nearest whole minute when
--     incrementing after each call.
--
--   stripe_customer_id / stripe_sub_id UNIQUE
--     PostgreSQL UNIQUE allows multiple NULLs, so rows without
--     Stripe IDs are never in conflict. Once set, enforced globally.
--
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan & billing status
  plan                 text        NOT NULL DEFAULT 'trial'
                         CHECK (plan IN ('trial', 'solo', 'team', 'business')),
  status               text        NOT NULL DEFAULT 'trialing'
                         CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'paused')),

  -- Credit balance — must not go negative
  balance_cents        integer     NOT NULL DEFAULT 0
                         CHECK (balance_cents >= 0),

  -- Usage tracking — whole minutes only
  used_minutes         integer     NOT NULL DEFAULT 0,
  included_minutes     integer     NOT NULL DEFAULT 60,

  -- Billing period
  current_period_start timestamptz DEFAULT now(),
  current_period_end   timestamptz,

  -- Stripe integration (set by webhook; NULL until payment is set up)
  stripe_customer_id   text        UNIQUE,
  stripe_sub_id        text        UNIQUE,

  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Ensure columns exist when table was created by an earlier migration run
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan                 text        NOT NULL DEFAULT 'trial';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status               text        NOT NULL DEFAULT 'trialing';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS balance_cents        integer     NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS used_minutes         integer     NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS included_minutes     integer     NOT NULL DEFAULT 60;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_start timestamptz DEFAULT now();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end   timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id   text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_sub_id        text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_at           timestamptz DEFAULT now();
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at           timestamptz DEFAULT now();

-- Ensure CHECK constraints exist
DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('trial', 'solo', 'team', 'business'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'paused'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_balance_cents_check CHECK (balance_cents >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_subscriptions_all"      ON subscriptions;
DROP POLICY IF EXISTS "users_own_subscription_select"     ON subscriptions;

-- Superadmin has full access across all users
CREATE POLICY "superadmin_subscriptions_all"
  ON subscriptions FOR ALL
  USING (is_superadmin());

-- Authenticated users can only read their own row
CREATE POLICY "users_own_subscription_select"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- No client INSERT / UPDATE / DELETE policies.
-- All writes are performed by the backend via service_role key.

-- ── Auto updated_at ──────────────────────────────────────────

CREATE OR REPLACE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
