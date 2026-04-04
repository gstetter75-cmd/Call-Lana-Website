-- =============================================
-- Call Lana: Webhook Configurations
-- =============================================

CREATE TABLE IF NOT EXISTS webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  url text NOT NULL,
  secret text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_webhooks" ON webhook_configs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE INDEX IF NOT EXISTS idx_webhooks_event ON webhook_configs(event_type, is_active);
