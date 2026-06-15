// ============================================================================
// scripts/seed-scholarships.mjs
// ----------------------------------------------------------------------------
// Stage 2 of the scholarships ETL: load the cleaned JSON
// (data/scholarships.json, produced by clean-scholarships.mjs) into Supabase,
// resolving each scholarship's candidate school names to university IDs against
// the LIVE public.universities table.
//
// Usage:
//   1. .env.local must have NEXT_PUBLIC_SUPABASE_URL and
//      SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS).
//   2. Run:   node --env-file=.env.local scripts/seed-scholarships.mjs
//      Or:    npm run seed:scholarships
//
// Flags:
//   --cleanup, -c          delete all seeded rows (matched by source_key)
//   --dry-run              match + report, write nothing to the DB
//   --status=draft|published|archived   default 'draft' (ships dark)
//   --limit=N              only process the first N records
//
// Idempotency:
//   - scholarships upsert on the unique `source_key`.
//   - join rows: this script only ever deletes/writes rows with
//     confirmed=false, so a curator's manual confirmations survive re-seeds.
//
// Output:
//   - data/scholarships.unmatched.json — candidate school names that could not
//     be resolved to a university (the curation queue). Add aliases to
//     data/university-aliases.json and re-run to clear them.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data', 'scholarships.json');
const ALIASES = path.join(ROOT, 'data', 'university-aliases.json');
const UNMATCHED_OUT = path.join(ROOT, 'data', 'scholarships.unmatched.json');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      '  Run with: node --env-file=.env.local scripts/seed-scholarships.mjs',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Args ──
const args = process.argv.slice(2);
const CLEANUP = args.includes('--cleanup') || args.includes('-c');
const DRY = args.includes('--dry-run');
const STATUS = (args.find((a) => a.startsWith('--status=')) || '--status=draft').split('=')[1];
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;

if (!['draft', 'published', 'archived'].includes(STATUS)) {
  console.error(`✖ Invalid --status=${STATUS} (expected draft|published|archived)`);
  process.exit(1);
}

