import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

if (process.env.GLOWBAL_SECURITY_TEST_RUN !== '1') {
  console.error('Refusing to run. Set GLOWBAL_SECURITY_TEST_RUN=1 for a disposable test project.');
  process.exit(2);
}

const names = [
  'GLOWBAL_SECURITY_TEST_URL',
  'GLOWBAL_SECURITY_TEST_SERVICE_ROLE_KEY',
  'GLOWBAL_SECURITY_TEST_ANON_KEY',
];
for (const name of names) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const url = process.env.GLOWBAL_SECURITY_TEST_URL;
const localEnv = fs.existsSync(path.resolve('.env.local'))
  ? fs.readFileSync(path.resolve('.env.local'), 'utf8')
  : '';
const liveUrl = localEnv.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
if (liveUrl && liveUrl.replace(/\/$/, '') === url.replace(/\/$/, '')) {
  throw new Error('Refusing to run against NEXT_PUBLIC_SUPABASE_URL from .env.local');
}

const admin = createClient(url, process.env.GLOWBAL_SECURITY_TEST_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = () => createClient(url, process.env.GLOWBAL_SECURITY_TEST_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const token = crypto.randomUUID();
const users = [];
const sessions = [];
const applicationIds = [];
const profileIds = [];
const storageObjects = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createTestUser(label) {
  const email = `security-${label}-${token}@example.invalid`;
  const password = `GlowBal-${token}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${label}`);
  users.push(data.user.id);

  const client = anon();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return client;
}

async function createSession(userId, universityId, label) {
  const { data, error } = await admin
    .from('course_search_sessions')
    .insert({ user_id: userId, query: `security-${label}`, status: 'complete' })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error(`Could not create ${label} session`);
  sessions.push(data.id);

  const result = await admin
    .from('course_search_session_results')
    .insert({
      session_id: data.id,
      university_id: universityId,
      course_name: `Security test ${label}`,
      course_url: `https://security-test.invalid/${token}/${label}`,
      source_type: 'web',
      selected: false,
    })
    .select('id')
    .single();
  if (result.error || !result.data) throw result.error ?? new Error(`Could not create ${label} result`);
  return { id: data.id, resultId: result.data.id };
}

async function expectRpcError(client, args, label) {
  const { error } = await client.rpc('add_selected_courses_to_apply', args);
  assert(error, `${label}: expected RPC denial`);
  console.log(`PASS ${label}`);
}

async function countRows(table, column, value) {
  const { count, error } = await admin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

async function testStorage(clientA, clientB, bucket) {
  const aPath = `${users[0]}/${bucket}-${token}-a.txt`;
  const bPath = `${users[1]}/${bucket}-${token}-b.txt`;
  const body = new Blob(['disposable security test']);

  const aUpload = await clientA.storage.from(bucket).upload(aPath, body, { upsert: false });
  const bUpload = await clientB.storage.from(bucket).upload(bPath, body, { upsert: false });
  if (aUpload.error) throw aUpload.error;
  if (bUpload.error) throw bUpload.error;
  storageObjects.push([bucket, aPath], [bucket, bPath]);

  const own = await clientA.storage.from(bucket).download(aPath);
  assert(!own.error && own.data, `${bucket}: owner download failed`);
  const foreignDownload = await clientA.storage.from(bucket).download(bPath);
  assert(foreignDownload.error, `${bucket}: cross-user download was allowed`);
  const foreignSigned = await clientA.storage.from(bucket).createSignedUrl(bPath, 60);
  assert(foreignSigned.error, `${bucket}: cross-user signed URL was allowed`);
  const foreignList = await clientA.storage.from(bucket).list(users[1]);
  assert(!foreignList.data?.some((item) => item.name === path.posix.basename(bPath)), `${bucket}: cross-user list was allowed`);
  const foreignUpload = await clientA.storage.from(bucket).upload(bPath, body, { upsert: false });
  assert(foreignUpload.error, `${bucket}: cross-user upload was allowed`);
  console.log(`PASS ${bucket} owner-only storage access`);
}

let clientA;
let clientB;
try {
  const { data: university, error: universityError } = await admin
    .from('universities')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (universityError || !university) throw universityError ?? new Error('No disposable test university exists');

  clientA = await createTestUser('a');
  clientB = await createTestUser('b');
  const sessionA = await createSession(users[0], university.id, 'a');
  const sessionB = await createSession(users[1], university.id, 'b');

  await expectRpcError(anon(), {
    p_session_id: sessionA.id,
    p_result_ids: [sessionA.resultId],
  }, 'anonymous RPC denied');
  await expectRpcError(clientB, {
    p_session_id: sessionA.id,
    p_result_ids: [sessionA.resultId],
  }, 'cross-user session denied');
  await expectRpcError(clientA, {
    p_session_id: sessionB.id,
    p_result_ids: [sessionB.resultId],
  }, 'cross-user result/session denied');
  const mixedBefore = await countRows('course_applications', 'user_id', users[0]);
  await expectRpcError(clientA, {
    p_session_id: sessionA.id,
    p_result_ids: [sessionA.resultId, sessionB.resultId],
  }, 'mixed batch denied atomically');
  assert((await countRows('course_applications', 'user_id', users[0])) === mixedBefore, 'mixed batch wrote partial application state');
  await expectRpcError(clientA, {
    p_user_id: users[0],
    p_session_id: sessionA.id,
    p_results: [{ result_id: sessionA.resultId }],
  }, 'old caller-controlled RPC contract denied');

  const beforeApps = await countRows('course_applications', 'user_id', users[0]);
  const created = await clientA.rpc('add_selected_courses_to_apply', {
    p_session_id: sessionA.id,
    p_result_ids: [sessionA.resultId],
  });
  if (created.error) throw created.error;
  assert(created.data?.success === true && created.data.count === 1, 'valid RPC did not create one application');
  const createdId = created.data.applications_created?.[0]?.application_id;
  assert(createdId, 'valid RPC did not return an application id');
  applicationIds.push(createdId);
  assert((await countRows('course_applications', 'user_id', users[0])) === beforeApps + 1, 'application count changed incorrectly');
  assert((await countRows('application_sources', 'application_id', createdId)) === 1, 'source count missing');
  assert((await countRows('course_parse_jobs', 'application_id', createdId)) === 1, 'parse job missing');
  const appState = await admin.from('course_applications').select('user_id').eq('id', createdId).single();
  assert(!appState.error && appState.data?.user_id === users[0], 'application owner is incorrect');
  const sourceState = await admin.from('application_sources').select('source_type, validation_status').eq('application_id', createdId).single();
  assert(!sourceState.error && sourceState.data?.source_type === 'course_page' && sourceState.data?.validation_status === 'unchecked', 'source metadata is incorrect');
  const resultState = await admin.from('course_search_session_results').select('selected, selected_application_id').eq('id', sessionA.resultId).single();
  assert(!resultState.error && resultState.data?.selected === true && resultState.data?.selected_application_id === createdId, 'result was not linked to the application');
  console.log('PASS valid RPC creates app/source/job atomically');

  const retry = await clientA.rpc('add_selected_courses_to_apply', {
    p_session_id: sessionA.id,
    p_result_ids: [sessionA.resultId],
  });
  if (retry.error) throw retry.error;
  assert(retry.data?.success === true && retry.data.count === 0, 'RPC retry was not idempotent');
  assert((await countRows('course_applications', 'user_id', users[0])) === beforeApps + 1, 'RPC retry created a duplicate');
  console.log('PASS RPC retry is idempotent');

  for (const id of users) {
    const { error } = await admin.from('achiever_profiles').insert({
      id,
      display_name: `Security test ${id === users[0] ? 'A' : 'B'}`,
      legal_name: `Private ${id}`,
      date_of_birth: '2000-01-01',
      degree_level: 'masters',
      subject: 'Security testing',
      session_price_vnd: 100000,
      session_duration_mins: 60,
      status: 'approved',
      cv_storage_key: `${id}/cv.txt`,
      stripe_account_id: `acct-test-${id}`,
    });
    if (error) throw error;
    profileIds.push(id);
  }
  const privateRead = await clientA.from('achiever_profiles').select('legal_name, stripe_account_id').eq('id', users[1]);
  assert(privateRead.error, 'authenticated user could select private mentor columns');
  const publicRead = await clientA.from('public_mentor_profiles').select('*').eq('id', users[1]);
  if (publicRead.error) throw publicRead.error;
  assert(publicRead.data?.[0] && !('legal_name' in publicRead.data[0]) && !('stripe_account_id' in publicRead.data[0]), 'public mentor projection exposed private fields');
  console.log('PASS mentor private columns are not readable by students');

  await testStorage(clientA, clientB, 'mentor-documents');
  await testStorage(clientA, clientB, 'student-documents');
  console.log('Critical security integration checks passed.');
} finally {
  for (const [bucket, object] of storageObjects) {
    await admin.storage.from(bucket).remove([object]).catch(() => undefined);
  }
  if (applicationIds.length) {
    await admin.from('course_applications').delete().in('id', applicationIds);
  }
  if (profileIds.length) {
    await admin.from('achiever_profiles').delete().in('id', profileIds);
  }
  if (sessions.length) {
    await admin.from('course_search_sessions').delete().in('id', sessions);
  }
  for (const userId of users) {
    await admin.auth.admin.deleteUser(userId);
  }
}
