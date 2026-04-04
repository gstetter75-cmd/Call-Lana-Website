-- =============================================
-- Call Lana: Invoicing Schema
-- Creates invoice_settings, invoices, invoice_items tables,
-- invoice number generation, monthly invoice automation,
-- RLS policies, and indexes.
-- Prerequisites: 001_profiles.sql, 002_organizations.sql,
--               013_billing.sql, 018_billing_address.sql
-- =============================================


-- =============================================
-- 1. invoice_settings (singleton — one row for Call Lana GmbH)
-- =============================================

CREATE TABLE IF NOT EXISTS invoice_settings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name         text        NOT NULL DEFAULT 'Call Lana GmbH',
  street               text        DEFAULT 'Wetzellplatz 2',
  zip                  text        DEFAULT '31137',
  city                 text        DEFAULT 'Hildesheim',
  country              text        DEFAULT 'Deutschland',
  -- Steuernummer: to be added once known
  tax_number           text,
  -- USt-IdNr: to be added once issued
  vat_id               text,
  registry_court       text        DEFAULT 'Amtsgericht Hildesheim',
  -- HRB number: to be added after registration
  registry_number      text,
  managing_directors   text        DEFAULT 'Gero Stetter',
  email                text        DEFAULT 'info@call-lana.de',
  phone                text,
  bank_name            text,
  -- IBAN/BIC must be set via admin UI or environment variable, never hardcoded in SQL
  iban                 text,
  bic                  text,
  logo_url             text,
  payment_terms_days   integer     DEFAULT 14,
  default_notes        text        DEFAULT 'Vielen Dank für Ihr Vertrauen.',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Singleton guard: only one settings row allowed
CREATE UNIQUE INDEX IF NOT EXISTS invoice_settings_singleton
  ON invoice_settings ((true));

-- Seed the default row if not present
INSERT INTO invoice_settings DEFAULT VALUES
ON CONFLICT DO NOTHING;

-- Auto-update updated_at on invoice_settings
CREATE TRIGGER set_invoice_settings_updated_at
  BEFORE UPDATE ON invoice_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================
-- 2. invoices
-- =============================================

CREATE TABLE IF NOT EXISTS invoices (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner: every invoice belongs to one user (and optionally an org)
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  organization_id      uuid        REFERENCES organizations(id) ON DELETE SET NULL,

  invoice_number       text        UNIQUE NOT NULL,
  status               text        NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft', 'issued', 'paid', 'cancelled', 'credited')),

  invoice_date         date        NOT NULL DEFAULT CURRENT_DATE,
  due_date             date        NOT NULL,

  -- Billing period this invoice covers
  period_start         date        NOT NULL,
  period_end           date        NOT NULL,

  -- All monetary amounts stored as integer cents (avoids floating-point rounding)
  net_amount_cents     integer     NOT NULL,
  tax_rate             numeric     NOT NULL DEFAULT 19.00,
  tax_amount_cents     integer     NOT NULL,
  gross_amount_cents   integer     NOT NULL,
  currency             text        NOT NULL DEFAULT 'EUR',

  -- Recipient snapshot (copied at invoice creation; survives address changes)
  recipient_name       text        NOT NULL,
  recipient_street     text,
  recipient_zip        text,
  recipient_city       text,
  recipient_country    text        DEFAULT 'Deutschland',
  recipient_vat_id     text,
  recipient_email      text,

  notes                text,

  -- Credit note reference: points to the original invoice being credited
  credit_note_for      uuid        REFERENCES invoices(id) ON DELETE SET NULL,

  pdf_storage_path     text,
  email_sent           boolean     DEFAULT false,
  email_sent_at        timestamptz,

  metadata             jsonb       DEFAULT '{}',

  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),

  -- Prevent duplicate invoices for the same billing period
  CONSTRAINT uq_invoices_user_period UNIQUE (user_id, period_start, period_end)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_invoices_user_id       ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number        ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status        ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date  ON invoices(invoice_date);
-- Index the FK for credit notes to avoid sequential scans on join
CREATE INDEX IF NOT EXISTS idx_invoices_credit_note   ON invoices(credit_note_for)
  WHERE credit_note_for IS NOT NULL;
-- Partial index: only pending/unpaid invoices matter for collection queries
CREATE INDEX IF NOT EXISTS idx_invoices_open          ON invoices(due_date)
  WHERE status IN ('issued');

-- Auto-update updated_at
CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =============================================
-- 3. invoice_items
-- =============================================

CREATE TABLE IF NOT EXISTS invoice_items (
  id                  uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid     NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Line item order (1-based)
  position            integer  NOT NULL,
  description         text     NOT NULL,

  quantity            numeric  NOT NULL DEFAULT 1,
  unit                text     DEFAULT 'Stk.',

  unit_price_cents    integer  NOT NULL,
  net_amount_cents    integer  NOT NULL,
  tax_rate            numeric  NOT NULL DEFAULT 19.00,
  tax_amount_cents    integer  NOT NULL,
  gross_amount_cents  integer  NOT NULL,

  CONSTRAINT uq_invoice_items_position UNIQUE (invoice_id, position)
);

