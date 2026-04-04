-- =============================================
-- Call Lana: Add industry column to leads table
-- =============================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS industry text;
