-- Org-level company documents (certifications, licenses, insurance, etc.)
CREATE TABLE IF NOT EXISTS org_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  file_size_bytes INTEGER,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, filename)
);

CREATE INDEX IF NOT EXISTS idx_org_docs_org ON org_documents(org_id);
