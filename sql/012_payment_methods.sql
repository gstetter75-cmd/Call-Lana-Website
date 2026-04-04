-- Payment methods table with SEPA mandate support
-- Supports primary + fallback payment method per user

-- IMPORTANT: No raw financial data (IBAN, card numbers, PayPal emails) is stored.
-- All payment processing uses Stripe tokenization.
-- Only masked display data (last4, brand) and Stripe references are kept.
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sepa', 'credit_card', 'paypal')),
  priority smallint NOT NULL DEFAULT 1 CHECK (priority IN (1, 2)),
  -- Stripe tokenization (the ONLY way payment data is handled)
  stripe_customer_id text,
  stripe_payment_method_id text,
  -- SEPA display-only fields (masked)
  iban_last4 text,
  account_holder text,
  mandate_reference text UNIQUE,
  mandate_date timestamptz,
  mandate_confirmed boolean DEFAULT false,
  -- Credit card display-only fields (masked)
  card_last4 text,
  card_brand text,
  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'revoked', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- One primary (1) and one fallback (2) per user
  UNIQUE (user_id, priority)
);

-- Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own payment methods
CREATE POLICY "users_own_payment_methods" ON payment_methods
  FOR ALL USING (auth.uid() = user_id);

-- Superadmins can see all payment methods
CREATE POLICY "superadmin_payment_methods" ON payment_methods
  FOR ALL USING (is_superadmin());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_payment_methods_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_methods_updated
  BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_payment_methods_timestamp();
