-- Add connected_at column to integrations table
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS connected_at timestamptz;
