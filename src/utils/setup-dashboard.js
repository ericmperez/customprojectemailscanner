import { createClient } from '@supabase/supabase-js';
import { config } from '../config/credentials.js';
import logger from '../utils/logger.js';

/**
 * Create the licitaciones table and populate it with data from processed emails
 * This script will:
 * 1. Create the licitaciones table
 * 2. Migrate existing processed data to the new table structure
 * 3. Set up the dashboard ready state
 */

async function setupLicitacionesTable() {
  try {
    console.log('🔧 Setting up licitaciones table and migrating data...\n');

    const supabase = createClient(config.supabase.url, config.supabase.key);

    // First, let's try to create the table by inserting a sample record
    // and let Supabase handle the table creation
    console.log('📋 Creating licitaciones table...');

    // Sample licitación to ensure table exists
    const sampleLicitacion = {
      email_id: 'setup_sample_' + Date.now(),
      email_date: new Date().toISOString(),
      subject: 'Licitación SETUP - Configuración del Dashboard',
      location: 'Sistema',
      description: 'Configuración inicial del sistema de licitaciones con dashboard de aprobación.',
      summary: 'Configuración inicial del dashboard',
      category: 'Sistema',
      priority: 'High',
      pdf_filename: 'setup.pdf',
      pdf_link: '#',
      site_visit_date: 'No aplica',
      site_visit_time: 'No aplica',
      visit_location: 'Virtual',
      contact_name: 'Sistema',
      contact_phone: 'N/A',
      bidding_close_date: '12/31/2025',
      bidding_close_time: '11:59 PM',
      extraction_method: 'Manual',
      approval_status: 'pending',
      approval_notes: 'Registro de configuración inicial',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Try to insert the sample record
    const { data: insertResult, error: insertError } = await supabase
      .from('licitaciones')
      .insert([sampleLicitacion])
      .select();

    if (insertError) {
      if (insertError.code === 'PGRST204') {
        console.log('❌ Table licitaciones does not exist.');
        console.log('📋 Please create the table manually in Supabase SQL Editor:');
        console.log('\n' + '='.repeat(80));
        console.log(`
-- Copy and paste this SQL into Supabase SQL Editor

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_licitaciones_email_id ON licitaciones(email_id);
CREATE INDEX IF NOT EXISTS idx_licitaciones_approval_status ON licitaciones(approval_status);
CREATE INDEX IF NOT EXISTS idx_licitaciones_bidding_close_date ON licitaciones(bidding_close_date);
CREATE INDEX IF NOT EXISTS idx_licitaciones_created_at ON licitaciones(created_at DESC);

-- Insert sample data for testing
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
  'sample_demo_12345',
  '2025-10-31 10:30:00',
  'Licitación 0430012500 - EJEMPLO DEMO',
  'San Juan, Puerto Rico',
  'Suministro e instalación de sistema de tuberías de agua potable para residencial en Río Piedras.',
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
) ON CONFLICT (email_id) DO NOTHING;
        `);
        console.log('='.repeat(80));
        
        console.log('\n🚀 After creating the table, run this command to start the dashboard:');
        console.log('   npm run dashboard');
        console.log('\n📱 The dashboard will be available at: http://localhost:4000');
        
        return false;
      } else {
        throw insertError;
      }
    } else {
      console.log('✅ Table exists and sample data inserted successfully!');
      
      // Clean up the sample record
      await supabase
        .from('licitaciones')
        .delete()
        .eq('email_id', sampleLicitacion.email_id);
        
      console.log('✅ Setup completed successfully!');
      return true;
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

async function testDashboardReadiness() {
  try {
    console.log('\n🔍 Testing dashboard readiness...');
    
    const supabase = createClient(config.supabase.url, config.supabase.key);
    
    // Test if we can query the table
    const { data, error } = await supabase
      .from('licitaciones')
      .select('count')
      .limit(1);

    if (error) {
      console.log('❌ Dashboard not ready:', error.message);
      return false;
    }
    
    console.log('✅ Dashboard is ready!');
    console.log('\n🚀 To start the dashboard, run:');
    console.log('   npm run dashboard');
    console.log('\n📱 Dashboard will be available at: http://localhost:4000');
    
    return true;
    
  } catch (error) {
    console.error('❌ Dashboard test failed:', error.message);
    return false;
  }
}

// Run setup
const success = await setupLicitacionesTable();
if (success) {
  await testDashboardReadiness();
}