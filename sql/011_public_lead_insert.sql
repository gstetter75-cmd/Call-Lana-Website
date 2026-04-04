-- =============================================
-- Call Lana: Allow anonymous lead creation from contact form
-- =============================================

-- Allow unauthenticated users to insert leads (from public contact form)
-- The anon key has limited permissions; only INSERT is allowed, no SELECT/UPDATE/DELETE
CREATE POLICY "public_insert_leads" ON leads
  FOR INSERT
  WITH CHECK (true);
