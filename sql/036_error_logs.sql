-- =============================================
-- Call Lana: Error Logs Table (Admin only)
-- Spec §7 — Fehler-Log / n8n Error Monitoring
-- =============================================

CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL DEFAULT 'unknown',
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('error', 'warning', 'info')),
  message text NOT NULL,
  stack_trace text,
  metadata jsonb DEFAULT '{}',
  resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_service ON error_logs(service);

-- RLS: Only superadmins can access
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view error logs"
  ON error_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );

CREATE POLICY "Superadmins can insert error logs"
  ON error_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Superadmins can update error logs"
  ON error_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'superadmin'
    )
  );
