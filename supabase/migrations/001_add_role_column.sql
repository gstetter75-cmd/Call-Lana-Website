-- Migration: Add role column to profiles table
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Add role column with default 'customer'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

-- 2. Add constraint to ensure valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('customer', 'sales', 'superadmin'));
  END IF;
END $$;

-- 3. Add is_active column if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 4. Set initial roles for existing users (ADJUST EMAILS AS NEEDED)
-- UPDATE profiles SET role = 'superadmin' WHERE email = 'g.stetter@gmx.net';
-- UPDATE profiles SET role = 'sales' WHERE email = 'gstetter75@googlemail.com';
-- UPDATE profiles SET role = 'customer' WHERE email = 'info@gero-nikolov.com';

-- 5. RLS Policy: Users can read their own profile
CREATE POLICY IF NOT EXISTS "users_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- 6. RLS Policy: Superadmin can read all profiles
CREATE POLICY IF NOT EXISTS "superadmin_read_all_profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
  );

-- 7. RLS Policy: Sales can read customer profiles
CREATE POLICY IF NOT EXISTS "sales_read_customer_profiles" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('sales', 'superadmin')
  );

-- 8. RLS Policy: Users can update own profile (but not role)
CREATE POLICY IF NOT EXISTS "users_update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      role = (SELECT role FROM profiles WHERE id = auth.uid())
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'superadmin'
    )
  );

-- 9. RLS Policy: Users can insert their own profile
CREATE POLICY IF NOT EXISTS "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 10. Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
