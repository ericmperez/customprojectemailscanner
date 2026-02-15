-- Activity Log table for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  licitacion_id TEXT,
  licitacion_title TEXT,
  user_name TEXT NOT NULL DEFAULT 'Usuario',
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_org_created
  ON activity_log (org_id, created_at DESC);
