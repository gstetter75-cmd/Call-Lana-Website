-- =============================================================================
-- Call Lana: Dashboard Migrations (034 through 037)
-- =============================================================================
-- New tables and views for the dashboard spec implementation.
-- IDEMPOTENT — safe to run multiple times.
--
-- Migrations included:
--   034_appointments.sql
--   035_forwarding_rules.sql
--   036_error_logs.sql
--   037_dashboard_views.sql
-- =============================================================================

BEGIN;

\i 034_appointments.sql
\i 035_forwarding_rules.sql
\i 036_error_logs.sql
\i 037_dashboard_views.sql

-- Add onboarding_status to profiles if not present
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_status text DEFAULT 'live';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS monthly_minutes_limit integer;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS minutes_used integer DEFAULT 0;

-- Add outcome and sentiment_score to calls if not present
ALTER TABLE calls ADD COLUMN IF NOT EXISTS outcome text;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment_score numeric;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS caller_name text;

CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls(outcome);
CREATE INDEX IF NOT EXISTS idx_calls_sentiment ON calls(sentiment_score);

-- Enable realtime for calls table
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE calls;
EXCEPTION WHEN duplicate_object THEN null; END $$;

COMMIT;
