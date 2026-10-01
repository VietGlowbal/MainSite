#!/usr/bin/env node
/**
 * Read-only comparison of two Supabase Postgres databases — the old project and
 * the copy restored into a new project/org. Answers "did the copy get
 * everything?" with measured numbers instead of a dashboard glance.
 *
 * Compares: exact row counts (public, auth, storage), RLS policies, RLS-enabled
 * tables, functions, triggers, views, extensions, storage buckets, table GRANTs
 * for anon/authenticated/service_role, sequence positions, pg_cron jobs. Then
 * scans the NEW database for text still pointing at the OLD project ref
 * (absolute Storage URLs etc.), which a dump/restore carries over verbatim.
 *
 * Works while the old project is API-restricted (HTTP 402): it talks to Postgres
 * through the session pooler, not the API gateway.
 *
 *   OLD_DB_PASSWORD=... NEW_DB_PASSWORD=... \
 *     node --env-file=.env.local scripts/compare-supabase.mjs --new-ref <ref> [--new-host <pooler>]
 *
 * The old ref defaults to NEXT_PUBLIC_SUPABASE_URL, so run it BEFORE switching
 * .env.local over (or pass --old-ref). Pooler hosts are per-region: copy the new
 * one from Dashboard -> Connect -> Session pooler.
 *
 * Output: counts and object names only — no row contents, no PII.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
};

const DEFAULT_HOST = 'aws-1-ap-southeast-1.pooler.supabase.com';
const oldRef =
  argOf('old-ref') ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const newRef = argOf('new-ref');
const sides = {
  old: {
    ref: oldRef,
    host: argOf('old-host') ?? DEFAULT_HOST,
    password: argOf('old-password') ?? process.env.OLD_DB_PASSWORD,
  },
  new: {
    ref: newRef,
    host: argOf('new-host') ?? DEFAULT_HOST,
    password: argOf('new-password') ?? process.env.NEW_DB_PASSWORD,
  },
};

for (const [name, s] of Object.entries(sides)) {
  if (!s.ref) {
    console.error(`Missing --${name}-ref.`);
    process.exit(1);
  }
  if (!s.password) {
    console.error(`Missing password for ${name}: set ${name.toUpperCase()}_DB_PASSWORD (or --${name}-password).`);
    process.exit(1);
  }
}
if (oldRef === newRef) {
  console.error('Old and new refs are identical — .env.local may already point at the new project. Pass --old-ref.');
  process.exit(1);
}

const PG_BIN_CANDIDATES = [
  'C:/Program Files/PostgreSQL/18/bin',
  'C:/Program Files/PostgreSQL/17/bin',
  '/usr/lib/postgresql/17/bin',
  '/usr/local/bin',
];
const isWin = process.platform === 'win32';
const pgBin =
  argOf('pgbin') ?? PG_BIN_CANDIDATES.find((d) => existsSync(join(d, isWin ? 'psql.exe' : 'psql')));
if (!pgBin) {
  console.error('Could not find psql. Pass --pgbin "<dir containing psql>".');
  process.exit(1);
}
const psqlExe = join(pgBin, isWin ? 'psql.exe' : 'psql');

/** Run one statement returning a single text cell; resolves { ok, out, err }. */
function query(side, sql) {
  const s = sides[side];
  const env = { ...process.env, PGPASSWORD: s.password, PGCONNECT_TIMEOUT: '30', PGSSLMODE: 'require' };
  const argv = ['-h', s.host, '-p', '5432', '-U', `postgres.${s.ref}`, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tAc', sql];
  return new Promise((done) => {
    const out = [];
    const err = [];
    const child = spawn(psqlExe, argv, { env, windowsHide: true });
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', (e) => done({ ok: false, out: '', err: e.message }));
    child.on('close', (code) =>
      done({ ok: code === 0, out: Buffer.concat(out).toString().trim(), err: Buffer.concat(err).toString().trim() }),
    );
  });
}

async function json(side, sql, fallback) {
  const r = await query(side, sql);
  if (!r.ok) return { value: fallback, error: r.err.split('\n')[0] };
  try {
    return { value: JSON.parse(r.out || 'null') ?? fallback, error: null };
  } catch {
    return { value: fallback, error: `unparseable output: ${r.out.slice(0, 120)}` };
  }
}

// Exact counts per schema. n_live_tup is an estimate and is empty right after a
// restore (no ANALYZE yet), so count(*) is the only honest number. query_to_xml
// lets one statement count every table without creating a helper function.
const countsSql = (schema) => `
  select coalesce(json_object_agg(table_name, c), '{}'::json)::text from (
    select table_name,
      (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint as c
    from information_schema.tables
    where table_schema = '${schema}' and table_type = 'BASE TABLE'
  ) t`;

const objectsSql = `
  select json_build_object(
    'policies', (select coalesce(json_object_agg(k, n), '{}'::json) from (
        select schemaname || '.' || tablename as k, count(*) as n from pg_policies
        where schemaname in ('public', 'storage') group by 1) x),
    'rls_enabled', (select coalesce(json_agg(c.relname order by c.relname), '[]'::json)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity),
    'functions', (select coalesce(json_agg(sig order by sig), '[]'::json) from (
        select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public') f),
    'triggers', (select coalesce(json_agg(tg order by tg), '[]'::json) from (
        select n.nspname || '.' || c.relname || ':' || t.tgname as tg
        from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
        where not t.tgisinternal and n.nspname in ('public', 'auth', 'storage')) tr),
    'views', (select coalesce(json_agg(v order by v), '[]'::json) from (
        select viewname as v from pg_views where schemaname = 'public'
        union all select matviewname from pg_matviews where schemaname = 'public') vw),
    'extensions', (select coalesce(json_agg(extname order by extname), '[]'::json) from pg_extension),
    'buckets', (select coalesce(json_object_agg(id, json_build_object('public', public, 'file_size_limit', file_size_limit)), '{}'::json) from storage.buckets),
    'storage_bytes', (select coalesce(json_object_agg(bucket_id, b), '{}'::json) from (
        select bucket_id, sum((metadata->>'size')::bigint) as b from storage.objects group by 1) s),
    'grants', (select coalesce(json_object_agg(grantee, n), '{}'::json) from (
        select grantee, count(*) as n from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role') group by 1) g),
    'sequences', (select coalesce(json_object_agg(sequencename, last_value), '{}'::json)
        from pg_sequences where schemaname = 'public')
  )::text`;

const log = (...a) => console.log(...a);
const report = { generated_at: new Date().toISOString(), old: sides.old.ref, new: sides.new.ref, sections: {} };
let problems = 0;

log('\nSupabase copy comparison (read-only)');
log(`  old  ${sides.old.ref} @ ${sides.old.host}`);
log(`  new  ${sides.new.ref} @ ${sides.new.host}\n`);

for (const side of ['old', 'new']) {
  const v = await query(side, 'select current_setting($$server_version$$)');
  if (!v.ok) {
    console.error(`Cannot connect to ${side} (${sides[side].ref}): ${v.err.split('\n')[0]}`);
    console.error('  "password authentication failed" -> reset the DB password in that project.');
    console.error('  "tenant/user not found"          -> wrong pooler region; pass --' + side + '-host.');
    process.exit(1);
  }
  log(`  ${side} connected: Postgres ${v.out}`);
}

// ------------------------------------------------------------- row counts
for (const schema of ['public', 'auth', 'storage']) {
  const [o, n] = await Promise.all([json('old', countsSql(schema), {}), json('new', countsSql(schema), {})]);
  const rows = [];
  for (const t of [...new Set([...Object.keys(o.value), ...Object.keys(n.value)])].sort()) {
    const a = o.value[t];
    const b = n.value[t];
    if (a !== b) rows.push({ table: t, old: a ?? 'MISSING', new: b ?? 'MISSING' });
  }
  report.sections[`rows.${schema}`] = { old_error: o.error, new_error: n.error, mismatches: rows };
  const oldTotal = Object.values(o.value).reduce((s, x) => s + Number(x), 0);
  const newTotal = Object.values(n.value).reduce((s, x) => s + Number(x), 0);
  log(`\n[rows ${schema}] tables old=${Object.keys(o.value).length} new=${Object.keys(n.value).length}  rows old=${oldTotal} new=${newTotal}`);
  if (o.error || n.error) log(`   could not count: ${o.error ?? ''} ${n.error ?? ''}`.trimEnd());
  for (const r of rows) log(`   DIFF ${r.table.padEnd(44)} old=${String(r.old).padStart(8)}  new=${String(r.new).padStart(8)}`);
  if (!rows.length && !o.error && !n.error) log('   ok  every table matches');
  problems += rows.length + (o.error || n.error ? 1 : 0);
}

// --------------------------------------------------------------- objects
const [oo, no] = await Promise.all([json('old', objectsSql, {}), json('new', objectsSql, {})]);
if (oo.error || no.error) log(`\n[objects] query failed: ${oo.error ?? ''} ${no.error ?? ''}`);

function diffList(label, a = [], b = []) {
  const missing = a.filter((x) => !b.includes(x));
  const extra = b.filter((x) => !a.includes(x));
  report.sections[label] = { old: a.length, new: b.length, missing_in_new: missing, only_in_new: extra };
  log(`\n[${label}] old=${a.length} new=${b.length}`);
  for (const x of missing) log(`   MISSING in new: ${x}`);
  for (const x of extra) log(`   only in new:    ${x}`);
  if (!missing.length && !extra.length) log('   ok');
  problems += missing.length;
}

function diffMap(label, a = {}, b = {}) {
  const rows = [];
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) rows.push({ key: k, old: a[k] ?? null, new: b[k] ?? null });
  }
  report.sections[label] = { mismatches: rows };
  log(`\n[${label}] keys old=${Object.keys(a).length} new=${Object.keys(b).length}`);
  for (const r of rows) log(`   DIFF ${r.key.padEnd(44)} old=${JSON.stringify(r.old)}  new=${JSON.stringify(r.new)}`);
  if (!rows.length) log('   ok');
  problems += rows.length;
}

