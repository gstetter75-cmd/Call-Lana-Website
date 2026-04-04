-- =============================================
-- Call Lana: Time Off / Vacation Management
-- =============================================

DO $$ BEGIN
  CREATE TYPE time_off_type AS ENUM ('vacation', 'sick', 'training', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE time_off_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type time_off_type NOT NULL DEFAULT 'vacation',
  status time_off_status NOT NULL DEFAULT 'pending',
  start_date date NOT NULL,
  end_date date NOT NULL,
  half_day_start boolean DEFAULT false,
  half_day_end boolean DEFAULT false,
  days_count numeric(4,1) NOT NULL DEFAULT 1,
  note text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS vacation_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year smallint NOT NULL,
  total_days numeric(4,1) NOT NULL DEFAULT 30,
  carried_over numeric(4,1) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, year)
);

ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_quotas ENABLE ROW LEVEL SECURITY;

-- Time off: own + org read + superadmin all
CREATE POLICY "own_time_off" ON time_off_requests
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "superadmin_time_off" ON time_off_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "org_read_time_off" ON time_off_requests
  FOR SELECT USING (
    user_id IN (
      SELECT om.user_id FROM organization_members om
      WHERE om.organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- Vacation quotas: own read + superadmin manage
CREATE POLICY "own_quota" ON vacation_quotas
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "superadmin_quota" ON vacation_quotas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE INDEX IF NOT EXISTS idx_time_off_user ON time_off_requests(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_time_off_status ON time_off_requests(status);

-- Function to calculate remaining vacation days
CREATE OR REPLACE FUNCTION get_remaining_vacation(p_user_id uuid, p_year smallint)
RETURNS numeric AS $$
DECLARE
  quota numeric;
  used numeric;
BEGIN
  SELECT COALESCE(total_days + carried_over, 30) INTO quota
  FROM vacation_quotas WHERE user_id = p_user_id AND year = p_year;

  IF quota IS NULL THEN quota := 30; END IF;

  SELECT COALESCE(SUM(days_count), 0) INTO used
  FROM time_off_requests
  WHERE user_id = p_user_id
    AND type = 'vacation'
    AND status = 'approved'
    AND EXTRACT(YEAR FROM start_date) = p_year;

  RETURN quota - used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
