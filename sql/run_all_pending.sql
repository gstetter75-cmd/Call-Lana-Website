-- =============================================================================
-- Call Lana: Combined Pending Migrations (023 through 033)
-- =============================================================================
-- This script combines all pending SQL migrations into a single executable file.
-- It is designed to be IDEMPOTENT — safe to run multiple times.
--
-- Safety guards used:
--   - IF NOT EXISTS for CREATE TABLE, CREATE INDEX
--   - IF EXISTS for DROP operations
--   - DO $$ BEGIN ... EXCEPTION WHEN ... END $$ for CREATE TYPE, CREATE POLICY,
--     CREATE TRIGGER, and ADD COLUMN operations that lack IF NOT EXISTS support
--   - ON CONFLICT DO NOTHING for INSERT seeds
--
-- Migrations included:
--   023_leads_industry.sql
--   024_customers.sql
--   025_call_protocols.sql
--   026_customer_tags.sql
--   027_customer_activities.sql
--   028_lead_scoring.sql
--   029_working_hours.sql
--   030_time_off.sql
--   031_webhooks_config.sql
--   032_audit_and_goals.sql
--   033_secure_payment_data.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 023_leads_industry.sql — Add industry column to leads table
-- =============================================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry text;


-- =============================================================================
-- 024_customers.sql — Customers Table + Extensions
-- =============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  industry text,
  plan text DEFAULT 'starter',
  status text DEFAULT 'active',
  website text,
  address text,
  notes text,
  health_score integer DEFAULT 50,
  last_contact_at timestamptz,
  customer_since timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Superadmin: full access
DO $$ BEGIN
  CREATE POLICY "superadmin_customers_all" ON customers
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Sales: manage own customers or org customers
DO $$ BEGIN
  CREATE POLICY "sales_manage_customers" ON customers
    FOR ALL USING (
      assigned_to = auth.uid()
      OR organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_customers_assigned ON customers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_lead ON customers(lead_id);

-- Extend tasks and notes to support customer linking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_customer ON tasks(customer_id);

ALTER TABLE notes ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notes_customer ON notes(customer_id);


-- =============================================================================
-- 025_call_protocols.sql — Call Protocols for CRM
-- =============================================================================

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

DO $$ BEGIN
  CREATE POLICY "superadmin_call_protocols_all" ON call_protocols
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_manage_call_protocols" ON call_protocols
    FOR ALL USING (
      caller_id = auth.uid()
      OR customer_id IN (SELECT id FROM customers WHERE assigned_to = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_call_protocols_customer ON call_protocols(customer_id);
CREATE INDEX IF NOT EXISTS idx_call_protocols_caller ON call_protocols(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_protocols_called_at ON call_protocols(called_at DESC);


-- =============================================================================
-- 026_customer_tags.sql — Customer Tags for Segmentation
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text DEFAULT '#7c3aed',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_tag_assignments (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, tag_id)
);

ALTER TABLE customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Tags: readable by sales+superadmin, writable by superadmin
DO $$ BEGIN
  CREATE POLICY "read_tags" ON customer_tags FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'superadmin'))
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "manage_tags" ON customer_tags FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tag assignments: manageable by sales+superadmin
DO $$ BEGIN
  CREATE POLICY "manage_tag_assignments" ON customer_tag_assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'superadmin'))
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- =============================================================================
-- 027_customer_activities.sql — Customer Activity Log (Unified Timeline)
-- =============================================================================

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

