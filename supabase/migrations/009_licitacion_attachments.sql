-- Per-licitacion file attachments (quotes, specs, certifications, etc.)
CREATE TABLE IF NOT EXISTS licitacion_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  licitacion_id INTEGER NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  file_size_bytes INTEGER,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, licitacion_id, filename)
);

CREATE INDEX IF NOT EXISTS idx_lic_attachments_lic ON licitacion_attachments(licitacion_id);
