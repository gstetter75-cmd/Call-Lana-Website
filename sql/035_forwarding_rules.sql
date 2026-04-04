-- =============================================
-- Call Lana: Forwarding Rules Table + RLS
-- Spec §4.4 — Weiterleitungsregeln
-- =============================================

CREATE TABLE IF NOT EXISTS forwarding_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  target_name text,
  target_phone text NOT NULL,
  priority integer DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_forwarding_rules_user_id ON forwarding_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_forwarding_rules_priority ON forwarding_rules(priority);

-- RLS
ALTER TABLE forwarding_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own forwarding rules"
  ON forwarding_rules FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own forwarding rules"
  ON forwarding_rules FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own forwarding rules"
  ON forwarding_rules FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own forwarding rules"
  ON forwarding_rules FOR DELETE
  USING (user_id = auth.uid());
