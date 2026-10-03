#!/usr/bin/env node
/**
 * Full logical backup of the live Supabase Postgres database.
 *
 * Works even while the project is API-restricted (HTTP 402): the restriction is
 * applied at the API gateway (PostgREST / Storage / Auth / Functions), not at
 * Postgres. Direct connections through the session pooler still authenticate.
 *
 * Requires the database password — reset it at
 *   Dashboard -> Project Settings -> Database -> Reset database password
 * (resetting does not require knowing the old one).
 *
 *   node --env-file=.env.local scripts/backup-supabase.mjs --password "<pw>"
 *   SUPABASE_DB_PASSWORD=... node --env-file=.env.local scripts/backup-supabase.mjs
 *
 * Output goes OUTSIDE the repo by default: backups contain real student PII and
 * auth rows, and must never reach git.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};

const password = argOf('password') ?? process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('Missing database password. Pass --password <pw> or set SUPABASE_DB_PASSWORD.');
  console.error('Reset it at: Dashboard -> Project Settings -> Database -> Reset database password');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ref = argOf('ref') ?? supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) {
  console.error('Could not derive the project ref. Run with --env-file=.env.local, or pass --ref <ref>.');
  process.exit(1);
}

// Session pooler (port 5432). Transaction mode (6543) cannot be used: pg_dump
// relies on prepared statements and a stable session.
const host = argOf('host') ?? 'aws-1-ap-southeast-1.pooler.supabase.com';
const port = argOf('port') ?? '5432';
const user = `postgres.${ref}`;

// Schemas worth capturing. `public` is the app; `auth` holds the user accounts
// (losing it orphans every row that references auth.users); `storage` holds the
// object manifest. Supabase-managed schemas (extensions, realtime, vault, ...)
// are recreated by a new project and are not dumpable by the postgres role.
const SCHEMAS = ['public', 'auth', 'storage'];

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outRoot = argOf('out') ?? join(homedir(), 'glowbal-backups');
const outDir = resolve(outRoot, `${ref}-${stamp}`);
// Created only after preflight succeeds, so failed attempts leave no empty dirs.

const PG_BIN_CANDIDATES = [
  'C:/Program Files/PostgreSQL/17/bin',
  'C:/Program Files/PostgreSQL/18/bin',
  '/usr/lib/postgresql/17/bin',
  '/usr/local/bin',
];
const isWin = process.platform === 'win32';
const pgBin =
  argOf('pgbin') ??
  PG_BIN_CANDIDATES.find((d) => existsSync(join(d, isWin ? 'pg_dump.exe' : 'pg_dump')));
if (!pgBin) {
  console.error('Could not find pg_dump. Pass --pgbin "<dir containing pg_dump>".');
  process.exit(1);
}
const exe = (name) => join(pgBin, isWin ? `${name}.exe` : name);

const env = { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '30', PGSSLMODE: 'require' };
const conn = ['-h', host, '-p', port, '-U', user, '-d', 'postgres'];

function run(bin, argv) {
  return new Promise((done) => {
    const started = Date.now();
    const out = [];
    const errs = [];
    const child = spawn(bin, argv, { env, windowsHide: true });
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => errs.push(d));
    child.on('error', (e) => done({ ok: false, code: -1, stdout: '', stderr: e.message, ms: 0 }));
    child.on('close', (code) =>
      done({
        ok: code === 0,
        code,
        stdout: Buffer.concat(out).toString(),
        stderr: Buffer.concat(errs).toString(),
        ms: Date.now() - started,
      }),
    );
  });
}

const log = (...a) => console.log(...a);
const results = [];

log('\nGlowBal Supabase backup');
log(`  project   ${ref}`);
log(`  endpoint  ${host}:${port} (session pooler)`);
log(`  pg_dump   ${pgBin}`);
log(`  output    ${outDir}\n`);

// ---------------------------------------------------------------- preflight
const version = await run(exe('psql'), [...conn, '-tAc', 'select version()']);
if (!version.ok) {
  console.error('Cannot connect to Postgres:\n' + version.stderr.trim());
  console.error('\nIf that says "password authentication failed", reset the database password.');
  console.error('If it says "tenant/user not found", the pooler region differs — pass --host.');
  process.exit(1);
}
log(`Connected: ${version.stdout.trim().split(',')[0]}\n`);
mkdirSync(outDir, { recursive: true });

// ------------------------------------------------------- inventory (before)
const schemaList = SCHEMAS.map((s) => `'${s}'`).join(',');
const inventorySql =
  `select coalesce(json_agg(row_to_json(t) order by t.schemaname, t.relname), '[]'::json)::text ` +
  `from (select schemaname, relname, n_live_tup from pg_stat_user_tables ` +
  `where schemaname in (${schemaList})) t`;
const inv = await run(exe('psql'), [...conn, '-tAc', inventorySql]);
let inventory = [];
try {
  inventory = JSON.parse(inv.stdout.trim() || '[]');
} catch {
  inventory = [];
}
log(`Inventory: ${inventory.length} tables with statistics across ${SCHEMAS.join(', ')}`);

// The storage object manifest. The bytes live behind the 402'd Storage API, but
// this records exactly which files exist, their size and their owner, so the
// gap is enumerable rather than silent.
const storageCsv = join(outDir, 'storage-objects.csv').replace(/\\/g, '/');
const storageQuery =
  `\\copy (select b.name as bucket, o.name as path, o.owner, o.created_at, o.updated_at, ` +
  `(o.metadata->>'size')::bigint as bytes, o.metadata->>'mimetype' as mimetype ` +
  `from storage.objects o join storage.buckets b on b.id = o.bucket_id ` +
  `order by b.name, o.name) to '${storageCsv}' with csv header`;
const storageRes = await run(exe('psql'), [...conn, '-c', storageQuery]);
results.push({
  step: 'storage-objects.csv',
  ok: storageRes.ok,
  ms: storageRes.ms,
  stderr: storageRes.stderr.trim(),
});
log(storageRes.ok ? '   ok  storage-objects.csv' : `   FAILED storage manifest: ${storageRes.stderr.trim()}`);

// ------------------------------------------------------------------- dumps
const schemaArgs = SCHEMAS.flatMap((s) => ['-n', s]);
const passes = [
  {
    label: 'full custom-format dump (primary restore artifact)',
    file: 'glowbal-full.dump',
    argv: ['-Fc', '--no-owner', '--no-privileges', '--quote-all-identifiers', ...schemaArgs],
  },
  {
    label: 'schema only (readable DDL, RLS policies, functions, triggers)',
    file: 'schema.sql',
    argv: ['-Fp', '--schema-only', '--no-owner', '--no-privileges', '--quote-all-identifiers', ...schemaArgs],
  },
  {
    // The audit counted 2,053 grants. --no-privileges drops every one of them,
    // so a restore from the portable dump alone would leave anon/authenticated
    // without access and the app failing in confusing ways. Supabase projects
    // all share the same role names, so GRANTs replay cleanly — keep a copy.
    label: 'schema with GRANTs preserved (role privileges)',
    file: 'schema-with-grants.sql',
    argv: ['-Fp', '--schema-only', '--no-owner', '--quote-all-identifiers', ...schemaArgs],
  },
  {
    label: 'data only, plain SQL (human-readable fallback)',
    file: 'data.sql',
    argv: ['-Fp', '--data-only', '--no-owner', '--no-privileges', '--quote-all-identifiers', ...schemaArgs],
  },
];

for (const pass of passes) {
  const target = join(outDir, pass.file);
  log(`\n-> ${pass.label}`);
  const r = await run(exe('pg_dump'), [...conn, ...pass.argv, '-f', target]);
  const bytes = existsSync(target) ? statSync(target).size : 0;
  results.push({ step: pass.file, ok: r.ok, bytes, ms: r.ms, stderr: r.stderr.trim() });
  if (r.ok) {
    log(`   ok  ${pass.file}  ${(bytes / 1024 / 1024).toFixed(2)} MB  ${(r.ms / 1000).toFixed(1)}s`);
  } else {
    log(`   FAILED (exit ${r.code})`);
    log('   ' + r.stderr.trim().split('\n').slice(0, 6).join('\n   '));
  }
}

// -------------------------------------------------------------- verification
// A dump that "succeeded" but silently skipped tables is the failure mode that
// matters. Count the tables that actually appear in the schema dump and compare
// against the live inventory.
const schemaFile = join(outDir, 'schema.sql');
const schemaText = existsSync(schemaFile) ? readFileSync(schemaFile, 'utf8') : '';
const dumpedTables = (schemaText.match(/^CREATE TABLE /gm) ?? []).length;
const dumpedPolicies = (schemaText.match(/^CREATE POLICY /gm) ?? []).length;
const dumpedFunctions = (schemaText.match(/^CREATE FUNCTION /gm) ?? []).length;

writeFileSync(
  join(outDir, 'manifest.json'),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      project_ref: ref,
      endpoint: `${host}:${port}`,
      server_version: version.stdout.trim(),
      schemas: SCHEMAS,
      live_table_statistics: inventory,
      dumped: { tables: dumpedTables, policies: dumpedPolicies, functions: dumpedFunctions },
      results,
      known_gap:
        'Storage file BYTES are not included: the Storage API returns HTTP 402 while the project is restricted. storage-objects.csv lists every file, its size and owner, so the missing set is enumerable. Restore service (upgrade, or clear the quota violation) to download the bytes.',
      restore_hint:
        'pg_restore --no-owner --no-privileges --clean --if-exists -d "<new-connection-string>" glowbal-full.dump',
    },
    null,
    2,
  ),
);

log(`\n${'-'.repeat(60)}`);
log(`Live tables with stats : ${inventory.length}`);
log(`CREATE TABLE in dump   : ${dumpedTables}`);
log(`CREATE POLICY in dump  : ${dumpedPolicies}`);
log(`CREATE FUNCTION in dump: ${dumpedFunctions}`);
log('');
for (const f of readdirSync(outDir)) {
  log(`  ${f.padEnd(26)} ${(statSync(join(outDir, f)).size / 1024).toFixed(0).padStart(9)} KB`);
}
log(`\nBackup directory: ${outDir}`);

const failed = results.filter((r) => r.ok === false);
if (failed.length) {
  log(`\n${failed.length} step(s) FAILED — see manifest.json. The backup is INCOMPLETE.`);
  process.exit(1);
}
log('\nAll steps completed. Storage file bytes are still missing (manifest.json -> known_gap).');
