-- Migration script to create the licitaciones table in Supabase
-- Run this in your Supabase SQL Editor

-- Create licitaciones table
CREATE TABLE IF NOT EXISTS licitaciones (
  id SERIAL PRIMARY KEY,
  email_id VARCHAR(255) UNIQUE NOT NULL,
  email_date TIMESTAMP,
  subject TEXT,
  location TEXT,
  description TEXT,
  summary TEXT,
  category VARCHAR(100),
  priority VARCHAR(50),
  pdf_filename TEXT,
  pdf_link TEXT,
  site_visit_date VARCHAR(100),
  site_visit_time VARCHAR(100),
  visit_location TEXT,
  contact_name VARCHAR(255),
  contact_phone VARCHAR(50),
  bidding_close_date VARCHAR(100),
  bidding_close_time VARCHAR(100),
  extraction_method VARCHAR(50),
  approval_status VARCHAR(50) DEFAULT 'pending',
  approval_notes TEXT,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_licitaciones_email_id ON licitaciones(email_id);
CREATE INDEX IF NOT EXISTS idx_licitaciones_approval_status ON licitaciones(approval_status);
CREATE INDEX IF NOT EXISTS idx_licitaciones_bidding_close_date ON licitaciones(bidding_close_date);
CREATE INDEX IF NOT EXISTS idx_licitaciones_created_at ON licitaciones(created_at DESC);

-- Add comments to document the table
COMMENT ON TABLE licitaciones IS 'Stores all licitación data extracted from Gmail for dashboard approval workflow';
COMMENT ON COLUMN licitaciones.approval_status IS 'Status: pending, approved, or rejected';
COMMENT ON COLUMN licitaciones.email_id IS 'Unique Gmail message ID';

-- Grant permissions (adjust as needed for your Supabase setup)
-- If you're using Row Level Security (RLS), you may need to add policies
-- For now, this assumes service role access

-- Example: Enable RLS (optional - uncomment if needed)
-- ALTER TABLE licitaciones ENABLE ROW LEVEL SECURITY;

-- Example: Create policy for authenticated users (optional - uncomment if needed)
-- CREATE POLICY "Allow authenticated users to read licitaciones"
--   ON licitaciones FOR SELECT
--   TO authenticated
--   USING (true);

-- Example: Create policy for service role to write (optional - uncomment if needed)
-- CREATE POLICY "Allow service role to write licitaciones"
--   ON licitaciones FOR ALL
--   TO service_role
--   USING (true);



