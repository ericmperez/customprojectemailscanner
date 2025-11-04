-- Licitaciones Dashboard - Database Setup
-- Copy and paste this entire script into Supabase SQL Editor and click RUN

-- 1. Create the licitaciones table
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

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_licitaciones_email_id ON licitaciones(email_id);
CREATE INDEX IF NOT EXISTS idx_licitaciones_approval_status ON licitaciones(approval_status);
CREATE INDEX IF NOT EXISTS idx_licitaciones_bidding_close_date ON licitaciones(bidding_close_date);
CREATE INDEX IF NOT EXISTS idx_licitaciones_created_at ON licitaciones(created_at DESC);

-- 3. Insert sample data for testing the dashboard
INSERT INTO licitaciones (
  email_id,
  email_date,
  subject,
  location,
  description,
  summary,
  category,
  priority,
  pdf_filename,
  pdf_link,
  site_visit_date,
  site_visit_time,
  visit_location,
  contact_name,
  contact_phone,
  bidding_close_date,
  bidding_close_time,
  extraction_method,
  approval_status
) VALUES (
  'sample_demo_dashboard_001',
  '2025-10-31 10:30:00',
  'Licitación 0430012500 - Suministros Generales',
  'San Juan, Puerto Rico',
  'Suministro e instalación de sistema de tuberías de agua potable para residencial en Río Piedras. Incluye materiales, mano de obra, y pruebas de calidad. Proyecto contempla aproximadamente 500 metros lineales de tubería PVC de 6 pulgadas.',
  'Sistema de tuberías de agua potable - Residencial Río Piedras (500m)',
  'Construcción',
  'High',
  'BID0430012500.PDF',
  'HYPERLINK("https://drive.google.com/file/d/sample","📄 Ver PDF")',
  '11/05/2025',
  '10:00 AM',
  'Oficina de Proyectos AAA - Ave. Roosevelt, San Juan',
  'Ing. María Rodriguez',
  '(787) 555-1234',
  '11/15/2025',
  '2:00 PM',
  'AI',
  'pending'
),
(
  'sample_demo_dashboard_002',
  '2025-10-31 14:15:00',
  'Licitación 0530016703 - Suministro de Válvulas',
  'Trujillo Alto, Puerto Rico',
  'Suministro de válvulas de retención en línea de diferentes tamaños con especificaciones detalladas sobre entrega, garantía y cumplimiento de normas.',
  'Válvulas de retención - Varios tamaños',
  'Suministros',
  'Medium',
  'BID0530016703.PDF',
  'https://drive.google.com/file/d/sample2',
  'No requerida',
  'N/A',
  'N/A',
  'Sandra Acevedo',
  '(787) 555-9876',
  '11/01/2025',
  '2:00 PM',
  'AI',
  'pending'
),
(
  'sample_demo_dashboard_003',
  '2025-10-31 09:20:00',
  'Licitación 0230011665 - Instalación Aire Acondicionado',
  'Caguas, Puerto Rico',
  'Compra de Unidad de Aire Acondicionado Inverted (A/C) de 18,000 B.T.U tipo consola de pared con protección contra variaciones de voltaje.',
  'Aire acondicionado 18,000 BTU - Instalación',
  'Servicios - Instalación de aires acondicionados',
  'Medium',
  'BID0230011665.PDF',
  'https://drive.google.com/file/d/sample3',
  '11/03/2025',
  '9:00 AM',
  'Oficina Regional Caguas',
  'Gloria Caraballo',
  '(787) 555-4567',
  '10/08/2025',
  '4:00 PM',
  'AI',
  'rejected'
)
ON CONFLICT (email_id) DO NOTHING;

-- 4. Verify the setup
SELECT 
  id,
  subject,
  location,
  category,
  priority,
  approval_status,
  bidding_close_date
FROM licitaciones 
ORDER BY created_at DESC
LIMIT 5;

-- Success message
SELECT 'Dashboard setup completed successfully! You can now run: npm run dashboard' AS message;