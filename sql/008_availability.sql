-- =============================================
-- Call Lana: Availability / Absence Management
-- =============================================

DO $$ BEGIN
  CREATE TYPE availability_type AS ENUM ('available', 'busy', 'vacation', 'sick');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  date date NOT NULL,
  start_time time,
  end_time time,
  type availability_type DEFAULT 'available',
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_availability_all" ON availability
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "users_manage_own_availability" ON availability
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "org_members_read_availability" ON availability
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_availability_user ON availability(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_date ON availability(date);
CREATE INDEX IF NOT EXISTS idx_availability_org ON availability(organization_id);
