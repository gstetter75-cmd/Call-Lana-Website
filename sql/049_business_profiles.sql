-- ============================================================
-- MIGRATION 049 — Business Profiles (Betriebsprofil)
--
-- Per-customer structured business data for the Handwerksbetrieb
-- using Call Lana. Feeds the customer-facing "Betrieb" page and
-- the support/n8n prompt-generation flow.
--
-- This table is intentionally NARROW. It does NOT duplicate:
--   - company name        -> profiles.company
--   - billing address     -> profiles.{street,zip,city,country,vat_id}
--   - emergency settings  -> user_settings.emergency_*
--   - opening hours       -> working_hours
--
-- 1:1 with auth.users (user_id is the PK). Multi-assistant setups
-- still share a single Betriebsprofil — that is the intended semantics.
--
-- Depends on:
--   001_profiles.sql  -> is_superadmin(), update_updated_at_column()
--
-- Idempotent: safe to re-run on an existing database.
-- ============================================================

CREATE TABLE IF NOT EXISTS business_profiles (
  user_id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stammdaten
  trade                text        NOT NULL,
  contact_name         text,
  contact_phone        text,
  website_url          text,

  -- Leistungen & Einsatzgebiet
  services             text[]      NOT NULL DEFAULT '{}',
  services_custom      text,
  service_area_zips    text[]      NOT NULL DEFAULT '{}',
  service_area_text    text,
  accepts_new_clients  text        NOT NULL DEFAULT 'yes'
                         CHECK (accepts_new_clients IN ('yes','no','peak_only')),

  -- Anrufverhalten
  booking_mode         text        NOT NULL DEFAULT 'callback'
                         CHECK (booking_mode IN ('direct','callback')),
  callback_window      text        NOT NULL DEFAULT '24h'
                         CHECK (callback_window IN ('today','24h','48h')),
  do_not_handle        text,

  -- Provenance
  source               text        NOT NULL DEFAULT 'manual'
                         CHECK (source IN ('manual','support','website_extracted')),

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;

-- Drop first so re-runs are safe
DROP POLICY IF EXISTS "superadmin_business_profiles_all"  ON business_profiles;
DROP POLICY IF EXISTS "users_select_own_business_profile" ON business_profiles;
DROP POLICY IF EXISTS "users_insert_own_business_profile" ON business_profiles;
DROP POLICY IF EXISTS "users_update_own_business_profile" ON business_profiles;
DROP POLICY IF EXISTS "users_delete_own_business_profile" ON business_profiles;

-- Superadmin: full access (helper defined in 001_profiles.sql)
CREATE POLICY "superadmin_business_profiles_all"
  ON business_profiles FOR ALL
  USING (is_superadmin());

-- Users may only manage their own row
CREATE POLICY "users_select_own_business_profile"
  ON business_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_business_profile"
  ON business_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_business_profile"
  ON business_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_business_profile"
  ON business_profiles FOR DELETE
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- Auto updated_at (trigger function defined in 001_profiles.sql)
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS set_business_profiles_updated_at ON business_profiles;
CREATE TRIGGER set_business_profiles_updated_at
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
