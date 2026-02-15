-- Add missing columns to licitaciones table
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS estimated_value TEXT;
