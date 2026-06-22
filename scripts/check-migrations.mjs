#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n🔍 Checking Migration Status\n');
console.log('='.repeat(60) + '\n');

const tables = [
  'course_search_sessions',
  'course_search_session_results',
  'user_entitlements',
  'idempotency_keys',
  'course_parse_jobs',
];

const functions = [
  'claim_course_parse_jobs',
  'get_user_entitlement',
  'cleanup_stale_search_sessions',
  'reset_billing_period',
];

async function checkTables() {
  console.log('📊 Checking Tables...\n');
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    
    if (error) {
      console.log(`❌ ${table} - NOT FOUND`);
      console.log(`   Error: ${error.message}\n`);
    } else {
      console.log(`✅ ${table} - EXISTS`);
    }
  }
}

async function checkFunctions() {
  console.log('\n⚙️  Checking Functions...\n');
  
  for (const func of functions) {
    try {
      const { error } = await supabase.rpc(func, 
        func === 'claim_course_parse_jobs' ? { worker_id: 'test', batch_size: 1 } :
        func === 'get_user_entitlement' ? { target_user_id: '00000000-0000-0000-0000-000000000000' } :
        {}
      );
      
      if (error && !error.message.includes('does not exist')) {
        console.log(`✅ ${func} - EXISTS`);
      } else if (error) {
        console.log(`❌ ${func} - NOT FOUND`);
      } else {
        console.log(`✅ ${func} - EXISTS`);
      }
    } catch (e) {
      console.log(`❌ ${func} - ERROR: ${e.message}`);
    }
  }
}

async function checkColumns() {
  console.log('\n📋 Checking Column Updates...\n');
  
  // Check courses table
  const { error: coursesError } = await supabase
    .from('courses')
    .select('search_keywords, university_metadata, source_domain')
    .limit(1);
  
  if (coursesError) {
    console.log('❌ courses table - Missing caching columns');
    console.log(`   Error: ${coursesError.message}\n`);
  } else {
    console.log('✅ courses table - Caching columns added');
  }
  
  // Check course_applications table
  const { error: appsError } = await supabase
    .from('course_applications')
    .select('parse_status, progress_percentage')
    .limit(1);
  
  if (appsError) {
    console.log('❌ course_applications table - Missing parse_status column');
    console.log(`   Error: ${appsError.message}\n`);
  } else {
    console.log('✅ course_applications table - parse_status column added');
  }
}

async function main() {
  await checkTables();
  await checkFunctions();
  await checkColumns();
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📝 Summary:\n');
  console.log('If you see ❌ NOT FOUND errors, you need to apply migrations:');
  console.log('  1. Run: supabase login');
  console.log('  2. Run: supabase link --project-ref uooshbumyilwvbgmbixx');
  console.log('  3. Run: supabase db push\n');
  console.log('Then run: npm run verify:phase1\n');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
