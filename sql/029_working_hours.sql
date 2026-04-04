-- =============================================
-- Call Lana: Working Hours + Templates
-- =============================================

CREATE TABLE IF NOT EXISTS working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_start time,
  break_end time,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, day_of_week)
);

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_working_hours" ON working_hours
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "superadmin_working_hours" ON working_hours
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "org_read_working_hours" ON working_hours
  FOR SELECT USING (
    user_id IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_working_hours_user ON working_hours(user_id, day_of_week);
