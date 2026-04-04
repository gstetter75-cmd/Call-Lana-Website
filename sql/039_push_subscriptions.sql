-- Push notification subscriptions for Web Push API
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "users_own_push_subs" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Superadmin can read all (for admin push features)
CREATE POLICY "superadmin_push_subs" ON push_subscriptions
  FOR ALL USING (is_superadmin());

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
