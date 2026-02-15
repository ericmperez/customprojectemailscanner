-- ============================================================================
-- Multi-Tenant SaaS Migration
-- ============================================================================
-- This migration transforms the single-tenant app into a multi-tenant SaaS.
-- It creates the organizations table, the licitaciones table (replacing Google
-- Sheets), adds org_id to all existing tables, and sets up RLS policies.
-- ============================================================================

-- 1. Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'trial',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Licitaciones table (replaces Google Sheets)
CREATE TABLE IF NOT EXISTS licitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ DEFAULT now(),
  email_date TIMESTAMPTZ,
  subject TEXT,
  title TEXT,
  location TEXT,
  description TEXT,
  summary TEXT,
  category TEXT,
  priority TEXT DEFAULT 'Medium',
  pdf_filename TEXT,
  pdf_url TEXT,
  site_visit_date TEXT,
  site_visit_time TEXT,
  visit_location TEXT,
  visit_requirements TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  bidding_close_date TEXT,
  bidding_close_time TEXT,
  estimated_value TEXT,
  extraction_method TEXT,
  email_id TEXT,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approval_notes TEXT DEFAULT '',
  interested BOOLEAN DEFAULT false,
  is_emergency BOOLEAN DEFAULT false,
  decision_status TEXT DEFAULT 'researching',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, email_id)
);

CREATE INDEX IF NOT EXISTS idx_licitaciones_org ON licitaciones(org_id);
CREATE INDEX IF NOT EXISTS idx_licitaciones_email ON licitaciones(email_id);
CREATE INDEX IF NOT EXISTS idx_licitaciones_status ON licitaciones(org_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_licitaciones_close_date ON licitaciones(org_id, bidding_close_date);

-- 3. Organization credentials (for Gmail OAuth per org)
CREATE TABLE IF NOT EXISTS organization_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'gmail',
  email_address TEXT,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  token_expiry TIMESTAMPTZ,
  scopes TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, provider)
);

-- 4. Usage tracking
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  emails_processed INTEGER DEFAULT 0,
  pdfs_stored INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  UNIQUE(org_id, month)
);

-- 5. Add org_id to existing tables

-- processed_emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processed_emails' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE processed_emails ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_processed_emails_org ON processed_emails(org_id);
  END IF;
END $$;

-- app_settings: add org_id and change unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_settings' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE app_settings ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    -- Drop old unique constraint on key (if exists) and add composite
    ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
    ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
    -- Create composite unique constraint
    DO $inner$
    BEGIN
      ALTER TABLE app_settings ADD CONSTRAINT app_settings_org_key_unique UNIQUE (org_id, key);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END $inner$;
  END IF;
END $$;

-- correction_examples
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'correction_examples' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE correction_examples ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_correction_examples_org ON correction_examples(org_id);
  END IF;
END $$;

-- activity_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_log' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE activity_log ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_activity_log_org ON activity_log(org_id);
  END IF;
END $$;

-- extraction_log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_log' AND column_name = 'org_id'
  ) THEN
    ALTER TABLE extraction_log ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_extraction_log_org ON extraction_log(org_id);
  END IF;
END $$;

-- 6. Row-Level Security (RLS) policies
-- The service role key bypasses RLS. API layer sets app.current_org_id via SET LOCAL.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "org_self_access" ON organizations
  USING (id = (current_setting('app.current_org_id', true))::uuid);

ALTER TABLE licitaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "org_isolation_licitaciones" ON licitaciones
  USING (org_id = (current_setting('app.current_org_id', true))::uuid);

ALTER TABLE organization_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "org_isolation_credentials" ON organization_credentials
  USING (org_id = (current_setting('app.current_org_id', true))::uuid);

ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "org_isolation_usage" ON usage_records
  USING (org_id = (current_setting('app.current_org_id', true))::uuid);

-- Only enable RLS on existing tables if they exist
DO $$
BEGIN
  -- processed_emails
  ALTER TABLE processed_emails ENABLE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY "org_isolation_processed_emails" ON processed_emails
      USING (org_id = (current_setting('app.current_org_id', true))::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- app_settings
  ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY "org_isolation_app_settings" ON app_settings
      USING (org_id = (current_setting('app.current_org_id', true))::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- correction_examples
  ALTER TABLE correction_examples ENABLE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY "org_isolation_correction_examples" ON correction_examples
      USING (org_id = (current_setting('app.current_org_id', true))::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- activity_log
  ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY "org_isolation_activity_log" ON activity_log
      USING (org_id = (current_setting('app.current_org_id', true))::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- extraction_log
  ALTER TABLE extraction_log ENABLE ROW LEVEL SECURITY;
  BEGIN
    CREATE POLICY "org_isolation_extraction_log" ON extraction_log
      USING (org_id = (current_setting('app.current_org_id', true))::uuid);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 7. Update match_corrections RPC to accept org_id
CREATE OR REPLACE FUNCTION match_corrections(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_org_id uuid DEFAULT NULL
)
RETURNS TABLE (
  field text,
  original text,
  corrected text,
  context text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.field,
    ce.original,
    ce.corrected,
    ce.context,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM correction_examples ce
  WHERE 1 - (ce.embedding <=> query_embedding) > match_threshold
    AND (p_org_id IS NULL OR ce.org_id = p_org_id)
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
