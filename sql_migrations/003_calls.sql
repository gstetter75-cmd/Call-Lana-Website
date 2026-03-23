-- ============================================================
-- MIGRATION 003 — Calls
-- Requires: 001_profiles.sql, 002_assistants.sql
--
-- Idempotent: safe to re-run on an existing database.
--
-- ── Column mapping to dashboard.html ───────────────────────
--
--   Home page (all-time totals):
--     SELECT id, duration_seconds, created_at WHERE user_id = uid
--
--   Activity feed (last 8):
--     SELECT id, phone_number, caller_name, duration_seconds,
--            status, created_at, assistant_name
--     ORDER BY created_at DESC LIMIT 8
--
--   Weekly stats:
--     SELECT id, duration_seconds WHERE user_id = uid AND created_at >= weekAgo
--
--   Calls page (db.getCalls → select *):
--     Renders: caller_name, assistant_name, duration_seconds,
--              status, phone_number, summary, created_at
--
-- ── Status mapping (UI behaviour) ──────────────────────────
--
--   dashboard.html treats statuses in two groups:
--     MISSED  → status IN ('missed', 'no-answer')
--               → red dot, label "missed call from"
--     NORMAL  → status IN ('completed', 'busy', 'failed')
--               → green dot, label "call with"
--
-- ── Cost — single source of truth ──────────────────────────
--
--   cost is written by the backend webhook (VAPI / Telnyx)
--   when the call ends. The frontend NEVER calculates or
--   displays calls.cost directly.
--   The billing page reads billing_transactions.amount_cents,
--   not calls.cost. dashboardService.js reads calls.cost for
--   KPI aggregation only (it is not loaded by the dashboard).
--
-- ── assistant_name — intentional denormalisation ───────────
--
--   assistant_name is copied from assistants.name at insert
--   time by the backend. This preserves the name that was
--   active during the call even if the assistant is later
--   renamed or deleted.
--
-- ── INSERT — who writes call records ───────────────────────
--
--   Call records are ALWAYS written by backend systems
--   (VAPI webhook, n8n, Telnyx callback), never by the
--   frontend client.
--
--   Two supported approaches:
--
--   A) Supabase service role key (recommended)
--      The backend uses the service_role key, which bypasses
--      RLS entirely. No extra policy is required.
--      Never expose the service_role key in the browser.
--
--   B) SECURITY DEFINER function (for restricted envs)
--      If the backend cannot use the service_role key, call
--      the insert_call_record() function defined below.
--      It runs as the DB owner and ignores RLS.
--
-- ============================================================

CREATE TABLE IF NOT EXISTS calls (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_id     uuid          REFERENCES assistants(id) ON DELETE SET NULL,
  assistant_name   text,
  phone_number     text,
  caller_name      text,
  direction        text          DEFAULT 'inbound'
                     CHECK (direction IN ('inbound', 'outbound')),
  status           text          DEFAULT 'completed'
                     CHECK (status IN ('completed', 'missed', 'no-answer', 'busy', 'failed')),
  duration_seconds integer       DEFAULT 0,
  cost             numeric(10,4) DEFAULT 0,
  summary          text,
  transcript       text,
  created_at       timestamptz   DEFAULT now()
);

-- Ensure columns exist when table was created by an earlier migration run
ALTER TABLE calls ADD COLUMN IF NOT EXISTS assistant_id     uuid        REFERENCES assistants(id) ON DELETE SET NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS assistant_name   text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS phone_number     text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name      text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction        text        DEFAULT 'inbound';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS status           text        DEFAULT 'completed';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS duration_seconds integer     DEFAULT 0;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS cost             numeric(10,4) DEFAULT 0;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary          text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript       text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS created_at       timestamptz DEFAULT now();

-- Ensure CHECK constraints exist
DO $$ BEGIN
  ALTER TABLE calls ADD CONSTRAINT calls_direction_check CHECK (direction IN ('inbound', 'outbound'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE calls ADD CONSTRAINT calls_status_check CHECK (status IN ('completed', 'missed', 'no-answer', 'busy', 'failed'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── RLS ─────────────────────────────────────────────────────

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_calls_all"      ON calls;
DROP POLICY IF EXISTS "users_own_calls_select"    ON calls;

-- Superadmin sees all records (across all users)
CREATE POLICY "superadmin_calls_all"
  ON calls FOR ALL
  USING (is_superadmin());

-- Authenticated users can only read their own call records
CREATE POLICY "users_own_calls_select"
  ON calls FOR SELECT
  USING (user_id = auth.uid());

-- No client-side INSERT / UPDATE / DELETE policies.
-- All writes come from the backend via service_role key (bypasses RLS)
-- or via insert_call_record() SECURITY DEFINER function below.

-- ── SECURITY DEFINER insert function (Approach B) ───────────
--
-- Use this if your backend cannot use the service_role key.
-- Call it with: SELECT insert_call_record(...)
-- It validates user_id ownership via profiles table.

CREATE OR REPLACE FUNCTION insert_call_record(
  p_user_id          uuid,
  p_assistant_id     uuid,
  p_assistant_name   text,
  p_phone_number     text,
  p_caller_name      text,
  p_direction        text,
  p_status           text,
  p_duration_seconds integer,
  p_cost             numeric,
  p_summary          text,
  p_transcript       text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Validate that the target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User % does not exist', p_user_id;
  END IF;

  -- Validate status
  IF p_status NOT IN ('completed', 'missed', 'no-answer', 'busy', 'failed') THEN
    RAISE EXCEPTION 'Invalid call status: %', p_status;
  END IF;

  INSERT INTO calls (
    user_id, assistant_id, assistant_name,
    phone_number, caller_name, direction, status,
    duration_seconds, cost, summary, transcript
  ) VALUES (
    p_user_id, p_assistant_id, p_assistant_name,
    p_phone_number, p_caller_name, p_direction, p_status,
    p_duration_seconds, p_cost, p_summary, p_transcript
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── Grant control for insert_call_record() ──────────────────

REVOKE ALL ON FUNCTION insert_call_record(
  uuid, uuid, text, text, text, text, text, integer, numeric, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION insert_call_record(
  uuid, uuid, text, text, text, text, text, integer, numeric, text, text
) TO service_role;

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_calls_user_id    ON calls(user_id);
CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_user_date  ON calls(user_id, created_at DESC);
