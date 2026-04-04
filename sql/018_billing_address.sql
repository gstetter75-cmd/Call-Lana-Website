-- =============================================
-- Call Lana: Billing Address Fields
-- Adds address and VAT ID columns to profiles and organizations
-- Required for automated invoice generation (019_invoices.sql)
-- Run BEFORE 019_invoices.sql
-- =============================================

-- Add billing address fields to profiles
-- IF NOT EXISTS guards make this migration idempotent
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS street  text,
  ADD COLUMN IF NOT EXISTS zip     text,
  ADD COLUMN IF NOT EXISTS city    text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Deutschland',
  ADD COLUMN IF NOT EXISTS vat_id  text;

-- Add billing address fields to organizations
-- Organization address takes precedence over profile address for B2B invoices
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS street  text,
  ADD COLUMN IF NOT EXISTS zip     text,
  ADD COLUMN IF NOT EXISTS city    text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Deutschland',
  ADD COLUMN IF NOT EXISTS vat_id  text;
