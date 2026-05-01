-- ============================================================
-- MIGRATION 044 — Provider Fields on Calls + Idempotency Index
--
-- Adds two columns to the calls table:
--
--   provider          — telephony provider tag (e.g. 'vapi')
--   provider_call_id  — provider's call UUID (VAPI's call.id)
--
-- A unique partial index on (provider, provider_call_id) prevents
-- duplicate rows when the same end-of-call-report webhook fires
-- more than once. The index is partial so NULL provider_call_id
-- rows (legacy / manually inserted calls) are unaffected.
--
-- Idempotent: safe to re-run on an existing database.
-- ============================================================

ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider         text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS provider_call_id text;

-- Unique partial index: one row per (provider, provider_call_id).
-- Rows without a provider_call_id (legacy inserts) are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_provider_call_id
  ON calls(provider, provider_call_id)
  WHERE provider_call_id IS NOT NULL;
