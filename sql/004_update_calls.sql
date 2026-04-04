-- =============================================
-- Call Lana: Update calls table with RLS
-- =============================================

-- 1. Add organization_id and assistant_id to calls (if not exist)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS assistant_id uuid REFERENCES assistants(id) ON DELETE SET NULL;

-- 2. Enable RLS (may already be enabled)
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "superadmin_calls_all" ON calls
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "users_read_own_calls" ON calls
  FOR SELECT USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "users_insert_own_calls" ON calls
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_calls_org ON calls(organization_id);
CREATE INDEX IF NOT EXISTS idx_calls_assistant ON calls(assistant_id);