// ── Helpers (kept consistent with clean-scholarships.mjs) ────────────────────
function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
function normKey(s) {
  return stripDiacritics(String(s || '').toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
}

async function loadRecords() {
  const raw = await readFile(DATA, 'utf8').catch(() => {
    throw new Error(`Could not read ${path.relative(ROOT, DATA)} — run \`npm run clean:scholarships\` first.`);
  });
  const records = JSON.parse(raw);
  return Number.isFinite(LIMIT) ? records.slice(0, LIMIT) : records;
}

async function loadAliases() {
  try {
    const obj = JSON.parse(await readFile(ALIASES, 'utf8'));
    const map = new Map();
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue; // skip _comment etc.
      map.set(normKey(k), v);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function loadUniversities() {
  // Page through all universities once; build normalized lookup structures.
  const all = [];
  let from = 0;
  const PAGE = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('universities')
      .select('id, name, local_name')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Loading universities failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  const byNorm = new Map();
  for (const u of all) {
    byNorm.set(normKey(u.name), u);
    if (u.local_name) byNorm.set(normKey(u.local_name), u);
  }
  return { all, byNorm };
}

// Resolve a single candidate school name → { id, score, method } or null.
function resolveUniversity(candidate, { all, byNorm }, aliases) {
  const cand = normKey(candidate);
  if (!cand) return null;

  // 1. Exact normalized match.
  if (byNorm.has(cand)) return { id: byNorm.get(cand).id, score: 100, method: 'exact' };

  // 2. Alias map → canonical name → exact.
  if (aliases.has(cand)) {
    const canonical = normKey(aliases.get(cand));
    if (byNorm.has(canonical)) return { id: byNorm.get(canonical).id, score: 95, method: 'alias' };
  }

  // 3. Substring / ilike: best containment match, scored by length ratio.
  let best = null;
  for (const u of all) {
    const un = normKey(u.name);
    if (!un) continue;
    let score = 0;
    if (un === cand) score = 100;
    else if (un.includes(cand) || cand.includes(un)) {
      const shorter = Math.min(un.length, cand.length);
      const longer = Math.max(un.length, cand.length);
      score = Math.round((shorter / longer) * 90);
    }
    if (score > (best?.score ?? 0)) best = { id: u.id, score, method: 'ilike' };
  }
  if (best && best.score >= 55) return best;
  return null;
}

// ── Upsert one scholarship + its join rows ───────────────────────────────────
async function upsertScholarship(rec, lookups, aliases, unmatched) {
  const { applies_to_candidates = [], ...row } = rec;

  // Resolve candidate universities (only meaningful for scope='university').
  const matches = [];
  for (const cand of applies_to_candidates) {
    const m = resolveUniversity(cand, lookups, aliases);
    if (m) matches.push({ university_id: m.id, match_score: m.score, match_method: m.method });
    else unmatched.push({ scholarship: rec.name, source_key: rec.source_key, candidate: cand });
  }

  if (DRY) return { matched: matches.length, unmatched: applies_to_candidates.length - matches.length };

  // 1. Upsert the scholarship by source_key.
  const { data, error } = await supabase
    .from('scholarships')
    .upsert({ ...row, status: STATUS }, { onConflict: 'source_key' })
    .select('id')
    .single();
  if (error) throw new Error(`${rec.name}: ${error.message}`);
  const scholarshipId = data.id;

  // 2. Replace ONLY the ETL-owned (unconfirmed) join rows; keep confirmed ones.
  const { error: delErr } = await supabase
    .from('scholarship_universities')
    .delete()
    .eq('scholarship_id', scholarshipId)
    .eq('confirmed', false);
  if (delErr) throw new Error(`${rec.name} (join cleanup): ${delErr.message}`);

  if (matches.length) {
    const { error: joinErr } = await supabase
      .from('scholarship_universities')
      .upsert(
        matches.map((m) => ({ scholarship_id: scholarshipId, ...m })),
        { onConflict: 'scholarship_id,university_id', ignoreDuplicates: true },
      );
    if (joinErr) console.warn(`  ⚠ ${rec.name}: join upsert — ${joinErr.message}`);
  }

  return { matched: matches.length, unmatched: applies_to_candidates.length - matches.length };
}

async function cleanup() {
  const records = await loadRecords();
  const keys = records.map((r) => r.source_key).filter(Boolean);
  console.log(`Cleaning up ${keys.length} seeded scholarships…`);
  // Delete in chunks; FK cascade removes join rows.
  for (let i = 0; i < keys.length; i += 200) {
    const chunk = keys.slice(i, i + 200);
    const { error } = await supabase.from('scholarships').delete().in('source_key', chunk);
    if (error) console.warn(`  ⚠ ${error.message}`);
  }
  console.log('Done.');
}

async function seed() {
  const [records, aliases, lookups] = await Promise.all([
    loadRecords(),
    loadAliases(),
    loadUniversities(),
  ]);

  console.log(
    `${DRY ? '[dry-run] ' : ''}Loading ${records.length} scholarships (status=${STATUS}); ` +
      `${lookups.all.length} universities in DB, ${aliases.size} aliases.`,
  );

  const unmatched = [];
  let ok = 0;
  let totalMatched = 0;
  for (const rec of records) {
    try {
      const { matched } = await upsertScholarship(rec, lookups, aliases, unmatched);
      totalMatched += matched;
      ok += 1;
    } catch (err) {
      console.error(`  ✖ ${err.message}`);
    }
  }

  await writeFile(UNMATCHED_OUT, `${JSON.stringify(unmatched, null, 2)}\n`, 'utf8');

  console.log(`\nDone. ${ok}/${records.length} scholarships ${DRY ? 'previewed' : 'loaded'}.`);
  console.log(`  university links matched:   ${totalMatched}`);
  console.log(`  unmatched school names:     ${unmatched.length} → ${path.relative(ROOT, UNMATCHED_OUT)}`);
  if (unmatched.length) {
    console.log('  (add aliases to data/university-aliases.json and re-run to resolve them)');
  }
  if (STATUS === 'draft' && !DRY) {
    console.log("\n  Rows loaded as 'draft' (hidden by RLS). Publish when reviewed:");
    console.log('    npm run seed:scholarships:publish');
  }
}

(CLEANUP ? cleanup() : seed()).catch((err) => {
  console.error(err);
  process.exit(1);
});
