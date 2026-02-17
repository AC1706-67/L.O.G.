// Script to apply all Supabase migrations
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Migration files in order
const migrations = [
  '20240101000000_create_core_tables.sql',
  '20240101000001_create_consent_tables.sql',
  '20240101000002_create_intake_assessment_tables.sql',
  '20240101000003_create_logging_tables.sql',
  '20240101000004_create_recovery_plan_tables.sql'
];

async function applyMigrations() {
  console.log('🚀 Starting database migrations...\n');

  for (const migration of migrations) {
    const filePath = path.join(__dirname, 'supabase', 'migrations', migration);
    
    try {
      console.log(`📄 Applying: ${migration}`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        console.error(`❌ Error in ${migration}:`, error.message);
        // Continue with other migrations
      } else {
        console.log(`✅ Success: ${migration}\n`);
      }
    } catch (err) {
      console.error(`❌ Failed to read ${migration}:`, err.message);
    }
  }

  console.log('✨ Migration process complete!');
}

applyMigrations();
