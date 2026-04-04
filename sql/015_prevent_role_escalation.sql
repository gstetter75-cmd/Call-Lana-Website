-- Prevent role/plan self-escalation
-- Protects subscriptions.plan from unauthorized changes
-- Only superadmins can modify plan fields

CREATE OR REPLACE FUNCTION prevent_plan_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan AND NOT is_superadmin() THEN
    RAISE EXCEPTION 'Plan change not permitted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER no_plan_escalation
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION prevent_plan_self_escalation();
