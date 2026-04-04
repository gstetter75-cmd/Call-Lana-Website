-- =============================================
-- Call Lana: Call Protocols for CRM
-- =============================================

DO $$ BEGIN
  CREATE TYPE call_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE call_outcome AS ENUM ('reached', 'voicemail', 'no_answer', 'busy', 'callback', 'follow_up');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS call_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES profiles(id),
  direction call_direction NOT NULL DEFAULT 'outbound',
  outcome call_outcome NOT NULL DEFAULT 'reached',
  duration_seconds integer DEFAULT 0,
  subject text,
  notes text,
  follow_up_date timestamptz,
  follow_up_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  called_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmin_call_protocols_all" ON call_protocols
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "sales_manage_call_protocols" ON call_protocols
  FOR ALL USING (
    caller_id = auth.uid()
    OR customer_id IN (SELECT id FROM customers WHERE assigned_to = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_call_protocols_customer ON call_protocols(customer_id);
CREATE INDEX IF NOT EXISTS idx_call_protocols_caller ON call_protocols(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_protocols_called_at ON call_protocols(called_at DESC);
