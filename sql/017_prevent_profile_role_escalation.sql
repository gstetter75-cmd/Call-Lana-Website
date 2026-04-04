-- =============================================================================
-- Migration 017: Prevent profile role self-escalation
-- =============================================================================
-- SECURITY FIX: Migration 015 only protected subscriptions.plan.
-- Any authenticated user could previously update profiles.role from 'customer'
-- to 'superadmin' directly via the Supabase client, bypassing RLS because the
-- policy "users_update_own_profile" allows updates where id = auth.uid() with
-- no column-level restriction.
--
-- This migration adds two triggers:
--   1. prevent_role_self_escalation  — blocks unauthorized changes to
--      profiles.role and profiles.is_active (BEFORE UPDATE, blocks the write)
--   2. sync_profile_role_to_metadata — keeps auth.users.raw_user_meta_data
--      in sync after a superadmin changes profiles.role, so is_superadmin()
--      stays consistent (AFTER UPDATE, only fires on actual role change)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Trigger function: prevent unauthorized changes to profiles.role / is_active
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER is required so the function can call is_superadmin(), which
-- itself reads auth.users. The invoker (an anon/authenticated role) does not
-- have direct SELECT rights on auth.users.
--
-- The trigger fires BEFORE UPDATE so it can abort the statement entirely
-- (RETURN NULL is not used; RAISE EXCEPTION stops execution cleanly).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Block any attempt to change profiles.role by a non-superadmin.
  -- OLD.role IS DISTINCT FROM NEW.role is NULL-safe and correctly detects
  -- changes even if one side is NULL.
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT is_superadmin() THEN
    RAISE EXCEPTION
      'Insufficient privileges: only superadmins can change a profile role';
  END IF;

  -- Block any attempt to change profiles.is_active by a non-superadmin.
  -- Allowing a regular user to deactivate (or reactivate) any account via a
  -- direct UPDATE would be a privilege-escalation / denial-of-service vector.
  IF OLD.is_active IS DISTINCT FROM NEW.is_active AND NOT is_superadmin() THEN
    RAISE EXCEPTION
      'Insufficient privileges: only superadmins can change profile active status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Drop any previously installed version of this trigger before (re-)creating.
DROP TRIGGER IF EXISTS no_role_escalation ON profiles;

CREATE TRIGGER no_role_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_escalation();


-- -----------------------------------------------------------------------------
-- 2. Trigger function: sync profiles.role → auth.users.raw_user_meta_data
-- -----------------------------------------------------------------------------
-- is_superadmin() reads raw_user_meta_data->>'role', not profiles.role.
-- If a superadmin updates profiles.role without a corresponding metadata update
-- the two sources of truth diverge:
--   • The profile row shows the new role.
--   • is_superadmin() (and any JWT claim derived from metadata) still shows
--     the old role.
--
-- This AFTER UPDATE trigger keeps them in sync. It only executes when role
-- actually changed, and only when the caller is a superadmin (the BEFORE
-- trigger above already ensures non-superadmins cannot change the role).
--
-- SECURITY DEFINER is required because raw_user_meta_data lives in auth.users,
-- which the authenticated role cannot write to directly.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_profile_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Guard: only proceed when the role column actually changed.
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- The BEFORE trigger guarantees we only reach this point if the caller is a
  -- superadmin. The explicit check below is a defense-in-depth safeguard.
  IF NOT is_superadmin() THEN
    -- This branch should be unreachable in practice, but we log and skip the
    -- sync rather than raising an exception (the row update already succeeded
    -- at this point in an AFTER trigger; raising here would roll back the
    -- entire transaction, which is the safer choice).
    RAISE EXCEPTION
      'Unexpected: sync_profile_role_to_metadata reached by non-superadmin';
  END IF;

  -- Merge the updated role value into the existing metadata JSON so that any
  -- other metadata keys (e.g. firstName, lastName) are preserved.
  UPDATE auth.users
  SET raw_user_meta_data =
        COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Drop any previously installed version of this trigger before (re-)creating.
DROP TRIGGER IF EXISTS sync_role_to_auth_metadata ON profiles;

-- AFTER UPDATE so it only runs once the row change has been validated and
-- committed to the table (the BEFORE trigger ran first and approved it).
CREATE TRIGGER sync_role_to_auth_metadata
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_role_to_metadata();


-- -----------------------------------------------------------------------------
-- 3. Verification queries (run manually to confirm setup)
-- -----------------------------------------------------------------------------
-- SELECT tgname, tgtype, tgenabled
-- FROM   pg_trigger
-- WHERE  tgrelid = 'profiles'::regclass
-- ORDER  BY tgname;
--
-- Expected output:
--   no_role_escalation       | BEFORE UPDATE | enabled
--   sync_role_to_auth_metadata | AFTER UPDATE  | enabled
-- -----------------------------------------------------------------------------
