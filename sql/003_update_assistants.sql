-- =============================================
-- Call Lana: Update assistants table with org reference
-- Run AFTER 002_organizations.sql
-- =============================================

-- 1. Add organization_id to assistants
ALTER TABLE assistants ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

-- 2. Update index
CREATE INDEX IF NOT EXISTS idx_assistants_org ON assistants(organization_id);

-- 3. Drop old policies and recreate with org support
DROP POLICY IF EXISTS "Users can view own assistants" ON assistants;
DROP POLICY IF EXISTS "Users can insert own assistants" ON assistants;
DROP POLICY IF EXISTS "Users can update own assistants" ON assistants;
DROP POLICY IF EXISTS "Users can delete own assistants" ON assistants;

-- Superadmin: full access
CREATE POLICY "superadmin_assistants_all" ON assistants
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Users can manage assistants in their org
CREATE POLICY "org_members_read_assistants" ON assistants
  FOR SELECT USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users_insert_assistants" ON assistants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_assistants" ON assistants
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_delete_own_assistants" ON assistants
  FOR DELETE USING (user_id = auth.uid());
