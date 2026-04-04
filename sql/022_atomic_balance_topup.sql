-- Atomic balance topup to prevent race conditions.
-- SECURITY: caller must be the target user or a superadmin.
-- IMPORTANT: in production this function must ONLY be invoked
-- from a verified Stripe payment webhook — never from the browser.
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
