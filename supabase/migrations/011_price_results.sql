-- Persistent price search results per licitacion
CREATE TABLE IF NOT EXISTS price_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  licitacion_id INTEGER NOT NULL REFERENCES licitaciones(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'units',
  unit_price TEXT,
  source_url TEXT,
  source_name TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  searched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_results_lic
  ON price_results(org_id, licitacion_id);
