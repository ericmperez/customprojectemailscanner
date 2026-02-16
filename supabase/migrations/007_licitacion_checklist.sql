-- Per-licitacion checklist for tracking bid preparation steps
CREATE TABLE IF NOT EXISTS licitacion_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  licitacion_id UUID NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_lic ON licitacion_checklist(licitacion_id);
