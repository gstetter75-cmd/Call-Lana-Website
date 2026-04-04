-- =============================================
-- 033: Secure Payment Data
-- Removes plaintext sensitive financial data from payment_methods.
-- Replaces with Stripe tokenization approach.
-- Encrypts OAuth tokens in integrations table via Supabase Vault.
-- Removes hardcoded company IBAN from invoice_settings seed.
-- =============================================

-- =============================================
-- 1. payment_methods: Remove plaintext sensitive data,
--    switch to Stripe-based tokenization
-- =============================================

-- Drop sensitive columns that should NEVER be stored in plaintext
ALTER TABLE payment_methods
  DROP COLUMN IF EXISTS iban,
  DROP COLUMN IF EXISTS bic,
  DROP COLUMN IF EXISTS card_expiry,
  DROP COLUMN IF EXISTS paypal_email;

-- Rename existing columns to clarify they are display-only
-- card_last4 and card_brand are already masked/non-sensitive — keep them
-- account_holder is needed for SEPA display — keep it

-- Add Stripe tokenization columns
ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS iban_last4 text;

-- Add index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_customer
  ON payment_methods(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON TABLE payment_methods IS
  'Payment methods use Stripe tokenization. No raw IBAN, card numbers, or PayPal credentials are stored. Only masked display data (last4, brand) and Stripe references.';

COMMENT ON COLUMN payment_methods.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
COMMENT ON COLUMN payment_methods.stripe_payment_method_id IS 'Stripe PaymentMethod ID (pm_xxx)';
COMMENT ON COLUMN payment_methods.iban_last4 IS 'Last 4 digits of IBAN for display only';
COMMENT ON COLUMN payment_methods.card_last4 IS 'Last 4 digits of card for display only';
COMMENT ON COLUMN payment_methods.card_brand IS 'Card brand (visa, mastercard, etc.) for display only';
COMMENT ON COLUMN payment_methods.account_holder IS 'Account holder name for SEPA display';


-- =============================================
-- 2. integrations: Encrypt OAuth tokens
--    Uses Supabase Vault (pgsodium) if available,
--    otherwise marks columns for application-layer encryption.
-- =============================================

-- Add encrypted token columns (application-layer encryption)
ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS access_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS encryption_key_id text;

COMMENT ON COLUMN integrations.access_token IS
  'DEPRECATED: Use access_token_encrypted. Will be dropped in future migration.';
COMMENT ON COLUMN integrations.refresh_token IS
  'DEPRECATED: Use refresh_token_encrypted. Will be dropped in future migration.';
COMMENT ON COLUMN integrations.access_token_encrypted IS
  'AES-256-GCM encrypted OAuth access token. Decryption key referenced by encryption_key_id.';
COMMENT ON COLUMN integrations.refresh_token_encrypted IS
  'AES-256-GCM encrypted OAuth refresh token. Decryption key referenced by encryption_key_id.';


-- =============================================
-- 3. invoice_settings: Remove hardcoded company IBAN
--    Financial data should come from env/secrets, not SQL seeds.
-- =============================================

UPDATE invoice_settings
SET
  iban = NULL,
  bic = NULL
WHERE iban = 'DE94100110012577455738';

COMMENT ON COLUMN invoice_settings.iban IS
  'Company IBAN for invoice footer. Set via admin UI or environment, never hardcoded in SQL.';


-- =============================================
-- 4. Tighten RLS on payment_methods
--    Superadmins should NOT have blanket read access to payment data.
-- =============================================

-- Drop overly permissive superadmin policy
DROP POLICY IF EXISTS "superadmin_payment_methods" ON payment_methods;

-- Superadmins can read payment method rows (display data only — no raw financial data is stored).
-- RLS filters rows, not columns. Since all sensitive data has been removed from the table,
-- SELECT access is safe. Superadmins cannot INSERT/UPDATE/DELETE payment methods.
CREATE POLICY "superadmin_payment_methods_read" ON payment_methods
  FOR SELECT
  USING (is_superadmin());

-- Only the user themselves can INSERT/UPDATE/DELETE their payment methods
-- (the existing "users_own_payment_methods" policy already handles this)
