-- =============================================
-- Call Lana: Invoice Email Trigger
-- Sends a webhook to the send-invoice-email Edge Function
-- when a new draft invoice is created.
-- Prerequisites: 019_invoices.sql, pg_net extension
-- =============================================


-- =============================================
-- 1. Enable pg_net extension (available on Supabase by default)
-- =============================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- =============================================
-- 2. Trigger function: HTTP POST to Edge Function via pg_net
-- =============================================

CREATE OR REPLACE FUNCTION notify_invoice_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_edge_url  text;
  v_svc_key   text;
BEGIN
  -- Only trigger for new draft invoices
  IF NEW.status = 'draft' THEN

    -- Read config from app.settings (set via Supabase Dashboard > Settings > Database)
    -- or fall back to environment-based defaults
    BEGIN
      v_edge_url := current_setting('app.settings.edge_function_url', true);
    EXCEPTION WHEN OTHERS THEN
      v_edge_url := NULL;
    END;

    BEGIN
      v_svc_key := current_setting('app.settings.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_svc_key := NULL;
    END;

    -- Skip if not configured
    IF v_edge_url IS NULL OR v_svc_key IS NULL THEN
      RAISE LOG 'notify_invoice_created: edge_function_url or service_role_key not configured, skipping webhook for invoice %', NEW.id;
      RETURN NEW;
    END IF;

    -- Fire async HTTP POST via pg_net (non-blocking)
    PERFORM net.http_post(
      url     := v_edge_url || '/send-invoice-email',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_svc_key
      ),
      body    := jsonb_build_object(
        'invoice_id', NEW.id::text
      )
    );

  END IF;

  RETURN NEW;
END;
$$;


-- =============================================
-- 3. Attach trigger to invoices table
-- =============================================

DROP TRIGGER IF EXISTS trg_notify_invoice_created ON invoices;

CREATE TRIGGER trg_notify_invoice_created
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION notify_invoice_created();


-- =============================================
-- 4. Configuration instructions
-- =============================================

-- Set these via Supabase SQL Editor or Dashboard (Settings > Database > Database Settings):
--
--   ALTER DATABASE postgres SET app.settings.edge_function_url = 'https://<project-ref>.supabase.co/functions/v1';
--   ALTER DATABASE postgres SET app.settings.service_role_key  = '<your-service-role-key>';
--
-- After setting, reload config:
--   SELECT pg_reload_conf();


-- =============================================
-- 5. ALTERNATIVE: Supabase Dashboard Webhook
-- =============================================
--
-- Instead of this pg_net trigger, you can use Supabase's built-in
-- Database Webhooks (Dashboard > Database > Webhooks):
--
-- 1. Go to Dashboard > Database > Webhooks > "Create a new hook"
-- 2. Name: "send-invoice-email"
-- 3. Table: invoices
-- 4. Events: INSERT
-- 5. Type: "Supabase Edge Function"
-- 6. Edge Function: send-invoice-email
-- 7. HTTP Headers:
--    - Content-Type: application/json
-- 8. Payload: the entire record (default)
--
-- If using the Dashboard webhook, you can disable this trigger:
--   DROP TRIGGER IF EXISTS trg_notify_invoice_created ON invoices;
--
-- The Edge Function handles both payload formats:
--   - Direct: { "invoice_id": "uuid" }
--   - Webhook: { "record": { "id": "uuid", ... } }
