// Check RLS read access to tables in Supabase
// NOTE: This checks if the authenticated user can READ from tables under RLS policies.
// It does NOT definitively check if tables exist - only if they're accessible.
// A ❌ could mean: table doesn't exist, RLS blocks access, or user not authenticated.

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

async function checkTableAccess() {
  console.log('🔍 Checking RLS read access to tables...\n');
  console.log('⚠️  NOTE: This tests read access under RLS policies, not table existence.\n');
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.log(`❌ ${table} - table does not exist OR no read access`);
        } else if (error.code === '42501' || error.message.includes('permission denied')) {
          console.log(`🔒 ${table} - exists but RLS blocks anonymous access (expected)`);
        } else {
          console.log(`❌ ${table} - error: ${error.message}`);
        }
      } else {
        console.log(`✅ ${table} - accessible (has data or allows anonymous read)`);
      }
    } catch (err) {
      console.log(`❌ ${table} - error: ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('To apply migrations, use Supabase CLI:');
  console.log('  supabase db push');
  console.log('  OR');
  console.log('  supabase migration up');
  console.log('\nFor definitive table existence check, use Supabase Dashboard or CLI.');
}

checkTableAccess();
