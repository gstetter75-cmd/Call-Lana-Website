-- =============================================
-- Call Lana: Organizations + Members Tables
-- Run this in Supabase SQL Editor AFTER 001_profiles.sql
-- =============================================

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  owner_id uuid REFERENCES profiles(id),
  plan text DEFAULT 'solo' CHECK (plan IN ('solo', 'team', 'business')),
  max_users integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create organization_members (join table for multi-user)
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_in_org text DEFAULT 'member' CHECK (role_in_org IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- 3. Add FK from profiles to organizations (deferred to avoid circular deps)
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ON DELETE SET NULL;

-- 4. Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- 5. RLS: Organizations
-- Superadmin: full access
CREATE POLICY "superadmin_orgs_all" ON organizations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Members can read their org
CREATE POLICY "members_read_own_org" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    OR owner_id = auth.uid()
  );

-- Owner can update own org
CREATE POLICY "owner_update_org" ON organizations
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 6. RLS: Organization Members
-- Superadmin: full access
CREATE POLICY "superadmin_members_all" ON organization_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Members can read members of their org
CREATE POLICY "members_read_org_members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Owner can manage members
CREATE POLICY "owner_manage_members" ON organization_members
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- 7. Triggers
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_orgs_owner ON organizations(owner_id);
