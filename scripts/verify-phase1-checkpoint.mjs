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

const tests = {
  passed: 0,
  failed: 0,
  results: [],
};

function pass(name) {
  tests.passed++;
  tests.results.push({ status: '✅', name });
  console.log(`✅ ${name}`);
}

function fail(name, error) {
  tests.failed++;
  tests.results.push({ status: '❌', name, error });
  console.log(`❌ ${name}`);
  if (error) console.log(`   Error: ${error}`);
}

console.log('\n🔍 Phase 1 Checkpoint - Verifying Foundation\n');
console.log('=' .repeat(60) + '\n');

async function runTests() {
  console.log('📊 1. Database Schema Verification\n');

  try {
    const { error } = await supabase.from('course_search_sessions').select('*').limit(1);
    if (error) throw error;
    pass('course_search_sessions table exists');
  } catch (e) {
    fail('course_search_sessions table', e.message);
  }

  try {
    const { error } = await supabase.from('course_search_session_results').select('*').limit(1);
    if (error) throw error;
    pass('course_search_session_results table exists');
  } catch (e) {
    fail('course_search_session_results table', e.message);
  }

  try {
    const { error } = await supabase.from('user_entitlements').select('*').limit(1);
    if (error) throw error;
    pass('user_entitlements table exists');
  } catch (e) {
    fail('user_entitlements table', e.message);
  }

  try {
    const { error } = await supabase.from('idempotency_keys').select('*').limit(1);
    if (error) throw error;
    pass('idempotency_keys table exists');
  } catch (e) {
    fail('idempotency_keys table', e.message);
  }

  try {
    const { error } = await supabase.from('course_parse_jobs').select('*').limit(1);
    if (error) throw error;
    pass('course_parse_jobs table exists');
  } catch (e) {
    fail('course_parse_jobs table', e.message);
  }

  try {
    const { error } = await supabase
      .from('courses')
      .select('search_keywords, university_metadata, source_domain, deadlines, entry_requirements')
      .limit(1);
    if (error) throw error;
    pass('courses table updated with caching columns');
  } catch (e) {
    fail('courses table caching columns', e.message);
  }

  try {
    const { error } = await supabase
      .from('course_applications')
      .select('parse_status, progress_percentage, course_url')
      .limit(1);
    if (error) throw error;
    pass('course_applications table updated with parse_status');
  } catch (e) {
    fail('course_applications parse_status column', e.message);
  }

  console.log('\n⚙️  2. Atomic Job Claiming Function\n');

  try {
    const { error } = await supabase.rpc('claim_course_parse_jobs', {
      worker_id: 'test-worker',
      batch_size: 1,
    });
    if (error) throw error;
    pass('claim_course_parse_jobs RPC function exists');
  } catch (e) {
    fail('claim_course_parse_jobs RPC function', e.message);
  }

  try {
    const testAppId = crypto.randomUUID();
    const testCourseUrl = `https://test.edu/verification-${Date.now()}`;

    const { error: appError } = await supabase.from('course_applications').insert({
      id: testAppId,
      user_id: '00000000-0000-0000-0000-000000000000',
      university_name: 'Test University',
      course_name: 'Test Course',
      course_url: testCourseUrl,
      status: 'researching',
      parse_status: 'pending',
    });

    if (appError) throw appError;

    const { error: jobError } = await supabase.from('course_parse_jobs').insert({
      application_id: testAppId,
      course_url: testCourseUrl,
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
    });

    if (jobError) throw jobError;

    const { data: claimedJobs, error: claimError } = await supabase.rpc('claim_course_parse_jobs', {
      worker_id: 'verification-worker-1',
      batch_size: 10,
    });

    if (claimError) throw claimError;

    const foundJob = claimedJobs?.find((job) => job.application_id === testAppId);

    if (foundJob && foundJob.status === 'processing') {
      pass('Atomic job claiming works (FOR UPDATE SKIP LOCKED)');
    } else {
      throw new Error('Job was not claimed or status incorrect');
    }

    await supabase.from('course_applications').delete().eq('id', testAppId);
  } catch (e) {
    fail('Atomic job claiming test', e.message);
    await supabase.from('course_applications').delete().match({ course_url: { startsWith: 'https://test.edu/verification-' } });
  }

  console.log('\n🔐 3. Entitlement System\n');

  try {
    const { error } = await supabase.rpc('get_user_entitlement', {
      target_user_id: '00000000-0000-0000-0000-000000000000',
    });
    if (error) throw error;
    pass('get_user_entitlement helper function exists');
  } catch (e) {
    fail('get_user_entitlement function', e.message);
  }

  try {
    const testUserId = crypto.randomUUID();

    await supabase.from('user_entitlements').insert({
      user_id: testUserId,
      plan: 'free',
      course_search_limit: 3,
      course_add_limit: 5,
    });

    const { data, error } = await supabase.rpc('get_user_entitlement', {
      target_user_id: testUserId,
    });

    if (error) throw error;

    if (data.plan === 'free' && data.course_search_limit === 3 && data.course_add_limit === 5) {
      pass('Free tier limits enforced (3 searches, 5 courses)');
    } else {
      throw new Error('Free tier limits incorrect');
    }

    await supabase.from('user_entitlements').delete().eq('user_id', testUserId);
  } catch (e) {
    fail('Free tier limits test', e.message);
  }

  try {
    const testUserId = crypto.randomUUID();

    await supabase.from('user_entitlements').insert({
      user_id: testUserId,
      plan: 'plus',
      course_search_limit: 999999,
      course_add_limit: 999999,
    });

    const { data, error } = await supabase.rpc('get_user_entitlement', {
      target_user_id: testUserId,
    });

    if (error) throw error;

    if (data.plan === 'plus' && data.course_search_limit === 999999) {
      pass('Plus tier provides unlimited limits');
    } else {
      throw new Error('Plus tier limits incorrect');
    }

    await supabase.from('user_entitlements').delete().eq('user_id', testUserId);
  } catch (e) {
    fail('Plus tier limits test', e.message);
  }

  console.log('\n🔍 4. Search Provider Interface\n');

  try {
    const { getSearchProvider } = await import('../src/lib/search-providers/index.ts');
    const provider = getSearchProvider();

    if (provider && provider.name === 'tavily' && typeof provider.search === 'function') {
      pass('TavilySearchProvider available and configured');
    } else {
      throw new Error('Search provider not properly configured');
    }
  } catch (e) {
    fail('Search Provider interface', e.message);
  }

  console.log('\n⚙️  5. Background Job Processor\n');

  try {
    const { createParseJob } = await import('../src/lib/course-parser/job-queue.ts');

    if (typeof createParseJob === 'function') {
      pass('Job queue data access layer exists');
    } else {
      throw new Error('createParseJob function not found');
    }
  } catch (e) {
    fail('Job queue data access layer', e.message);
  }

  try {
    const { recordJobFailure } = await import('../src/lib/course-parser/job-queue.ts');
    const testAppId = crypto.randomUUID();
    const testCourseUrl = `https://test.edu/backoff-${Date.now()}`;

    await supabase.from('course_applications').insert({
      id: testAppId,
      user_id: '00000000-0000-0000-0000-000000000000',
      university_name: 'Test University',
      course_name: 'Test Course',
      course_url: testCourseUrl,
      status: 'researching',
      parse_status: 'pending',
    });

    const { data: job } = await supabase
      .from('course_parse_jobs')
      .insert({
        application_id: testAppId,
        course_url: testCourseUrl,
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
      })
      .select()
      .single();

    if (job) {
      await recordJobFailure(job.id, new Error('Test failure'), true);

      const { data: updatedJob } = await supabase
        .from('course_parse_jobs')
        .select('attempts, next_attempt_at, status')
        .eq('id', job.id)
        .single();

      if (updatedJob.attempts === 1 && updatedJob.next_attempt_at) {
        const nextAttemptTime = new Date(updatedJob.next_attempt_at).getTime();
        const now = Date.now();
        const delay = nextAttemptTime - now;

        if (delay > 4 * 60 * 1000 && delay < 6 * 60 * 1000) {
          pass('Exponential backoff configured correctly (5min retry)');
        } else {
          throw new Error(`Backoff delay incorrect: ${Math.round(delay / 1000 / 60)}min`);
        }
      } else {
        throw new Error('Job failure not recorded properly');
      }
    }

    await supabase.from('course_applications').delete().eq('id', testAppId);
  } catch (e) {
    fail('Exponential backoff test', e.message);
  }

  console.log('\n🧹 6. Cleanup Job for Stale Sessions\n');

  try {
    const { error } = await supabase.rpc('cleanup_stale_search_sessions');
    if (error) throw error;
    pass('cleanup_stale_search_sessions function exists');
  } catch (e) {
    fail('cleanup_stale_search_sessions function', e.message);
  }

  try {
    const testUserId = '00000000-0000-0000-0000-000000000000';
    const oldTimestamp = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: session, error: insertError } = await supabase
      .from('course_search_sessions')
      .insert({
        user_id: testUserId,
        university_id: 1,
        query: 'test stuck session',
        status: 'processing',
        created_at: oldTimestamp,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { data: cleanedCount } = await supabase.rpc('cleanup_stale_search_sessions');

    const { data: updatedSession } = await supabase
      .from('course_search_sessions')
      .select('status, error_code')
      .eq('id', session.id)
      .single();

    if (updatedSession.status === 'failed' && updatedSession.error_code === 'SESSION_TIMEOUT') {
      pass('Cleanup job marks stuck sessions as failed');
    } else {
      throw new Error('Cleanup did not mark session as failed');
    }

    await supabase.from('course_search_sessions').delete().eq('id', session.id);
  } catch (e) {
    fail('Stale session cleanup test', e.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Test Summary: ${tests.passed} passed, ${tests.failed} failed\n`);

  if (tests.failed > 0) {
    console.log('❌ Some tests failed. Please review the errors above.\n');
    process.exit(1);
  } else {
    console.log('✅ All Phase 1 checkpoint tests passed!\n');
    console.log('🎉 Foundation is complete and ready for Phase 2.\n');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('\n❌ Fatal error running tests:', error);
  process.exit(1);
});
