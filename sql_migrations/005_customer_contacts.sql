-- ============================================================
-- MIGRATION 005 — Customer Contacts
-- Requires: 001_profiles.sql
--
-- Idempotent: safe to re-run on an existing database.
--
-- Columns mapped to dashboard.html:
--
--   Home page count:
--     SELECT *, count:exact FROM customer_contacts WHERE user_id = uid
--
--   Contacts page (loadContactsPage):
--     SELECT id, first_name, last_name, company, phone, email, created_at
--     WHERE user_id = uid ORDER BY created_at DESC LIMIT 50
--
--   renderContacts() renders: first_name, last_name, company, email, phone, created_at
--
-- Contacts are created automatically from inbound calls (by backend webhook)
-- or can be added manually.
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_contacts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name   text,
  last_name    text,
  company      text,
  phone        text,
  email        text,
  notes        text,
  source       text        DEFAULT 'call',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Ensure columns exist when table was created by an earlier migration run
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS first_name   text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS last_name    text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS company      text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS phone        text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS email        text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS notes        text;
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS source       text        DEFAULT 'call';
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();
ALTER TABLE customer_contacts ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

-- RLS
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_contacts_all"   ON customer_contacts;
DROP POLICY IF EXISTS "users_own_contacts_select" ON customer_contacts;
DROP POLICY IF EXISTS "users_own_contacts_insert" ON customer_contacts;
DROP POLICY IF EXISTS "users_own_contacts_update" ON customer_contacts;
DROP POLICY IF EXISTS "users_own_contacts_delete" ON customer_contacts;

CREATE POLICY "superadmin_contacts_all"   ON customer_contacts FOR ALL    USING (is_superadmin());
CREATE POLICY "users_own_contacts_select" ON customer_contacts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users_own_contacts_insert" ON customer_contacts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_contacts_update" ON customer_contacts FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_own_contacts_delete" ON customer_contacts FOR DELETE USING (user_id = auth.uid());

-- Auto updated_at
CREATE OR REPLACE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON customer_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id    ON customer_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON customer_contacts(created_at DESC);
