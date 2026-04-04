-- =============================================
-- Call Lana: Dashboard Views (Spec §8)
-- Ahmed: Supabase Views for Dashboard
-- =============================================

-- View: Daily Metrics (for Metric Cards)
CREATE OR REPLACE VIEW daily_metrics AS
SELECT
  user_id AS customer_id,
  DATE(created_at) AS date,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE outcome = 'termin') AS booked,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'termin')::numeric /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS booking_rate,
  ROUND(SUM(duration_seconds) / 60.0, 1) AS total_minutes,
  ROUND(AVG(sentiment_score), 1) AS avg_score
FROM calls
GROUP BY user_id, DATE(created_at);

-- View: Hourly Call Distribution (for Analytics)
CREATE OR REPLACE VIEW hourly_calls AS
SELECT
  user_id AS customer_id,
  EXTRACT(HOUR FROM created_at)::integer AS hour,
  COUNT(*) AS calls
FROM calls
GROUP BY user_id, EXTRACT(HOUR FROM created_at)
ORDER BY calls DESC;

-- View: Weekly Booking Rate (for Trend Charts)
CREATE OR REPLACE VIEW weekly_booking_rate AS
SELECT
  user_id AS customer_id,
  DATE_TRUNC('week', created_at)::date AS week_start,
  EXTRACT(WEEK FROM created_at)::integer AS week_num,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE outcome = 'termin') AS booked,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'termin')::numeric /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS booking_rate
FROM calls
GROUP BY user_id, DATE_TRUNC('week', created_at), EXTRACT(WEEK FROM created_at);

-- View: Outcome Distribution (for Pie Chart)
CREATE OR REPLACE VIEW outcome_distribution AS
SELECT
  user_id AS customer_id,
  COALESCE(outcome, 'sonstige') AS outcome,
  COUNT(*) AS count
FROM calls
GROUP BY user_id, COALESCE(outcome, 'sonstige');

-- View: Customer Minutes Usage (for Minutes Alert)
-- plan comes from subscriptions (profiles has no plan column).
-- minutes_limit uses subscriptions.included_minutes (authoritative).
-- duration_seconds is the correct column name on the calls table.
CREATE OR REPLACE VIEW customer_minutes_usage AS
SELECT
  p.id AS customer_id,
  p.email,
  p.first_name,
  p.last_name,
  s.plan,
  COALESCE(
    (SELECT ROUND(SUM(c.duration_seconds) / 60.0, 1)
     FROM calls c
     WHERE c.user_id = p.id
       AND DATE_TRUNC('month', c.created_at) = DATE_TRUNC('month', now())),
    0
  ) AS minutes_used,
  COALESCE(s.included_minutes, 60) AS minutes_limit
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id
WHERE p.role = 'customer';
