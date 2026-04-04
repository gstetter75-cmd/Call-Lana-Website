-- Billing extensions: adds balance, auto-reload and hard cap to existing subscriptions table
-- The subscriptions table already has: plan, included_minutes, used_minutes, current_period_start/end, stripe fields

-- Add billing fields to existing subscriptions table
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS balance_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overage_minutes numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_reload_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_reload_threshold_cents integer DEFAULT 500,
  ADD COLUMN IF NOT EXISTS auto_reload_amount_cents integer DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS hard_cap_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS hard_cap_cents integer DEFAULT 30000,
  ADD COLUMN IF NOT EXISTS service_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS paused_reason text;

-- Transaction log for all billing events
CREATE TABLE IF NOT EXISTS billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('plan_charge', 'topup', 'auto_reload', 'usage_charge', 'refund', 'credit')),
  amount_cents integer NOT NULL,
  balance_after_cents integer,
  description text,
  metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'refunded')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on billing_transactions
ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_billing_transactions" ON billing_transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "superadmin_billing_transactions" ON billing_transactions
  FOR ALL USING (is_superadmin());
