-- ============================================================
-- MIGRATION 045 — Assistant Configuration Fields
--
-- The assistant editor in dashboard.html saves these fields
-- which were absent from the assistants table schema.
-- Without this migration every assistant save fails with a
-- PostgREST 400 "column does not exist" error.
--
-- Fields added:
--   greeting        — VAPI firstMessage (the opening line Lana speaks)
--   max_duration    — maximum call duration in seconds (VAPI maxDurationSeconds)
--   tools           — JSONB {calendar, crm, email, knowledge_base} flags
--   post_processing — JSONB {summary, transcript_email, sentiment} flags
--
-- Note: model and temperature are intentionally excluded.
-- VAPI manages its own model selection; exposing them to customers
-- is misleading and not needed for v1.
--
-- Idempotent: safe to re-run on an existing database.
-- ============================================================

ALTER TABLE assistants ADD COLUMN IF NOT EXISTS greeting        text;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS max_duration    integer  DEFAULT 300;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS tools           jsonb    DEFAULT '{}'::jsonb;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS post_processing jsonb    DEFAULT '{}'::jsonb;

-- Index on status is already present (idx_assistants_status from 002_assistants.sql).
-- The CHECK constraint allows: 'offline', 'active', 'online', 'paused'.
-- Dashboard UI now uses 'active' (not the previous 'live') to match this constraint.
