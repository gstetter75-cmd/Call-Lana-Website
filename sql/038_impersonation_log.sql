-- =============================================
-- Call Lana: Admin Impersonation Audit Log
-- Tracks every impersonation session and action
-- =============================================

CREATE TABLE IF NOT EXISTS admin_impersonation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  target_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('start', 'stop', 'modify')),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON admin_impersonation_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_target ON admin_impersonation_log(target_user_id);

ALTER TABLE admin_impersonation_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "superadmin_impersonation_log" ON admin_impersonation_log
    FOR ALL USING (is_superadmin());
EXCEPTION WHEN duplicate_object THEN null; END $$;
