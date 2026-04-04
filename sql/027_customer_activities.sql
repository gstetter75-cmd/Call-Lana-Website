-- =============================================
-- Call Lana: Customer Activity Log (Unified Timeline)
-- =============================================

CREATE TABLE IF NOT EXISTS customer_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id),
  type text NOT NULL,
  title text NOT NULL,
  details text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_activities_all" ON customer_activities
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "sales_activities" ON customer_activities
  FOR ALL USING (
    customer_id IN (SELECT id FROM customers WHERE assigned_to = auth.uid())
    OR actor_id = auth.uid()
  );

CREATE INDEX IF NOT EXISTS idx_customer_activities_customer ON customer_activities(customer_id, created_at DESC);
