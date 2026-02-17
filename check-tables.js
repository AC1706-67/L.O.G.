// Check if tables exist in Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

const tables = [
  'organizations',
  'users',
  'participants',
  'consents',
  'intake_sessions',
  'assessments',
  'interactions',
  'audit_logs',
  'queries',
  'recovery_plans',
  'goals',
  'progress_notes'
];

async function checkTables() {
  console.log('🔍 Checking which tables exist...\n');
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.log(`❌ ${table} - does not exist`);
        } else {
          console.log(`❌ ${table} - error: ${error.message}`);
        }
      } else {
        console.log(`✅ ${table} - exists`);
      }
    } catch (err) {
      console.log(`❌ ${table} - error: ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('If you see ❌ for any tables, run complete-setup.sql');
}

checkTables();
