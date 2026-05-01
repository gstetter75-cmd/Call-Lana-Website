-- ============================================================
-- MIGRATION 042 — Billing Security Lockdown
-- Idempotent: safe to re-run on an existing database.
--
-- ROOT CAUSES FIXED:
--
--   Issue A — atomic_balance_topup callable by any authenticated user
--     PostgreSQL grants EXECUTE to PUBLIC by default. No REVOKE
--     exists in any prior migration. Any customer with a valid JWT
--     can call supabaseClient.rpc('atomic_balance_topup', {
--       p_user_id: user.id, p_amount_cents: 100000
--     }) and credit 1,000 EUR to their own balance with zero payment.
--
--   Issue B — subscriptions table allows direct balance mutation
--     The RLS policy "users_own_subscription" is FOR ALL, meaning
--     a customer can call supabaseClient.from('subscriptions')
--     .update({ balance_cents: 999999, included_minutes: 9999 })
--     via the REST API. The prevent_plan_self_escalation trigger
--     only blocks the `plan` column. All other financial columns
--     (balance_cents, included_minutes, status, service_active,
--     stripe_*, plan_price_cents, used_minutes, overage_minutes,
--     current_period_*) are completely unguarded.
--
--   Issue C — billing_transactions open to customer writes
--     "users_own_billing_transactions" is FOR ALL. Customers can
--     INSERT fake topup records and DELETE their own usage_charge
--     records, corrupting the billing audit trail.
--
--   Issue D — generate_monthly_invoices() callable by any
--     authenticated user. SECURITY DEFINER + no REVOKE means any
--     customer can trigger global invoice generation for all users.
--
-- FIXES:
--   1. Revoke EXECUTE on atomic_balance_topup from PUBLIC/authenticated
--   2. Update atomic_balance_topup to allow service_role (NULL auth.uid)
--   3. Add prevent_balance_mutation trigger on subscriptions
--   4. Restrict billing_transactions to SELECT for customers
--   5. Revoke EXECUTE on generate_monthly_invoices from PUBLIC
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- FIX 1: Revoke EXECUTE on atomic_balance_topup from all
--        non-service roles.
--
-- PostgreSQL default grants EXECUTE to PUBLIC, which includes the
-- 'authenticated' role that Supabase's PostgREST uses for all
-- logged-in users. No prior migration revoked this. The result:
-- any customer can call the function directly via the JS SDK
-- regardless of UI guards.
--
-- After this fix the function is callable only by service_role
-- (used by Edge Functions / Stripe webhooks). The service_role
-- bypasses all PostgreSQL permission checks by design, but the
-- explicit GRANT makes intent clear and is belt-and-suspenders.
-- ──────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION atomic_balance_topup(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION atomic_balance_topup(uuid, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION atomic_balance_topup(uuid, integer) FROM anon;

-- Explicit grant to service_role (defensive; it bypasses grants anyway)
GRANT EXECUTE ON FUNCTION atomic_balance_topup(uuid, integer) TO service_role;

-- ──────────────────────────────────────────────────────────────
-- FIX 2: Update atomic_balance_topup to handle service_role.
--
-- The existing auth check: IF p_user_id IS DISTINCT FROM auth.uid()
-- fails for service_role because auth.uid() returns NULL when there
-- is no JWT context. In SQL, (any_uuid IS DISTINCT FROM NULL) = TRUE,
-- so service_role calls were blocked by their own guard.
--
-- Fix: add auth.uid() IS NOT NULL to the condition so that the check
-- only applies when there actually is an authenticated caller.
-- Unauthenticated/service_role calls (auth.uid() IS NULL) bypass
-- the cross-user check — which is intentional since service_role is
-- the trusted Stripe webhook path.
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
  -- SECURITY: block cross-user balance mutation for authenticated callers.
  -- Service_role has no JWT, so auth.uid() IS NULL → allowed (Stripe webhook path).
  -- Authenticated users may only top up their own account, and only superadmins
  -- may top up any account.
  -- IMPORTANT: this function must only be invoked from a verified Stripe payment
  -- webhook running under service_role. Direct browser/SDK calls are blocked
  -- by REVOKE EXECUTE (migration 042).
  IF auth.uid() IS NOT NULL
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT is_superadmin()
  THEN
    RAISE EXCEPTION 'Unauthorized: cannot top up balance for user %', p_user_id;
  END IF;

  -- Validate input
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_amount_cents > 100000 THEN  -- max 1,000 EUR per call
    RAISE EXCEPTION 'Amount exceeds maximum (100000 cents = 1000 EUR)';
  END IF;

  -- Atomic update (runs as SECURITY DEFINER, bypasses RLS on subscriptions)
  UPDATE subscriptions
  SET balance_cents = balance_cents + p_amount_cents
  WHERE user_id = p_user_id
  RETURNING balance_cents INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for user %', p_user_id;
  END IF;

  -- Append to the billing ledger
  INSERT INTO billing_transactions (user_id, type, amount_cents, description)
  VALUES (p_user_id, 'topup', p_amount_cents, 'Guthaben-Aufladung');

  RETURN v_new_balance;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- FIX 3: Block direct customer writes to financial columns on
--        the subscriptions table.
--
-- The existing RLS policy "users_own_subscription" is FOR ALL,
-- permitting a customer to UPDATE any column via the Supabase
-- REST API. The existing prevent_plan_self_escalation trigger
-- only guards the `plan` column. This trigger extends that
-- protection to all financial and administrative fields.
--
-- Columns a customer MAY still update (preference fields only):
--   auto_reload_enabled, auto_reload_threshold_cents,
--   auto_reload_amount_cents, hard_cap_enabled, hard_cap_cents
--
-- All other fields require service_role (auth.uid() IS NULL)
-- or superadmin.
--
-- NOTE: triggers fire even for SECURITY DEFINER functions, so
-- the service_role NULL-check is critical for atomic_balance_topup
-- to keep working after this migration.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service_role has no JWT context; auth.uid() IS NULL.
  -- Allow all changes from the trusted backend path.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Superadmins may change any field.
  IF is_superadmin() THEN
    RETURN NEW;
  END IF;

  -- ── Block every financial / administrative column ──────────

  IF OLD.balance_cents IS DISTINCT FROM NEW.balance_cents THEN
    RAISE EXCEPTION
      'Direct mutation of balance_cents is not permitted. '
      'Balance must be updated via the verified payment flow.';
  END IF;

  IF OLD.included_minutes IS DISTINCT FROM NEW.included_minutes THEN
    RAISE EXCEPTION 'Direct mutation of included_minutes is not permitted.';
  END IF;

  IF OLD.plan IS DISTINCT FROM NEW.plan THEN
    RAISE EXCEPTION 'Plan change not permitted.';
  END IF;

  IF OLD.plan_price_cents IS DISTINCT FROM NEW.plan_price_cents THEN
    RAISE EXCEPTION 'Direct mutation of plan_price_cents is not permitted.';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Direct mutation of subscription status is not permitted.';
  END IF;

  IF OLD.service_active IS DISTINCT FROM NEW.service_active THEN
    RAISE EXCEPTION 'Direct mutation of service_active is not permitted.';
  END IF;

  IF OLD.paused_reason IS DISTINCT FROM NEW.paused_reason THEN
    RAISE EXCEPTION 'Direct mutation of paused_reason is not permitted.';
  END IF;

  IF OLD.used_minutes IS DISTINCT FROM NEW.used_minutes THEN
    RAISE EXCEPTION 'Direct mutation of used_minutes is not permitted.';
  END IF;

  IF OLD.overage_minutes IS DISTINCT FROM NEW.overage_minutes THEN
    RAISE EXCEPTION 'Direct mutation of overage_minutes is not permitted.';
  END IF;

  IF OLD.stripe_customer_id IS DISTINCT FROM NEW.stripe_customer_id THEN
    RAISE EXCEPTION 'Direct mutation of stripe_customer_id is not permitted.';
  END IF;

  IF OLD.stripe_subscription_id IS DISTINCT FROM NEW.stripe_subscription_id THEN
    RAISE EXCEPTION 'Direct mutation of stripe_subscription_id is not permitted.';
  END IF;

  IF OLD.stripe_price_id IS DISTINCT FROM NEW.stripe_price_id THEN
    RAISE EXCEPTION 'Direct mutation of stripe_price_id is not permitted.';
  END IF;

  IF OLD.current_period_start IS DISTINCT FROM NEW.current_period_start THEN
    RAISE EXCEPTION 'Direct mutation of current_period_start is not permitted.';
  END IF;

  IF OLD.current_period_end IS DISTINCT FROM NEW.current_period_end THEN
    RAISE EXCEPTION 'Direct mutation of current_period_end is not permitted.';
  END IF;

  -- Preference fields (auto_reload_*, hard_cap_*) are intentionally
  -- NOT checked here — customers may update their own preferences.

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS no_balance_mutation ON subscriptions;
CREATE TRIGGER no_balance_mutation
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION prevent_balance_mutation();

-- ──────────────────────────────────────────────────────────────
-- FIX 4: Restrict billing_transactions to SELECT for customers.
--
-- The "users_own_billing_transactions" policy was FOR ALL, letting
-- customers INSERT fake topup/credit records and DELETE/UPDATE
-- their own usage_charge records. Transaction rows must only be
-- written by SECURITY DEFINER functions (atomic_balance_topup,
-- Stripe webhook edge function) running under service_role.
-- ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "users_own_billing_transactions" ON billing_transactions;

CREATE POLICY "users_read_own_billing_transactions" ON billing_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- superadmin_billing_transactions (FOR ALL) already covers admin writes;
-- service_role bypasses RLS entirely for all backend writes.

-- ──────────────────────────────────────────────────────────────
-- FIX 5: Revoke EXECUTE on generate_monthly_invoices from PUBLIC.
--
-- SECURITY DEFINER + no REVOKE = any authenticated customer can
-- trigger invoice generation for ALL users. This function must
-- only run from a pg_cron scheduled job or service_role admin call.
-- ──────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION generate_monthly_invoices() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION generate_monthly_invoices() FROM authenticated;
REVOKE EXECUTE ON FUNCTION generate_monthly_invoices() FROM anon;

GRANT EXECUTE ON FUNCTION generate_monthly_invoices() TO service_role;

COMMIT;
