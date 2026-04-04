-- =============================================
-- Call Lana: Add RLS to user_settings table
-- =============================================

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_settings_all" ON user_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "users_manage_own_settings" ON user_settings
  FOR ALL USING (user_id = auth.uid());