const O = oo.value;
const N = no.value;
diffMap('policies per table', O.policies, N.policies);
diffList('rls enabled (public)', O.rls_enabled, N.rls_enabled);
diffList('functions (public)', O.functions, N.functions);
diffList('triggers', O.triggers, N.triggers);
diffList('views (public)', O.views, N.views);
diffList('extensions', O.extensions, N.extensions);
diffMap('storage buckets', O.buckets, N.buckets);
diffMap('table grants (public)', O.grants, N.grants);
diffMap('sequence last_value (public)', O.sequences, N.sequences);

// storage.objects rows are only the manifest — the bytes live in the Storage
// service and are NOT carried by pg_dump. Report sizes so the gap is visible.
const gb = (x) => (Number(x ?? 0) / 1024 ** 3).toFixed(3);
const oldBytes = Object.values(O.storage_bytes ?? {}).reduce((s, x) => s + Number(x), 0);
const newBytes = Object.values(N.storage_bytes ?? {}).reduce((s, x) => s + Number(x), 0);
report.sections.storage_bytes = { old: O.storage_bytes, new: N.storage_bytes };
log(`\n[storage size per manifest] old=${gb(oldBytes)} GB  new=${gb(newBytes)} GB   (Free plan quota: 1 GB)`);
for (const [b, x] of Object.entries(O.storage_bytes ?? {})) log(`   ${b.padEnd(28)} old=${gb(x)} GB  new=${gb(N.storage_bytes?.[b])} GB`);

