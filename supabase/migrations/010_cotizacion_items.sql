-- Cotizacion worksheet: per-licitacion line items with cost breakdown
CREATE TABLE IF NOT EXISTS cotizacion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  licitacion_id INTEGER NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'units',
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
  markup_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(5,2) NOT NULL DEFAULT 11.5,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast per-licitacion lookups
CREATE INDEX IF NOT EXISTS idx_cotizacion_items_lic
  ON cotizacion_items(org_id, licitacion_id);

-- RLS
ALTER TABLE cotizacion_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'cotizacion_items_org_isolation'
  ) THEN
    CREATE POLICY cotizacion_items_org_isolation ON cotizacion_items
      USING (org_id = current_setting('app.current_org_id', true)::uuid);
  END IF;
END $$;
