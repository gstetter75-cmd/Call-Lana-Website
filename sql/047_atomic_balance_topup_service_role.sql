-- ============================================================
-- MIGRATION 047 — atomic_balance_topup: allow service_role
-- Idempotent: safe to re-run.
--
-- ROOT CAUSE:
--   The function's existing guard is:
--     IF p_user_id IS DISTINCT FROM auth.uid() AND NOT is_superadmin() ...
--   Under the Stripe webhook (service_role, no JWT) auth.uid() is NULL.
--   In SQL, (any_uuid IS DISTINCT FROM NULL) = TRUE, so the function
--   raises 'Unauthorized: cannot top up balance for user %' even
--   though the caller is the trusted service_role.
--
-- FIX:
--   Only apply the cross-user check when there IS an authenticated
--   caller. Service_role (auth.uid() IS NULL) bypasses the check,
--   which is correct: direct customer RPC access is separately
--   blocked via REVOKE EXECUTE ... FROM authenticated (migration 042).
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION atomic_balance_topup(
  p_user_id uuid,
  p_amount_cents integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF auth.uid() IS NOT NULL
     AND p_user_id IS DISTINCT FROM auth.uid()
     AND NOT is_superadmin()
  THEN
    RAISE EXCEPTION 'Unauthorized: cannot top up balance for user %', p_user_id;
  END IF;

  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_amount_cents > 100000 THEN
    RAISE EXCEPTION 'Amount exceeds maximum (100000 cents = 1000 EUR)';
  END IF;

  UPDATE subscriptions
  SET balance_cents = balance_cents + p_amount_cents
  WHERE user_id = p_user_id
  RETURNING balance_cents INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found for user %', p_user_id;
  END IF;

  INSERT INTO billing_transactions (user_id, type, amount_cents, description)
  VALUES (p_user_id, 'topup', p_amount_cents, 'Guthaben-Aufladung');

  RETURN v_new_balance;
END;
$$;

COMMIT;
