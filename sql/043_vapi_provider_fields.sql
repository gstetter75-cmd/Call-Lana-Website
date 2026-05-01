-- ============================================================
-- MIGRATION 043 — VAPI Provider Fields on Assistants
--
-- Adds three columns to assistants so the VAPI webhook can
-- reliably match an inbound call to its assistant row without
-- relying solely on phone_number string matching.
--
-- provider                — telephony provider tag (default 'vapi')
-- provider_assistant_id   — VAPI's assistant UUID (asst_xxx)
-- provider_phone_number_id — VAPI's phone-number UUID (ph_xxx)
--
-- phone_number is preserved unchanged.
-- Idempotent: safe to re-run on an existing database.
-- ============================================================

ALTER TABLE assistants ADD COLUMN IF NOT EXISTS provider                 text DEFAULT 'vapi';
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS provider_assistant_id    text;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS provider_phone_number_id text;

-- Index for the primary webhook lookup:
--   WHERE provider = 'vapi' AND provider_phone_number_id = $1
-- Partial index keeps it tiny — only rows that have been configured.
CREATE INDEX IF NOT EXISTS idx_assistants_provider_phone_id
  ON assistants(provider, provider_phone_number_id)
  WHERE provider_phone_number_id IS NOT NULL;
