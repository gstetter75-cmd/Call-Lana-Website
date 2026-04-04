-- Integration connections: stores OAuth tokens and sync config per user
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_label text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
  -- OAuth tokens: stored encrypted at application layer (AES-256-GCM)
  -- NEVER store plaintext tokens. Use encryption_key_id to reference the decryption key.
  access_token_encrypted bytea,
  refresh_token_encrypted bytea,
  encryption_key_id text,
  token_expires_at timestamptz,
  -- Sync settings
  sync_enabled boolean DEFAULT true,
  sync_interval_minutes integer DEFAULT 15,
  last_sync_at timestamptz,
  last_sync_status text,
  records_synced integer DEFAULT 0,
  -- Config
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- Customer contacts: synced from CRM/external tools
CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  -- Contact info
  external_id text,
  first_name text,
  last_name text,
  company text,
  email text,
  phone text,
  phone_secondary text,
  -- Context for the AI assistant
  notes text,
  tags text[],
  vip boolean DEFAULT false,
  language text DEFAULT 'de',
  -- Source tracking
  source text NOT NULL DEFAULT 'manual',
  -- Timestamps
  last_contact_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Customer appointments: synced from calendar tools
CREATE TABLE IF NOT EXISTS customer_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,
  external_id text,
  contact_id uuid REFERENCES customer_contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location text,
  status text DEFAULT 'confirmed',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Integration sync log
CREATE TABLE IF NOT EXISTS integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  records_affected integer DEFAULT 0,
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

-- Users see only their own data
CREATE POLICY "users_own_integrations" ON integrations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_contacts" ON customer_contacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_appointments" ON customer_appointments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_integration_logs" ON integration_logs FOR ALL USING (auth.uid() = user_id);

-- Superadmin access
CREATE POLICY "superadmin_integrations" ON integrations FOR ALL USING (is_superadmin());
CREATE POLICY "superadmin_contacts" ON customer_contacts FOR ALL USING (is_superadmin());
CREATE POLICY "superadmin_appointments" ON customer_appointments FOR ALL USING (is_superadmin());
CREATE POLICY "superadmin_integration_logs" ON integration_logs FOR ALL USING (is_superadmin());

-- Index for phone lookup during calls (critical for performance)
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON customer_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_secondary ON customer_contacts(phone_secondary);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON customer_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_start ON customer_appointments(user_id, start_at);