-- Index the FK so ON DELETE CASCADE and joins are fast
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);


-- =============================================
-- 4. Invoice number sequence and generation
-- =============================================

-- Global sequence; never resets. Format: CL-YYYY-NNNN
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year  text;
  v_seq   text;
BEGIN
  v_year := to_char(CURRENT_DATE, 'YYYY');
  v_seq  := lpad(nextval('invoice_number_seq')::text, 4, '0');
  RETURN 'CL-' || v_year || '-' || v_seq;
END;
$$;

-- BEFORE INSERT trigger: assigns invoice_number when the caller leaves it NULL
CREATE OR REPLACE FUNCTION assign_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_invoices_assign_number
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION assign_invoice_number();


-- =============================================
-- 5. generate_monthly_invoices()
--    Creates invoices for the previous calendar month.
--    Safe to call multiple times (idempotent via UNIQUE constraint).
-- =============================================

CREATE OR REPLACE FUNCTION generate_monthly_invoices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Previous month boundaries
  v_period_start  date := date_trunc('month', CURRENT_DATE - interval '1 month')::date;
  v_period_end    date := (date_trunc('month', CURRENT_DATE) - interval '1 day')::date;

  -- Overage rate constant: 0,15 € per minute (15 cents)
  v_overage_rate_cents  constant integer := 15;

  -- Cursor over active subscriptions
  rec             RECORD;

  -- Computed amounts
  v_base_net_cents      integer;
  v_overage_minutes     integer;
  v_overage_net_cents   integer;
  v_net_cents           integer;
  v_tax_cents           integer;
  v_gross_cents         integer;
  v_tax_rate            numeric := 19.00;

  -- Recipient data
  v_recipient_name      text;
  v_recipient_street    text;
  v_recipient_zip       text;
  v_recipient_city      text;
  v_recipient_country   text;
  v_recipient_vat_id    text;
  v_recipient_email     text;

  -- New invoice id
  v_invoice_id          uuid;
  v_position            integer;
