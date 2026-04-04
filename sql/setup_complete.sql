-- =============================================================================
-- Call Lana: COMPLETE DATABASE SETUP
-- Safe to run multiple times (idempotent)
-- Copy this entire script into Supabase SQL Editor and click "Run"
-- =============================================================================

-- =============================================
-- 1. APPOINTMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id),
  customer_name text,
  name text,
  phone text,
  appointment_date timestamptz NOT NULL,
  duration_minutes integer DEFAULT 30,
  note text,
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'pending')),
  source text DEFAULT 'lana' CHECK (source IN ('lana', 'manual', 'calendar')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "users_own_appointments_select" ON appointments FOR SELECT USING (user_id = auth.uid() OR is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "users_own_appointments_insert" ON appointments FOR INSERT WITH CHECK (user_id = auth.uid() OR is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "users_own_appointments_update" ON appointments FOR UPDATE USING (user_id = auth.uid() OR is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "users_own_appointments_delete" ON appointments FOR DELETE USING (user_id = auth.uid() OR is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- 2. FORWARDING RULES
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
CREATE INDEX IF NOT EXISTS idx_forwarding_rules_user_id ON forwarding_rules(user_id);
ALTER TABLE forwarding_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "users_own_forwarding_select" ON forwarding_rules FOR SELECT USING (user_id = auth.uid() OR is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "users_own_forwarding_insert" ON forwarding_rules FOR INSERT WITH CHECK (user_id = auth.uid() OR is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "users_own_forwarding_update" ON forwarding_rules FOR UPDATE USING (user_id = auth.uid() OR is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "users_own_forwarding_delete" ON forwarding_rules FOR DELETE USING (user_id = auth.uid() OR is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- 3. ERROR LOGS (Admin only)
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
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "superadmin_error_logs" ON error_logs FOR ALL USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE POLICY "service_insert_error_logs" ON error_logs FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- 4. ADMIN IMPERSONATION LOG
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
DO $$ BEGIN CREATE POLICY "superadmin_impersonation_log" ON admin_impersonation_log FOR ALL USING (is_superadmin()); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- 5. EXTEND EXISTING TABLES
-- =============================================

-- Profiles: onboarding + minutes tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'live';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_minutes_limit integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS minutes_used integer DEFAULT 0;

-- Calls: outcome, sentiment, caller name
ALTER TABLE calls ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment_score numeric;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name text;
CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls(outcome);
CREATE INDEX IF NOT EXISTS idx_calls_sentiment ON calls(sentiment_score);

-- =============================================
-- 6. DASHBOARD VIEWS
-- =============================================

CREATE OR REPLACE VIEW daily_metrics AS
SELECT
  user_id AS customer_id,
  DATE(created_at) AS date,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE outcome = 'termin') AS booked,
  ROUND(COUNT(*) FILTER (WHERE outcome = 'termin')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS booking_rate,
  ROUND(SUM(duration) / 60.0, 1) AS total_minutes,
  ROUND(AVG(sentiment_score), 1) AS avg_score
FROM calls
GROUP BY user_id, DATE(created_at);

CREATE OR REPLACE VIEW hourly_calls AS
SELECT
  user_id AS customer_id,
  EXTRACT(HOUR FROM created_at)::integer AS hour,
  COUNT(*) AS calls
FROM calls
GROUP BY user_id, EXTRACT(HOUR FROM created_at)
ORDER BY calls DESC;

CREATE OR REPLACE VIEW weekly_booking_rate AS
SELECT
  user_id AS customer_id,
  DATE_TRUNC('week', created_at)::date AS week_start,
  EXTRACT(WEEK FROM created_at)::integer AS week_num,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE outcome = 'termin') AS booked,
  ROUND(COUNT(*) FILTER (WHERE outcome = 'termin')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS booking_rate
FROM calls
GROUP BY user_id, DATE_TRUNC('week', created_at), EXTRACT(WEEK FROM created_at);

CREATE OR REPLACE VIEW outcome_distribution AS
SELECT
  user_id AS customer_id,
  COALESCE(outcome, 'sonstige') AS outcome,
  COUNT(*) AS count
FROM calls
GROUP BY user_id, COALESCE(outcome, 'sonstige');

-- =============================================
-- 7. ENABLE REALTIME
-- =============================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE calls; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE appointments; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- =============================================
-- DONE! All new tables, views, and extensions created.
-- =============================================