// ------------------------------------------------------------- pg_cron
const cronSql = `select case when to_regclass('cron.job') is null then 'null' else 'present' end`;
const cron = {};
for (const side of ['old', 'new']) {
  const present = (await query(side, cronSql)).out === 'present';
  cron[side] = present
    ? (await json(side, `select coalesce(json_agg(jobname || ' ' || schedule order by jobname), '[]'::json)::text from cron.job`, [])).value
    : [];
}
diffList('pg_cron jobs', cron.old, cron.new);

// -------------------------------------------- old ref still referenced in new
// A restore copies absolute URLs verbatim: rows in the new DB that still contain
// "<old-ref>.supabase.co" keep serving files from the old (restricted) project.
const colsSql = `
  select coalesce(json_object_agg(k, cols), '{}'::json)::text from (
    select table_schema || '.' || table_name as k, json_agg(column_name order by column_name) as cols
    from information_schema.columns c
    where ((table_schema = 'public') or (table_schema = 'auth' and table_name = 'users'))
      and data_type in ('text', 'character varying', 'json', 'jsonb', 'ARRAY')
      and exists (select 1 from information_schema.tables t
                  where t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE')
    group by 1) x`;
const cols = (await json('new', colsSql, {})).value;
const needle = `%${sides.old.ref}%`;
const refHits = [];
for (const [qualified, columns] of Object.entries(cols)) {
  const [schema, table] = qualified.split('.');
  const selects = columns
    .map((c) => `'${c.replace(/'/g, "''")}', count(*) filter (where "${c.replace(/"/g, '""')}"::text like '${needle}')`)
    .join(', ');
  const r = await json('new', `select json_build_object(${selects})::text from "${schema}"."${table}"`, {});
  for (const [col, n] of Object.entries(r.value)) if (Number(n) > 0) refHits.push({ column: `${qualified}.${col}`, rows: Number(n) });
}
report.sections.old_ref_in_new = refHits;
log(`\n[old ref "${sides.old.ref}" still present in new DB] ${refHits.length} column(s)`);
for (const h of refHits) log(`   ${h.column.padEnd(56)} ${String(h.rows).padStart(7)} rows`);
if (!refHits.length) log('   ok');
problems += refHits.length;

// ----------------------------------------------------------------- report
const outDir = resolve(argOf('out') ?? join(homedir(), 'glowbal-backups'));
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = join(outDir, `compare-${sides.old.ref}-to-${sides.new.ref}-${stamp}.json`);
writeFileSync(file, JSON.stringify(report, null, 2));

log(`\n${'-'.repeat(60)}`);
log(problems ? `${problems} difference(s) found.` : 'No differences found.');
log(`Report: ${file}`);
process.exit(problems ? 2 : 0);
