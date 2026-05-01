-- ============================================================
-- MIGRATION 041 — Signup Fix
-- Idempotent: safe to re-run.
--
-- ROOT CAUSE (two layered issues):
--
--   Issue A — create_profile_for_user() missing SET search_path:
--     The live DB function public.create_profile_for_user() uses
--     SECURITY DEFINER but has no SET search_path = public and
--     inserts into 'profiles' (unqualified) instead of
--     'public.profiles'. Under SECURITY DEFINER the search_path
--     can be manipulated, causing the insert to fail or hit the
--     wrong schema → GoTrue returns 500.
--
--   Issue B — subscriptions table missing:
--     The `subscriptions` table was never in a SQL migration file.
--     It only existed on the old project via Supabase Studio.
--     create_default_subscription() fires after every profile
--     insert and fails when the table doesn't exist.
--
--   Full signup trigger chain:
--     auth.users INSERT
--       → on_auth_user_created → create_profile_for_user()
--           → INSERT INTO profiles   ← broken by Issue A
--               → on_profile_created → create_default_subscription()
--                   → INSERT INTO subscriptions   ← broken by Issue B
--
--   GoTrue sees the exception and returns:
--   POST /auth/v1/signup  →  500 "Database error saving new user"
--
-- FIXES IN THIS FILE:
--   0. Fix create_profile_for_user() — add SET search_path = public
--      and schema-qualify all table references.
--   1. Create subscriptions table with all required columns and
--      CHECK constraints that accept 'trial' / 'trialing'.
--   2. Add RLS policies on subscriptions.
--   3. Recreate create_default_subscription() with EXCEPTION
--      handling so a future subscription-creation failure shows
--      a clear WARNING instead of silently blocking all signups.
--   4. Re-apply 015 trigger (no_plan_escalation) on the new table.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- 0. Fix create_profile_for_user()
--
-- This is the trigger function the live DB calls on auth.users
-- INSERT. The original version lacked SET search_path = public
-- and used an unqualified table reference ('profiles' instead of
-- 'public.profiles'). Under SECURITY DEFINER, a missing
-- search_path lets a malicious schema shadow the target table,
-- and can also cause "relation not found" errors when the
-- function's effective search_path differs from the caller's.
--
-- Fix:
--   • SET search_path = public  — pins the schema resolution
--   • INSERT INTO public.profiles  — explicit schema qualification
--   • Trigger is re-pointed to this function (idempotent).
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, company, industry)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'firstName',
    NEW.raw_user_meta_data->>'lastName',
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'industry'
  );
  -- Sync default role into auth.users metadata so is_superadmin() stays consistent
  UPDATE auth.users
  SET raw_user_meta_data =
        COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "customer"}'::jsonb
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-point the auth.users trigger to the fixed function.
-- DROP + CREATE is safe and idempotent here.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_user();

-- ──────────────────────────────────────────────────────────────
-- 1. subscriptions table
--
-- Reconstructed from:
--   • 013_billing.sql  (ALTER TABLE adds billing columns)
--   • 040_foundation_fixes.sql  (create_default_subscription inserts)
--   • 019_invoices.sql  (generate_monthly_invoices reads)
--   • 022_atomic_balance_topup.sql  (atomic balance updates)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One subscription per user (ON CONFLICT (user_id) pattern in create_default_subscription)
  user_id                     uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan values used throughout the app + 'trial' for new signups
  plan                        text        NOT NULL DEFAULT 'trial'
                              CHECK (plan IN ('trial', 'starter', 'professional', 'business', 'solo', 'team', 'enterprise')),

  -- Status values: Stripe-compatible + 'trialing' for new signups
  status                      text        NOT NULL DEFAULT 'trialing'
                              CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'paused')),

  -- Minutes quota
  included_minutes            integer     NOT NULL DEFAULT 60,
  used_minutes                numeric     NOT NULL DEFAULT 0,
  overage_minutes             numeric     NOT NULL DEFAULT 0,

  -- Billing period (set on Stripe webhook; defaults to 30-day window for trials)
  current_period_start        timestamptz          DEFAULT now(),
  current_period_end          timestamptz          DEFAULT now() + interval '30 days',

  -- Stripe integration fields
  stripe_customer_id          text,
  stripe_subscription_id      text,
  stripe_price_id             text,

  -- Balance / billing (added by 013_billing.sql on the old project)
  balance_cents               integer     NOT NULL DEFAULT 0,
  plan_price_cents            integer     NOT NULL DEFAULT 0,
  auto_reload_enabled         boolean              DEFAULT false,
  auto_reload_threshold_cents integer              DEFAULT 500,
  auto_reload_amount_cents    integer              DEFAULT 5000,
  hard_cap_enabled            boolean              DEFAULT true,
  hard_cap_cents              integer              DEFAULT 30000,
  service_active              boolean              DEFAULT true,
  paused_reason               text,

  created_at                  timestamptz          DEFAULT now(),
  updated_at                  timestamptz          DEFAULT now()
);

-- ──────────────────────────────────────────────────────────────
-- 2. RLS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users_own_subscription" ON subscriptions
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "superadmin_subscriptions_all" ON subscriptions
    FOR ALL USING (is_superadmin());
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ──────────────────────────────────────────────────────────────
-- 3. updated_at trigger
-- ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TRIGGER set_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ──────────────────────────────────────────────────────────────
-- 4. Re-apply plan-escalation guard (from 015_prevent_role_escalation.sql)
--    Trigger may not exist on the new project yet.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_plan_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Plan change not permitted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS no_plan_escalation ON subscriptions;
CREATE TRIGGER no_plan_escalation
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION prevent_plan_self_escalation();

-- ──────────────────────────────────────────────────────────────
-- 5. Recreate create_default_subscription() with EXCEPTION guard
--
--    ON CONFLICT (user_id) DO NOTHING handles the idempotent case.
--    The EXCEPTION block catches any unexpected error (e.g., a
--    future constraint change) and logs a WARNING instead of
--    letting it propagate up through GoTrue as a signup 500.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan, status, balance_cents, included_minutes)
  VALUES (NEW.id, 'trial', 'trialing', 0, 60)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_default_subscription: could not create subscription for user %: %',
    NEW.id, SQLERRM;
  RETURN NEW;  -- still return NEW so profile creation is not rolled back
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the trigger exists (040 may have created it; DROP IF EXISTS + recreate is safe)
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

-- ──────────────────────────────────────────────────────────────
-- 6. Backfill: profiles that have no subscription row yet
-- ──────────────────────────────────────────────────────────────

INSERT INTO subscriptions (user_id, plan, status, balance_cents, included_minutes)
SELECT p.id, 'trial', 'trialing', 0, 60
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
