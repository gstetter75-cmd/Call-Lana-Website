-- ============================================================
-- MIGRATION 040 — Foundation Fixes
-- Idempotent: safe to re-run on an existing database.
--
-- Fixes applied:
--   1. atomic_balance_topup — add caller auth check
--   2. Auto-create subscription row on profile insert
--   3. customer_minutes_usage — fix p.plan + c.duration refs
--   4. daily_metrics — fix SUM(duration) → SUM(duration_seconds)
--      + ensure calls.outcome / calls.sentiment_score columns exist
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- FIX 1: Secure atomic_balance_topup
--
-- Root cause: SECURITY DEFINER function accepted any p_user_id
-- without verifying the caller was allowed to top up that user.
-- Any authenticated user could credit any account's balance.
--
-- Fix: reject the call unless p_user_id = auth.uid() OR caller
-- is a superadmin. The ledger/atomic update logic is unchanged.
--
-- IMPORTANT: in production this function must ONLY be invoked
-- from a verified Stripe payment webhook — never from the browser.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION atomic_balance_topup(
  p_user_id uuid,
  p_amount_cents integer
)
RETURNS integer  -- returns new balance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  -- SECURITY: block cross-user balance mutation.
  -- Only the user themselves or a superadmin may top up a balance.
  -- In production, call this only from a verified Stripe webhook.
  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Unauthorized: cannot top up balance for user %', p_user_id;
  END IF;

  -- Validate input
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_amount_cents > 100000 THEN  -- max 1000 EUR
    RAISE EXCEPTION 'Amount exceeds maximum';
  END IF;

  -- Atomic update
  UPDATE subscriptions
  SET balance_cents = balance_cents + p_amount_cents
  WHERE user_id = p_user_id
  RETURNING balance_cents INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for user %', p_user_id;
  END IF;

  -- Log the transaction
  INSERT INTO billing_transactions (user_id, type, amount_cents, description)
  VALUES (p_user_id, 'topup', p_amount_cents, 'Guthaben-Aufladung');

  RETURN v_new_balance;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- FIX 2: Auto-create subscription row on new profile
--
-- Root cause: auth.js creates a profiles row on signup but never
-- creates a subscriptions row. Dashboard/billing code assumes a
-- subscription row exists and breaks for brand-new users.
--
-- Fix: DB trigger on profiles AFTER INSERT that inserts a default
-- trial subscription row. ON CONFLICT DO NOTHING makes it safe
-- to run on databases that already have subscription rows.
--
-- Defaults match the subscriptions table schema:
--   plan = 'trial'       (CHECK constraint values)
--   status = 'trialing'  (CHECK constraint values)
--   balance_cents = 0
--   included_minutes = 60 (free-tier baseline)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan, status, balance_cents, included_minutes)
  VALUES (NEW.id, 'trial', 'trialing', 0, 60)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

-- Backfill: existing profiles that have no subscription row yet
INSERT INTO subscriptions (user_id, plan, status, balance_cents, included_minutes)
SELECT p.id, 'trial', 'trialing', 0, 60
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.user_id = p.id
);

-- ──────────────────────────────────────────────────────────────
-- FIX 3 + 4a: Ensure calls.outcome and calls.sentiment_score exist
--
-- Root cause: these columns were only added in run_034_037.sql /
-- setup_complete.sql, not in the canonical 003_calls migration.
-- All analytics views depend on them. ADD COLUMN IF NOT EXISTS
-- is a no-op if already present.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE calls ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment_score numeric;

CREATE INDEX IF NOT EXISTS idx_calls_outcome   ON calls(outcome);
CREATE INDEX IF NOT EXISTS idx_calls_sentiment ON calls(sentiment_score);

-- ──────────────────────────────────────────────────────────────
-- FIX 4b: Fix daily_metrics — SUM(duration) → SUM(duration_seconds)
--
-- Root cause: calls table column is duration_seconds; view used
-- the non-existent alias duration, returning NULL for total_minutes.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW daily_metrics AS
SELECT
  user_id AS customer_id,
  DATE(created_at) AS date,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE outcome = 'termin') AS booked,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'termin')::numeric /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS booking_rate,
  ROUND(SUM(duration_seconds) / 60.0, 1) AS total_minutes,
  ROUND(AVG(sentiment_score), 1) AS avg_score
FROM calls
GROUP BY user_id, DATE(created_at);

-- hourly_calls and weekly_booking_rate have no duration reference — recreate for completeness
CREATE OR REPLACE VIEW hourly_calls AS
SELECT
  user_id AS customer_id,
  EXTRACT(HOUR FROM created_at)::integer AS hour,
  COUNT(*) AS calls
FROM calls
GROUP BY user_id, EXTRACT(HOUR FROM created_at)
ORDER BY calls DESC;

CREATE OR REPLACE VIEW weekly_booking_rate AS
SELECT
  user_id AS customer_id,
  DATE_TRUNC('week', created_at)::date AS week_start,
  EXTRACT(WEEK FROM created_at)::integer AS week_num,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE outcome = 'termin') AS booked,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'termin')::numeric /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS booking_rate
FROM calls
GROUP BY user_id, DATE_TRUNC('week', created_at), EXTRACT(WEEK FROM created_at);

CREATE OR REPLACE VIEW outcome_distribution AS
SELECT
  user_id AS customer_id,
  COALESCE(outcome, 'sonstige') AS outcome,
  COUNT(*) AS count
FROM calls
GROUP BY user_id, COALESCE(outcome, 'sonstige');

-- ──────────────────────────────────────────────────────────────
-- FIX 3b: Fix customer_minutes_usage view
--
-- Root causes:
--   a) p.plan — profiles table has no plan column; plan lives
--      in subscriptions.plan.
--   b) c.duration — calls has duration_seconds, not duration.
--   c) CASE plan hardcoded limits — use subscriptions.included_minutes
--      as the authoritative source instead of a magic CASE table.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW customer_minutes_usage AS
SELECT
  p.id AS customer_id,
  p.email,
  p.first_name,
  p.last_name,
  s.plan,
  COALESCE(
    (SELECT ROUND(SUM(c.duration_seconds) / 60.0, 1)
     FROM calls c
     WHERE c.user_id = p.id
       AND DATE_TRUNC('month', c.created_at) = DATE_TRUNC('month', now())),
    0
  ) AS minutes_used,
  COALESCE(s.included_minutes, 60) AS minutes_limit
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id
WHERE p.role = 'customer';

COMMIT;
