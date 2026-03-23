-- ============================================================
-- MIGRATION 002 — Assistants
-- Requires: 001_profiles.sql (is_superadmin, update_updated_at_column)
--
-- Idempotent: safe to re-run on an existing database.
--
-- Columns mapped to dashboard.html queries:
--   SELECT id, name, voice, language, status, phone_number, created_at
--   INSERT { name, voice, language, status }   (via db.js createAssistant)
--   UPDATE { status }                          (via db.js updateAssistant)
--   READ   assistant.outbound?.enabled         (settings panel)
-- ============================================================

CREATE TABLE IF NOT EXISTS assistants (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text         NOT NULL,
  voice          text,
  language       text         DEFAULT 'de',
  status         text         NOT NULL DEFAULT 'offline'
                   CHECK (status IN ('offline', 'active', 'online', 'paused')),
  phone_number   text,
  system_prompt  text,
  outbound       jsonb        DEFAULT '{"enabled": false}'::jsonb,
  call_count     integer      DEFAULT 0,
  created_at     timestamptz  DEFAULT now(),
  updated_at     timestamptz  DEFAULT now()
);

-- Ensure columns exist when table was created by an earlier migration run
-- (CREATE TABLE IF NOT EXISTS silently skips if the table already exists)
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS voice         text;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS language      text        DEFAULT 'de';
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS status        text        NOT NULL DEFAULT 'offline';
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS phone_number  text;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS system_prompt text;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS outbound      jsonb       DEFAULT '{"enabled": false}'::jsonb;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS call_count    integer     DEFAULT 0;
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now();
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS updated_at    timestamptz DEFAULT now();

-- Ensure CHECK constraint on status exists
DO $$ BEGIN
  ALTER TABLE assistants ADD CONSTRAINT assistants_status_check
    CHECK (status IN ('offline', 'active', 'online', 'paused'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;

-- Policies — drop first so re-runs are safe
DROP POLICY IF EXISTS "superadmin_assistants_all"   ON assistants;
DROP POLICY IF EXISTS "users_own_assistants_select" ON assistants;
DROP POLICY IF EXISTS "users_own_assistants_insert" ON assistants;
DROP POLICY IF EXISTS "users_own_assistants_update" ON assistants;
DROP POLICY IF EXISTS "users_own_assistants_delete" ON assistants;

CREATE POLICY "superadmin_assistants_all"   ON assistants FOR ALL    USING (is_superadmin());
CREATE POLICY "users_own_assistants_select" ON assistants FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_assistants_insert" ON assistants FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_assistants_update" ON assistants FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_assistants_delete" ON assistants FOR DELETE USING (user_id = auth.uid());

-- Auto updated_at
CREATE OR REPLACE TRIGGER set_assistants_updated_at
  BEFORE UPDATE ON assistants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assistants_user_id ON assistants(user_id);
CREATE INDEX IF NOT EXISTS idx_assistants_status  ON assistants(status);
