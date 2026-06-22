#!/usr/bin/env node
/**
 * Backfill university primary_domain values via Tavily.
 *
 * Run the SQL migration (supabase-university-domain.sql) first to add the
 * column and fill the well-known universities. This script then auto-discovers
 * domains for any universities still missing one, using the Tavily search API.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-university-domains.mjs            # apply
 *   node --env-file=.env.local scripts/backfill-university-domains.mjs --dry-run  # preview only
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TAVILY_API_KEY
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!TAVILY_API_KEY) {
  console.error('Missing TAVILY_API_KEY (needed to discover domains)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Domains that are never an official university site.
const BLOCKED = [
  'wikipedia.org', 'wikiwand.com', 'reddit.com', 'quora.com', 'youtube.com',
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
  'topuniversities.com', 'timeshighereducation.com', 'usnews.com',
  'studyportals.com', 'mastersportal.com', 'bachelorsportal.com',
  'findauniversity.com', 'whatuni.com', 'collegedunia.com', 'shiksha.com',
  'leverageedu.com', 'yocket.com', 'wikidata.org', 'britannica.com',
];

const ACADEMIC_TLD = /\.(edu|ac\.[a-z]{2}|edu\.[a-z]{2}|ac\.[a-z]{2}\.[a-z]{2})$/i;

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function nameTokens(name) {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !['university', 'college', 'institute', 'school', 'national'].includes(t));
}

async function discoverDomain(name) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query: `${name} official university website`,
      search_depth: 'basic',
      max_results: 8,
    }),
  });

  if (!res.ok) {
    console.warn(`  Tavily error ${res.status} for "${name}"`);
    return null;
  }

  const data = await res.json();
  const results = data.results || [];
  const tokens = nameTokens(name);

  const candidates = results
    .map((r) => hostnameOf(r.url))
    .filter(Boolean)
    .filter((h) => !BLOCKED.some((b) => h === b || h.endsWith(`.${b}`)));

  // 1) Prefer an academic TLD whose domain shares a name token.
  for (const h of candidates) {
    if (ACADEMIC_TLD.test(h) && tokens.some((t) => h.includes(t))) return h;
  }
  // 2) Any academic TLD.
  for (const h of candidates) {
    if (ACADEMIC_TLD.test(h)) return h;
  }
  // 3) Any domain sharing a name token.
  for (const h of candidates) {
    if (tokens.some((t) => h.includes(t))) return h;
  }
  return null;
}

async function main() {
  const { data: unis, error } = await supabase
    .from('universities')
    .select('id, name')
    .is('primary_domain', null)
    .order('qs_rank', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Failed to fetch universities:', error.message);
    process.exit(1);
  }

  console.log(`${unis.length} universities missing a domain.${DRY_RUN ? ' (dry-run)' : ''}\n`);

  let updated = 0;
  let skipped = 0;

  for (const uni of unis) {
    const domain = await discoverDomain(uni.name);
    if (!domain) {
      console.log(`  ?  ${uni.name} -> (no confident match)`);
      skipped++;
      continue;
    }

    console.log(`  ✓  ${uni.name} -> ${domain}`);
    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('universities')
        .update({ primary_domain: domain })
        .eq('id', uni.id);
      if (upErr) {
        console.warn(`     update failed: ${upErr.message}`);
        continue;
      }
    }
    updated++;

    // Be gentle on the Tavily API.
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nDone. ${updated} ${DRY_RUN ? 'would be updated' : 'updated'}, ${skipped} skipped (review manually).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
