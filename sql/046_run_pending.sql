-- ============================================================
-- RUN PENDING MIGRATIONS (041 → 045)
--
-- Run this in Supabase SQL Editor to bring the database
-- fully up to date with the current codebase.
--
-- All migrations are idempotent — safe to re-run.
-- Run in this order.
-- ============================================================

-- ── 041: Signup Fix ───────────────────────────────────────────
-- Auto-creates missing profile rows on Supabase auth signup edge cases.
-- (Contents of 041_signup_fix.sql)
\i sql/041_signup_fix.sql

-- ── 042: Billing Security Lockdown ───────────────────────────
-- Revokes EXECUTE on atomic_balance_topup from PUBLIC/authenticated.
-- Adds prevent_balance_mutation trigger on subscriptions.
-- Restricts billing_transactions to SELECT for customers.
-- (Contents of 042_billing_security_lockdown.sql)
\i sql/042_billing_security_lockdown.sql

-- ── 043: VAPI Provider Fields on Assistants ──────────────────
-- Adds provider, provider_assistant_id, provider_phone_number_id
-- to assistants table for reliable webhook matching.
-- (Contents of 043_vapi_provider_fields.sql)
\i sql/043_vapi_provider_fields.sql

-- ── 044: Calls Provider Idempotency ──────────────────────────
-- Adds provider + provider_call_id to calls table.
-- Unique partial index prevents duplicate call records from
-- VAPI retried webhooks.
-- (Contents of 044_calls_provider_idempotency.sql)
\i sql/044_calls_provider_idempotency.sql

-- ── 045: Assistant Configuration Fields ──────────────────────
-- Adds greeting, max_duration, tools (jsonb), post_processing (jsonb)
-- to assistants table. Required for dashboard assistant save to work.
-- (Contents of 045_assistant_fields.sql)
\i sql/045_assistant_fields.sql

-- ============================================================
-- NOTE: The \i commands above work in psql CLI.
-- In Supabase SQL Editor, paste each migration file content
-- individually and run them in order.
--
-- After running all migrations:
--
-- VAPI SETUP (in VAPI dashboard):
--   1. Set Server URL to:
--      https://dtfbwqborzjjhqwtobhl.supabase.co/functions/v1/vapi-webhook
--   2. Set the x-vapi-secret header to a strong random secret
--   3. In Supabase: set VAPI_WEBHOOK_SECRET env var to that same secret
--   4. Assign a phone number to your VAPI assistant
--   5. In Call Lana dashboard: enter the VAPI phone number ID
--      (provider_phone_number_id) and assistant ID (provider_assistant_id)
--      on the assistant record
--
-- STRIPE SETUP (after running migrations):
--   1. Set STRIPE_SECRET_KEY in Supabase Edge Function secrets
--   2. Set STRIPE_WEBHOOK_SECRET in Supabase Edge Function secrets
--   3. In Stripe dashboard: add webhook endpoint:
--      https://dtfbwqborzjjhqwtobhl.supabase.co/functions/v1/stripe-webhook
--   4. Select events: checkout.session.completed, invoice.paid,
--      invoice.payment_failed, customer.subscription.updated,
--      customer.subscription.deleted
--   5. (Optional) Set STRIPE_PRICE_STARTER / STRIPE_PRICE_PRO for plan upgrades
--
-- DEPLOY EDGE FUNCTIONS (Supabase CLI):
--   supabase functions deploy vapi-webhook
--   supabase functions deploy create-checkout-session
--   supabase functions deploy stripe-webhook
-- ============================================================
