-- ============================================================
-- MIGRATION 001 — Profiles
-- Run first. Defines: profiles table, RLS, role enum,
--   is_superadmin() helper.
--
-- Idempotent: safe to re-run on an existing database.
--
-- Note: No triggers on auth.users are used here.
--   Profile rows are created by the frontend JS after signup
--   (see registrierung.html). A fallback upsert runs on first
--   dashboard load for the email-confirmation flow.
-- ============================================================

-- 1. Role enum
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('superadmin', 'sales', 'customer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Profiles table (extends auth.users 1-to-1)
CREATE TABLE IF NOT EXISTS profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role           user_role    NOT NULL DEFAULT 'customer',
  first_name     text,
  last_name      text,
  email          text,
  company        text,
  industry       text,
  phone          text,
  avatar_url     text,
  is_active      boolean      DEFAULT true,
  created_at     timestamptz  DEFAULT now(),
  updated_at     timestamptz  DEFAULT now()
);

-- Ensure role column exists when table was created by an earlier migration run
-- (CREATE TABLE IF NOT EXISTS above silently skips if table already exists)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'customer';

-- 3. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper: check superadmin via profiles.role (SECURITY DEFINER bypasses RLS — no recursion).
-- Does NOT read raw_user_meta_data, so auth metadata injection has no effect.
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND "role" = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Policies — drop first so re-runs are safe
DROP POLICY IF EXISTS "superadmin_profiles_all"   ON profiles;
DROP POLICY IF EXISTS "users_read_own_profile"    ON profiles;
DROP POLICY IF EXISTS "users_insert_own_profile"  ON profiles;
DROP POLICY IF EXISTS "users_update_own_profile"  ON profiles;

CREATE POLICY "superadmin_profiles_all"   ON profiles FOR ALL    USING (is_superadmin());
CREATE POLICY "users_read_own_profile"    ON profiles FOR SELECT USING (id = auth.uid());

-- INSERT: authenticated user can only insert their own row, and only as 'customer'.
-- Prevents INSERT-time role escalation (protect_profile_role only fires on UPDATE).
CREATE POLICY "users_insert_own_profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() AND "role" = 'customer');

-- UPDATE: authenticated user can update their own row.
-- Column-level protection against role escalation is handled by the trigger below.
CREATE POLICY "users_update_own_profile"  ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 4. Prevent self-escalation of role in profiles table
--    Without this, a user can call supabase.from('profiles').update({ role: 'superadmin' })
--    and the UPDATE policy above would allow it (it only checks id = auth.uid()).
CREATE OR REPLACE FUNCTION protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow role change only if the caller is already a superadmin
  IF OLD."role" IS DISTINCT FROM NEW."role" AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Role change not permitted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER no_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_role();

-- 5. updated_at helper (reused by other migrations)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles("role");
