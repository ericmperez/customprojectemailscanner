import { createClient } from '@supabase/supabase-js';
import { config } from '../config/credentials.js';

/**
 * Setup Supabase tables needed for the licitaciones system
 */
async function setupDatabase() {
  try {
    console.log('🔧 Setting up Supabase tables...\n');

    const supabase = createClient(config.supabase.url, config.supabase.key);

    // Create licitaciones table
    console.log('📋 Creating licitaciones table...');
    
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
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

        CREATE INDEX IF NOT EXISTS idx_licitaciones_email_id ON licitaciones(email_id);
        CREATE INDEX IF NOT EXISTS idx_licitaciones_approval_status ON licitaciones(approval_status);
        CREATE INDEX IF NOT EXISTS idx_licitaciones_bidding_close_date ON licitaciones(bidding_close_date);
        CREATE INDEX IF NOT EXISTS idx_licitaciones_created_at ON licitaciones(created_at DESC);
      `
    });

    if (createError) {
      console.log('⚠️  Could not create tables via RPC. This is normal for some Supabase setups.');
      console.log('📋 Please create the licitaciones table manually in Supabase SQL Editor:');
      console.log('\n' + '='.repeat(60));
      console.log(`
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

CREATE INDEX IF NOT EXISTS idx_licitaciones_email_id ON licitaciones(email_id);
CREATE INDEX IF NOT EXISTS idx_licitaciones_approval_status ON licitaciones(approval_status);
CREATE INDEX IF NOT EXISTS idx_licitaciones_bidding_close_date ON licitaciones(bidding_close_date);
CREATE INDEX IF NOT EXISTS idx_licitaciones_created_at ON licitaciones(created_at DESC);
      `);
      console.log('='.repeat(60));
    } else {
      console.log('✅ Tables created successfully!');
    }

    // Test table access
    console.log('\n🔍 Testing table access...');
    const { data, error: testError } = await supabase
      .from('licitaciones')
      .select('count')
      .limit(1);

    if (testError) {
      console.log('❌ Table not accessible yet. Please create it manually in Supabase.');
      console.log('Error:', testError.message);
    } else {
      console.log('✅ Tables are ready!');
      console.log('\n🎉 Database setup complete. You can now run the unverified biddings processor.');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n📋 Please create the licitaciones table manually in Supabase SQL Editor using the SQL above.');
  }
}

setupDatabase();