DO $$ BEGIN
  CREATE POLICY "superadmin_activities_all" ON customer_activities
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "sales_activities" ON customer_activities
    FOR ALL USING (
      customer_id IN (SELECT id FROM customers WHERE assigned_to = auth.uid())
      OR actor_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_customer_activities_customer ON customer_activities(customer_id, created_at DESC);


-- =============================================================================
-- 028_lead_scoring.sql — Lead Scoring + Email Templates + Onboarding
-- =============================================================================

-- Lead scoring columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_factors jsonb DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category text DEFAULT 'general',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "read_email_templates" ON email_templates
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'superadmin'))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "manage_email_templates" ON email_templates
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'superadmin'))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Seed default templates
INSERT INTO email_templates (name, subject, body, category) VALUES
  ('Follow-up nach Demo', 'Ihr Call Lana Demo-Gespräch – nächste Schritte', 'Hallo {{kontakt}},

vielen Dank für das angenehme Gespräch zur Vorstellung von Call Lana für {{firma}}.

Wie besprochen fasse ich hier die wichtigsten Punkte zusammen:
- [Punkt 1]
- [Punkt 2]

Gerne können wir einen Folgetermin vereinbaren. Wann passt es Ihnen?

Beste Grüße', 'follow_up'),
  ('Angebot senden', 'Ihr individuelles Angebot von Call Lana', 'Hallo {{kontakt}},

wie besprochen sende ich Ihnen hiermit unser Angebot für {{firma}}.

Plan: {{plan}}
Monatlicher Preis: {{preis}} € netto

Bei Fragen stehe ich Ihnen gerne zur Verfügung.

Beste Grüße', 'proposal'),
  ('Willkommen als Kunde', 'Willkommen bei Call Lana, {{firma}}!', 'Hallo {{kontakt}},

herzlich willkommen bei Call Lana! Wir freuen uns, {{firma}} als neuen Kunden begrüßen zu dürfen.

Ihre nächsten Schritte:
1. Loggen Sie sich in Ihr Dashboard ein
2. Erstellen Sie Ihren ersten KI-Assistenten
3. Weisen Sie eine Telefonnummer zu

Bei Fragen sind wir jederzeit für Sie da.

Beste Grüße', 'welcome'),
  ('Nachfassen – kein Kontakt', 'Kurze Rückfrage zu Call Lana', 'Hallo {{kontakt}},

ich wollte kurz nachfragen, ob Sie noch Interesse an Call Lana für {{firma}} haben.

Gerne zeige ich Ihnen in einem kurzen Gespräch (15 Min.), wie andere Unternehmen aus der Branche {{branche}} Call Lana erfolgreich einsetzen.

Wann hätten Sie Zeit?

Beste Grüße', 'follow_up')
ON CONFLICT DO NOTHING;

-- Onboarding Progress
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE (user_id, step_key)
);

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own_onboarding" ON onboarding_progress
    FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- =============================================================================
-- 029_working_hours.sql — Working Hours + Templates
-- =============================================================================

CREATE TABLE IF NOT EXISTS working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_start time,
  break_end time,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, day_of_week)
);

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own_working_hours" ON working_hours
    FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "superadmin_working_hours" ON working_hours
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "org_read_working_hours" ON working_hours
    FOR SELECT USING (
      user_id IN (
        SELECT om.user_id FROM organization_members om
        WHERE om.organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_working_hours_user ON working_hours(user_id, day_of_week);


-- =============================================================================
-- 030_time_off.sql — Time Off / Vacation Management
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE time_off_type AS ENUM ('vacation', 'sick', 'training', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE time_off_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS time_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type time_off_type NOT NULL DEFAULT 'vacation',
  status time_off_status NOT NULL DEFAULT 'pending',
  start_date date NOT NULL,
  end_date date NOT NULL,
  half_day_start boolean DEFAULT false,
  half_day_end boolean DEFAULT false,
  days_count numeric(4,1) NOT NULL DEFAULT 1,
  note text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS vacation_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year smallint NOT NULL,
  total_days numeric(4,1) NOT NULL DEFAULT 30,
  carried_over numeric(4,1) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, year)
);

ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_quotas ENABLE ROW LEVEL SECURITY;

-- Time off: own + org read + superadmin all
DO $$ BEGIN
  CREATE POLICY "own_time_off" ON time_off_requests
    FOR ALL USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "superadmin_time_off" ON time_off_requests
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "org_read_time_off" ON time_off_requests
    FOR SELECT USING (
      user_id IN (
        SELECT om.user_id FROM organization_members om
        WHERE om.organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Vacation quotas: own read + superadmin manage
DO $$ BEGIN
  CREATE POLICY "own_quota" ON vacation_quotas
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "superadmin_quota" ON vacation_quotas
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_time_off_user ON time_off_requests(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_time_off_status ON time_off_requests(status);

-- Function to calculate remaining vacation days
CREATE OR REPLACE FUNCTION get_remaining_vacation(p_user_id uuid, p_year smallint)
RETURNS numeric AS $$
DECLARE
  quota numeric;
  used numeric;
BEGIN
  SELECT COALESCE(total_days + carried_over, 30) INTO quota
  FROM vacation_quotas WHERE user_id = p_user_id AND year = p_year;

  IF quota IS NULL THEN quota := 30; END IF;

  SELECT COALESCE(SUM(days_count), 0) INTO used
  FROM time_off_requests
  WHERE user_id = p_user_id
    AND type = 'vacation'
    AND status = 'approved'
    AND EXTRACT(YEAR FROM start_date) = p_year;

  RETURN quota - used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- 031_webhooks_config.sql — Webhook Configurations
-- =============================================================================

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

DO $$ BEGIN
  CREATE POLICY "superadmin_webhooks" ON webhook_configs
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_webhooks_event ON webhook_configs(event_type, is_active);


-- =============================================================================
-- 032_audit_and_goals.sql — Audit Log, KPI Goals, Announcements
-- =============================================================================

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  target_type text,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "superadmin_audit" ON audit_logs
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- KPI Goals
CREATE TABLE IF NOT EXISTS kpi_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL,
  target_value numeric NOT NULL,
  current_value numeric DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (metric, period_start)
);

ALTER TABLE kpi_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "superadmin_goals" ON kpi_goals
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "read_goals" ON kpi_goals
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('sales', 'superadmin'))
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  target_role text,
  created_by uuid REFERENCES profiles(id),
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "superadmin_announcements" ON announcements
    FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "read_active_announcements" ON announcements
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- =============================================================================
-- 033_secure_payment_data.sql — Secure Payment Data
-- =============================================================================

-- 1. payment_methods: Remove plaintext sensitive data, switch to Stripe-based tokenization
ALTER TABLE payment_methods
  DROP COLUMN IF EXISTS iban,
  DROP COLUMN IF EXISTS bic,
  DROP COLUMN IF EXISTS card_expiry,
  DROP COLUMN IF EXISTS paypal_email;

ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS iban_last4 text;

CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_customer
  ON payment_methods(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

COMMENT ON TABLE payment_methods IS
  'Payment methods use Stripe tokenization. No raw IBAN, card numbers, or PayPal credentials are stored. Only masked display data (last4, brand) and Stripe references.';

COMMENT ON COLUMN payment_methods.stripe_customer_id IS 'Stripe Customer ID (cus_xxx)';
COMMENT ON COLUMN payment_methods.stripe_payment_method_id IS 'Stripe PaymentMethod ID (pm_xxx)';
COMMENT ON COLUMN payment_methods.iban_last4 IS 'Last 4 digits of IBAN for display only';
COMMENT ON COLUMN payment_methods.card_last4 IS 'Last 4 digits of card for display only';
COMMENT ON COLUMN payment_methods.card_brand IS 'Card brand (visa, mastercard, etc.) for display only';
COMMENT ON COLUMN payment_methods.account_holder IS 'Account holder name for SEPA display';

-- 2. integrations: Encrypt OAuth tokens
ALTER TABLE integrations
  ADD COLUMN IF NOT EXISTS access_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS encryption_key_id text;

COMMENT ON COLUMN integrations.access_token IS
  'DEPRECATED: Use access_token_encrypted. Will be dropped in future migration.';
COMMENT ON COLUMN integrations.refresh_token IS
  'DEPRECATED: Use refresh_token_encrypted. Will be dropped in future migration.';
COMMENT ON COLUMN integrations.access_token_encrypted IS
  'AES-256-GCM encrypted OAuth access token. Decryption key referenced by encryption_key_id.';
COMMENT ON COLUMN integrations.refresh_token_encrypted IS
  'AES-256-GCM encrypted OAuth refresh token. Decryption key referenced by encryption_key_id.';

-- 3. invoice_settings: Remove hardcoded company IBAN
UPDATE invoice_settings
SET
  iban = NULL,
  bic = NULL
WHERE iban = 'DE94100110012577455738';

COMMENT ON COLUMN invoice_settings.iban IS
  'Company IBAN for invoice footer. Set via admin UI or environment, never hardcoded in SQL.';

-- 4. Tighten RLS on payment_methods
DROP POLICY IF EXISTS "superadmin_payment_methods" ON payment_methods;

DO $$ BEGIN
  CREATE POLICY "superadmin_payment_methods_read" ON payment_methods
    FOR SELECT
    USING (is_superadmin());
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- =============================================================================
-- Done. All migrations 023-033 applied.
-- =============================================================================

COMMIT;