BEGIN
  -- Iterate over every active subscription that has not yet been invoiced
  -- for the previous month (the UNIQUE constraint enforces idempotency).
  FOR rec IN
    SELECT
      s.user_id,
      s.plan_price_cents,
      s.included_minutes,
      s.used_minutes,
      s.overage_minutes,
      p.organization_id,
      p.first_name,
      p.last_name,
      p.company,
      p.email      AS profile_email,
      p.street     AS profile_street,
      p.zip        AS profile_zip,
      p.city       AS profile_city,
      p.country    AS profile_country,
      p.vat_id     AS profile_vat_id,
      o.name       AS org_name,
      o.street     AS org_street,
      o.zip        AS org_zip,
      o.city       AS org_city,
      o.country    AS org_country,
      o.vat_id     AS org_vat_id
    FROM subscriptions s
    JOIN profiles p ON p.id = s.user_id
    LEFT JOIN organizations o ON o.id = p.organization_id
    WHERE s.service_active = true
      -- Skip if an invoice for this period already exists
      AND NOT EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.user_id      = s.user_id
          AND i.period_start = v_period_start
          AND i.period_end   = v_period_end
      )
  LOOP
    -- Resolve recipient address:
    -- Prefer organization address for B2B; fall back to profile.
    IF rec.organization_id IS NOT NULL AND rec.org_name IS NOT NULL THEN
      v_recipient_name    := rec.org_name;
      v_recipient_street  := COALESCE(rec.org_street,   rec.profile_street);
      v_recipient_zip     := COALESCE(rec.org_zip,      rec.profile_zip);
      v_recipient_city    := COALESCE(rec.org_city,     rec.profile_city);
      v_recipient_country := COALESCE(rec.org_country,  rec.profile_country, 'Deutschland');
      v_recipient_vat_id  := COALESCE(rec.org_vat_id,   rec.profile_vat_id);
    ELSE
      v_recipient_name    := trim(
                               COALESCE(rec.first_name, '') || ' ' ||
                               COALESCE(rec.last_name,  '')
                             );
      -- Fall back to company name if full name is blank
      IF v_recipient_name = '' THEN
        v_recipient_name := COALESCE(rec.company, 'Unbekannt');
      END IF;
      v_recipient_street  := rec.profile_street;
      v_recipient_zip     := rec.profile_zip;
      v_recipient_city    := rec.profile_city;
      v_recipient_country := COALESCE(rec.profile_country, 'Deutschland');
      v_recipient_vat_id  := rec.profile_vat_id;
    END IF;
    v_recipient_email := rec.profile_email;

    -- Base plan fee (net)
    v_base_net_cents := COALESCE(rec.plan_price_cents, 0);

    -- Overage minutes: prefer the dedicated overage_minutes column;
    -- fall back to calculating from used_minutes - included_minutes.
    v_overage_minutes := GREATEST(
      0,
      COALESCE(
        rec.overage_minutes::integer,
        (COALESCE(rec.used_minutes, 0) - COALESCE(rec.included_minutes, 0))::integer
      )
    );
    v_overage_net_cents := v_overage_minutes * v_overage_rate_cents;

    -- Totals
    v_net_cents   := v_base_net_cents + v_overage_net_cents;
    v_tax_cents   := round(v_net_cents * v_tax_rate / 100)::integer;
    v_gross_cents := v_net_cents + v_tax_cents;

    -- Insert the invoice header (invoice_number assigned by trigger)
    INSERT INTO invoices (
      user_id,
      organization_id,
      invoice_number,
      status,
      invoice_date,
      due_date,
      period_start,
      period_end,
      net_amount_cents,
      tax_rate,
      tax_amount_cents,
      gross_amount_cents,
      currency,
      recipient_name,
      recipient_street,
      recipient_zip,
      recipient_city,
      recipient_country,
      recipient_vat_id,
      recipient_email
    ) VALUES (
      rec.user_id,
      rec.organization_id,
      NULL,           -- trigger assigns invoice_number
      'draft',
      CURRENT_DATE,
      CURRENT_DATE + 14,
      v_period_start,
      v_period_end,
      v_net_cents,
      v_tax_rate,
      v_tax_cents,
      v_gross_cents,
      'EUR',
      v_recipient_name,
      v_recipient_street,
      v_recipient_zip,
      v_recipient_city,
      v_recipient_country,
      v_recipient_vat_id,
      v_recipient_email
    )
    RETURNING id INTO v_invoice_id;

    v_position := 1;

    -- Line item 1: monthly plan fee (always present)
    INSERT INTO invoice_items (
      invoice_id,
      position,
      description,
      quantity,
      unit,
      unit_price_cents,
      net_amount_cents,
      tax_rate,
      tax_amount_cents,
      gross_amount_cents
    ) VALUES (
      v_invoice_id,
      v_position,
      'Monatliche Grundgebühr (' ||
        to_char(v_period_start, 'DD.MM.YYYY') || ' – ' ||
        to_char(v_period_end,   'DD.MM.YYYY') || ')',
      1,
      'Monat',
      v_base_net_cents,
      v_base_net_cents,
      v_tax_rate,
      round(v_base_net_cents * v_tax_rate / 100)::integer,
      v_base_net_cents + round(v_base_net_cents * v_tax_rate / 100)::integer
    );

    -- Line item 2: overage (only when extra minutes were used)
    IF v_overage_minutes > 0 THEN
      v_position := v_position + 1;

      INSERT INTO invoice_items (
        invoice_id,
        position,
        description,
        quantity,
        unit,
        unit_price_cents,
        net_amount_cents,
        tax_rate,
        tax_amount_cents,
        gross_amount_cents
      ) VALUES (
        v_invoice_id,
        v_position,
        'Überminuten (' || v_overage_minutes || ' Min. × 0,15 €)',
        v_overage_minutes,
        'Min.',
        v_overage_rate_cents,
        v_overage_net_cents,
        v_tax_rate,
        round(v_overage_net_cents * v_tax_rate / 100)::integer,
        v_overage_net_cents + round(v_overage_net_cents * v_tax_rate / 100)::integer
      );
    END IF;

  END LOOP;
END;
$$;


-- =============================================
-- 6. RLS Policies
-- =============================================

ALTER TABLE invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items     ENABLE ROW LEVEL SECURITY;

-- invoice_settings: every authenticated user can read (needed to render PDF footer)
CREATE POLICY "authenticated_read_invoice_settings" ON invoice_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- invoice_settings: only superadmins can modify
CREATE POLICY "superadmin_invoice_settings_all" ON invoice_settings
  FOR ALL
  USING (is_superadmin());

-- invoices: customers can read their own invoices
-- Using (SELECT auth.uid()) caches the value per statement rather than evaluating per row
CREATE POLICY "users_read_own_invoices" ON invoices
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- invoices: superadmins have full access
CREATE POLICY "superadmin_invoices_all" ON invoices
  FOR ALL
  USING (is_superadmin());

-- invoice_items: customers can read items belonging to their own invoices
CREATE POLICY "users_read_own_invoice_items" ON invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id      = invoice_items.invoice_id
        AND i.user_id = (SELECT auth.uid())
    )
  );

-- invoice_items: superadmins have full access
CREATE POLICY "superadmin_invoice_items_all" ON invoice_items
  FOR ALL
  USING (is_superadmin());


-- =============================================
-- 7. pg_cron scheduled job
--    Requires Supabase Pro plan with pg_cron enabled.
--    Uncomment and run manually after upgrading:
-- =============================================

-- SELECT cron.schedule(
--   'generate-monthly-invoices',  -- job name
--   '0 3 1 * *',                  -- 03:00 on the 1st of every month
--   'SELECT generate_monthly_invoices()'
-- );
