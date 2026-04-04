-- =============================================
-- Call Lana: Assistants Table + RLS
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create the assistants table
CREATE TABLE IF NOT EXISTS assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  voice text DEFAULT 'Marie',
  language text DEFAULT 'de',
  greeting text,
  status text DEFAULT 'offline',
  phone_number text,
  model text DEFAULT 'gpt-4',
  temperature numeric DEFAULT 0.7,
  max_duration integer DEFAULT 300,
  tools jsonb DEFAULT '{}',
  post_processing jsonb DEFAULT '{}',
  outbound jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE assistants ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: Users can only access their own assistants
CREATE POLICY "Users can view own assistants"
  ON assistants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assistants"
  ON assistants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assistants"
  ON assistants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assistants"
  ON assistants FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_assistants_updated_at
  BEFORE UPDATE ON assistants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_assistants_user_id ON assistants(user_id);
