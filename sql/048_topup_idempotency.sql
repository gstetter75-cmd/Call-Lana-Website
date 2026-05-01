-- ============================================================
-- MIGRATION 048 — Stripe Topup Idempotency
-- Idempotent: safe to re-run on an existing database.
--
-- ROOT CAUSE:
--   atomic_balance_topup(uuid, integer) increments
--   subscriptions.balance_cents every time it is called. Stripe may
--   deliver the same checkout.session.completed event more than once
--   (automatic retries, network blips, manual redelivery). The current
--   webhook would double-credit paid customer balance.
--
-- FIX:
--   1. Ensure billing_transactions has `reference` (Stripe idempotency
--      key) and `balance_after_cents` (running balance for the
--      dashboard). The repo has two historical table definitions —
--      sql_migrations/006_billing_transactions.sql added `reference`;
--      sql/013_billing.sql added `balance_after_cents`. The live DB
--      is their union. We ADD COLUMN IF NOT EXISTS for both so this
--      migration works regardless of which path the live DB took.
--   2. Create a partial UNIQUE index scoped to topup rows only:
--          (reference) WHERE type = 'topup'
--                        AND reference IS NOT NULL
--                        AND reference <> ''
--      This lets any pre-existing rows with NULL/empty/non-topup
--      references coexist while guaranteeing that a given Stripe
--      checkout session can produce at most one topup row.
--   3. Replace atomic_balance_topup with a 3-argument version that
--      inserts the ledger row FIRST with ON CONFLICT DO NOTHING and
--      increments the balance only if the insert actually landed.
--      The INSERT + UPDATE run in one transaction, so the unique
--      index — not the edge function — is the authority on idempotency.
--   4. Hard-gate the function to service_role only. No auth.uid() IS
--      NULL fallback, no authenticated path, no superadmin exception.
--      Admin balance corrections must go through a separate, audited
--      RPC to be added later.
--   5. Drop the old 2-arg function so no caller can reach the unsafe
--      signature.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 1. Schema guards
--
-- Idempotent. Each ALTER is a no-op if the column already exists;
-- otherwise the column is added as nullable with no default, so no
-- existing data is touched.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS reference           text;

ALTER TABLE billing_transactions
  ADD COLUMN IF NOT EXISTS balance_after_cents integer;

-- ──────────────────────────────────────────────────────────────
-- 2. Partial UNIQUE index scoped to topup rows
--
-- Predicate matches the inference predicate in the function's
-- ON CONFLICT clause exactly. Legacy rows with NULL/empty reference
-- OR a non-topup type are excluded from the index and cannot collide.
-- ──────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_transactions_topup_reference_unique
  ON billing_transactions(reference)
  WHERE type = 'topup' AND reference IS NOT NULL AND reference <> '';

-- ──────────────────────────────────────────────────────────────
-- 3. Drop the old 2-arg function
--
-- CREATE OR REPLACE FUNCTION cannot change a function's argument
-- list. We need a new arity (added p_stripe_reference), so the old
-- signature must be dropped explicitly. This also guarantees no
-- caller can reach the unsafe 2-arg path after this migration.
-- ──────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS atomic_balance_topup(uuid, integer);

-- ──────────────────────────────────────────────────────────────
-- 4. New idempotent function — service_role only
--
-- Authorization model:
--   This function credits paid-customer balance. The ONLY caller is
--   the Stripe webhook edge function, which connects with the
--   service_role JWT. Nothing else should reach it.
--
--   Inside the body we require auth.role() = 'service_role' with no
--   fallbacks. auth.uid() is intentionally NOT used as an implicit
--   allow path — an unauthenticated psql session also has
--   auth.uid() IS NULL, and we do not want that session to credit
--   balance. REVOKE/GRANT below is the belt; this check is the
--   suspenders.
--
-- Duplicate delivery path:
--   INSERT hits the partial unique index → ON CONFLICT DO NOTHING →
--   v_txn_id IS NULL → function returns the current balance unchanged
--   so the webhook replies 200 and Stripe stops retrying.
--
-- First delivery path:
--   INSERT succeeds → balance is incremented → ledger row is
--   back-filled with balance_after_cents. All three statements run
--   inside the caller's transaction, so a crash anywhere rolls the
--   ledger row back and the next Stripe retry will proceed.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION atomic_balance_topup(
  p_user_id uuid,
  p_amount_cents integer,
  p_stripe_reference text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
  v_txn_id      uuid;
BEGIN
  -- Hard authorization gate. service_role only.
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: atomic_balance_topup requires service_role';
  END IF;

  -- Amount validation (preserved from migration 047).
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_amount_cents > 100000 THEN
    RAISE EXCEPTION 'Amount exceeds maximum (100000 cents = 1000 EUR)';
  END IF;

  -- Stripe reference must be present and non-empty. Without it the
  -- unique index cannot protect us from duplicate credit.
  IF p_stripe_reference IS NULL OR length(p_stripe_reference) = 0 THEN
    RAISE EXCEPTION 'Missing Stripe idempotency reference';
  END IF;

  -- Reserve the idempotency key atomically. If a topup row with this
  -- reference already exists, nothing is inserted and v_txn_id is NULL.
  -- The WHERE clause here matches the partial unique index predicate
  -- verbatim so Postgres infers the correct index.
  INSERT INTO billing_transactions (
    user_id, type, amount_cents, description, reference
  )
  VALUES (
    p_user_id, 'topup', p_amount_cents, 'Guthaben-Aufladung', p_stripe_reference
  )
  ON CONFLICT (reference)
    WHERE type = 'topup' AND reference IS NOT NULL AND reference <> ''
  DO NOTHING
  RETURNING id INTO v_txn_id;

  IF v_txn_id IS NULL THEN
    -- Duplicate Stripe delivery. Return current balance unchanged.
    SELECT balance_cents INTO v_new_balance
    FROM subscriptions WHERE user_id = p_user_id;
    RETURN v_new_balance;
  END IF;

  UPDATE subscriptions
  SET balance_cents = balance_cents + p_amount_cents
  WHERE user_id = p_user_id
  RETURNING balance_cents INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for user %', p_user_id;
  END IF;

  -- Keep the dashboard running total aligned with the new balance.
  UPDATE billing_transactions
  SET balance_after_cents = v_new_balance
  WHERE id = v_txn_id;

  RETURN v_new_balance;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 5. Permissions: service_role only
-- ──────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION atomic_balance_topup(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION atomic_balance_topup(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION atomic_balance_topup(uuid, integer, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION atomic_balance_topup(uuid, integer, text) TO service_role;

COMMIT;
