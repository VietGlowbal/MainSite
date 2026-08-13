// ============================================================================
// scripts/seed-university-images.mjs
// ----------------------------------------------------------------------------
// Resolve campus + logo URLs for every university in the database and write
// the results back to `public.universities.image_url` / `logo_url`. Replaces
// the runtime call to /api/university-images, so the search page renders
// instantly with real images and never has Wikipedia rate-limiting issues.
//
// Usage:
//   node --env-file=.env.local scripts/seed-university-images.mjs
//   npm run seed:university-images
//
// Flags:
//   --force       re-resolve every row, ignoring images_resolved_at
//   --missing     only resolve rows whose image_url IS NULL (default behaviour)
//   --limit=N     cap the run at N rows (handy for spot checks)
//   --dry-run     show what would change without writing
//
// What it does:
//   1. Queries Wikipedia / Wikidata / Commons for a campus image and a logo,
//      using the existing curated city map in src/lib/wiki-images.ts.
//   2. Tracks which campus URLs have already been used. If two universities
//      resolve to the same URL (e.g. multiple London schools both pulling
//      the same skyline photo), the second one falls back to a different
//      strategy:
//        a. The university's own Wikipedia article lead image (the campus
//           shot) — usually distinct.
//        b. An Unsplash-source URL for the city / country, which returns
//           a deterministic CDN image without an API key.
//   3. Writes both URLs and a timestamp back to the row.
// ============================================================================

import { createClient } from '@supabase/supabase-js';

// We can't `import` the TS file directly from a .mjs script without a build
// step, so we mirror the shape of resolveUniversityImagery here using the
// shared CommonJS-ish API endpoints. Keeping the resolver logic inline is
// less DRY but means this script has zero build dependencies.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      '  Run with: node --env-file=.env.local scripts/seed-university-images.mjs',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
  const a = args.find((x) => x.startsWith('--limit='));
  if (!a) return null;
  const n = parseInt(a.split('=')[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
})();

// ─────────────────────────────────────────────────────────────────────────
// Hint maps — mirror src/lib/wiki-images.ts. Kept inline so the script is
// self-contained.
// ─────────────────────────────────────────────────────────────────────────

const ALIASES = {
  MIT: 'Massachusetts Institute of Technology',
  Caltech: 'California Institute of Technology',
  UCLA: 'University of California, Los Angeles',
  UCL: 'University College London',
  LSE: 'London School of Economics',
  NUS: 'National University of Singapore',
  NTU: 'Nanyang Technological University',
};

const CITY_HINTS = {
  'Massachusetts Institute of Technology': 'Cambridge, Massachusetts',
  'Harvard University': 'Cambridge, Massachusetts',
  'Harvard Business School': 'Boston',
  'Stanford University': 'Stanford, California',
  'Princeton University': 'Princeton, New Jersey',
  'Yale University': 'New Haven, Connecticut',
  'Columbia University': 'New York City',
  'Cornell University': 'Ithaca, New York',
  'Brown University': 'Providence, Rhode Island',
  'University of Pennsylvania': 'Philadelphia',
  'Johns Hopkins University': 'Baltimore',
  'University of Chicago': 'Chicago',
  'Northwestern University': 'Evanston, Illinois',
  'New York University': 'New York City',
  'California Institute of Technology': 'Pasadena, California',
  'University of California, Berkeley': 'Berkeley, California',
  'University of California, Los Angeles': 'Los Angeles',
  'University of California, San Diego': 'San Diego',
  'University of Michigan': 'Ann Arbor, Michigan',
  'University of Washington': 'Seattle',
  'Carnegie Mellon University': 'Pittsburgh',
  'Duke University': 'Durham, North Carolina',
  'Georgia Institute of Technology': 'Atlanta',
  'University of Oxford': 'Oxford',
  'University of Cambridge': 'Cambridge',
  'Imperial College London': 'London',
  'University College London': 'London',
  'London School of Economics': 'London',
  "King's College London": 'London',
  'University of Edinburgh': 'Edinburgh',
  'University of Manchester': 'Manchester',
  'University of Warwick': 'Coventry',
  'University of Leeds': 'Leeds',
  'University of Birmingham': 'Birmingham',
  'University of Bath': 'Bath, Somerset',
  'University of Bristol': 'Bristol',
  'University of Glasgow': 'Glasgow',
  'University of St Andrews': 'St Andrews',
  'University of Toronto': 'Toronto',
  'McGill University': 'Montreal',
  'University of British Columbia': 'Vancouver',
  'University of Melbourne': 'Melbourne',
  'University of Sydney': 'Sydney',
  'Australian National University': 'Canberra',
  'University of New South Wales': 'Sydney',
  'University of Queensland': 'Brisbane',
  'Monash University': 'Melbourne',
  'University of Auckland': 'Auckland',
  'National University of Singapore': 'Singapore',
  'Nanyang Technological University': 'Singapore',
  'University of Tokyo': 'Tokyo',
  'Kyoto University': 'Kyoto',
  'Tsinghua University': 'Beijing',
  'Peking University': 'Beijing',
  'University of Hong Kong': 'Hong Kong',
  'Hong Kong University of Science and Technology': 'Hong Kong',
  'Chinese University of Hong Kong': 'Hong Kong',
  'Seoul National University': 'Seoul',
  'ETH Zurich': 'Zurich',
  EPFL: 'Lausanne',
  'Delft University of Technology': 'Delft',
  'University of Amsterdam': 'Amsterdam',
  'Technical University of Munich': 'Munich',
  'Ludwig Maximilian University of Munich': 'Munich',
  'Heidelberg University': 'Heidelberg',
  'KU Leuven': 'Leuven',
  'Sciences Po': 'Paris',
  'Sorbonne University': 'Paris',
  'PSL University': 'Paris',
  'Trinity College Dublin': 'Dublin',
  'Bocconi University': 'Milan',
  'Polytechnic University of Milan': 'Milan',
};

const DOMAIN_HINTS = {
  'Massachusetts Institute of Technology': 'mit.edu',
  'Stanford University': 'stanford.edu',
  'Harvard University': 'harvard.edu',
  'Harvard Business School': 'hbs.edu',
  'University of Oxford': 'ox.ac.uk',
  'University of Cambridge': 'cam.ac.uk',
  'Imperial College London': 'imperial.ac.uk',
  'University College London': 'ucl.ac.uk',
  'University of Edinburgh': 'ed.ac.uk',
  'University of Toronto': 'utoronto.ca',
  'McGill University': 'mcgill.ca',
  'University of Melbourne': 'unimelb.edu.au',
  'University of Sydney': 'sydney.edu.au',
  'National University of Singapore': 'nus.edu.sg',
  'Nanyang Technological University': 'ntu.edu.sg',
  'ETH Zurich': 'ethz.ch',
  EPFL: 'epfl.ch',
  'Princeton University': 'princeton.edu',
  'Yale University': 'yale.edu',
  'Columbia University': 'columbia.edu',
  'Cornell University': 'cornell.edu',
};

// ─────────────────────────────────────────────────────────────────────────
// Wikipedia / Commons fetchers — minimal subset of src/lib/wiki-images.ts.
// ─────────────────────────────────────────────────────────────────────────

const UA = { 'Api-User-Agent': 'glowbal-edu-platform/1.0 (image seed script)' };
const REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const WIKI = 'https://en.wikipedia.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const DATA = 'https://www.wikidata.org/w/api.php';

function nameWithoutParens(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
}
function lookupHint(map, name) {
  return (
    map[name] ??
    map[nameWithoutParens(name)] ??
    map[ALIASES[name] ?? ''] ??
    map[ALIASES[nameWithoutParens(name)] ?? '']
  );
}

async function safeJson(url) {
  try {
    const r = await fetch(url, { headers: UA });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchSummary(title) {
  const data = await safeJson(REST + encodeURIComponent(title));
  if (!data) return null;
  return {
    original: data?.originalimage?.source,
    thumb: data?.thumbnail?.source,
  };
}

async function fetchPageInfo(title) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: title,
    prop: 'pageimages|pageprops',
    piprop: 'original|thumbnail',
    pithumbsize: '1200',
    redirects: '1',
    origin: '*',
  });
  const data = await safeJson(`${WIKI}?${params}`);
  if (!data) return null;
  const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
  if (!page) return null;
  return {
    original: page?.original?.source ?? page?.thumbnail?.source ?? null,
    wikidataId: page?.pageprops?.wikibase_item ?? null,
  };
}

async function fetchClaims(qid) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    ids: qid,
    props: 'claims',
    origin: '*',
  });
  const data = await safeJson(`${DATA}?${params}`);
  return data?.entities?.[qid]?.claims ?? null;
}

async function fetchSitelink(qid) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    ids: qid,
    props: 'sitelinks',
    sitefilter: 'enwiki',
    origin: '*',
  });
  const data = await safeJson(`${DATA}?${params}`);
  return data?.entities?.[qid]?.sitelinks?.enwiki?.title ?? null;
}

function readImageClaim(claims, prop) {
  const v = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
  return typeof v === 'string' ? v : null;
}
function readEntityClaim(claims, prop) {
  const v = claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
  if (v && typeof v === 'object' && 'id' in v) return v.id;
  return null;
}

async function commonsThumb(file, width = 1200) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: `File:${file}`,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: String(width),
    origin: '*',
    redirects: '1',
  });
  const data = await safeJson(`${COMMONS}?${params}`);
  const page = data?.query?.pages ? Object.values(data.query.pages)[0] : null;
  const info = page?.imageinfo?.[0];
  return info?.thumburl ?? info?.url ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// Resolution — campus + logo for one university.
// ─────────────────────────────────────────────────────────────────────────

async function resolveLogo(name, claims) {
  if (claims) {
    for (const prop of ['P154', 'P158', 'P8972']) {
      const file = readImageClaim(claims, prop);
      if (file) {
        const url = await commonsThumb(file, 320);
        if (url) return url;
      }
    }
  }
  const domain = lookupHint(DOMAIN_HINTS, name);
  if (domain) return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`;
  return null;
}

async function resolveCampus(name, claims) {
  // 1. Curated city map → city's Wikipedia summary
  const city = lookupHint(CITY_HINTS, name);
  if (city) {
    const s = await fetchSummary(city);
    if (s?.original ?? s?.thumb) return s.original ?? s.thumb;
  }
  // 2. Wikidata pointers (located in / HQ / location)
  if (claims) {
    for (const prop of ['P131', 'P159', 'P276']) {
      const qid = readEntityClaim(claims, prop);
      if (!qid) continue;
      const sitelink = await fetchSitelink(qid);
      if (!sitelink) continue;
      const s = await fetchSummary(sitelink);
      const img = s?.original ?? s?.thumb;
      if (img) return img;
    }
  }
  return null;
}

async function resolveOne(name) {
  const cleanName = nameWithoutParens(name);
  const title = (ALIASES[name] ?? ALIASES[cleanName] ?? cleanName).replace(/\s+/g, '_');
  const info = await fetchPageInfo(title);
  const claims = info?.wikidataId ? await fetchClaims(info.wikidataId) : null;
  const [logo, campus] = await Promise.all([
    resolveLogo(name, claims),
    resolveCampus(name, claims),
  ]);
  // Last-resort campus: the article's own lead image.
  return {
    campus: campus ?? info?.original ?? null,
    logo,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Duplicate-image fallback. When two universities resolve to the same URL
// (e.g. UCL + Imperial both pulling the same London skyline), give the
// second one a different photo via Unsplash Source — a no-key CDN that
// returns a deterministic image keyed by query.
// ─────────────────────────────────────────────────────────────────────────

function unsplashFallback(uni) {
  const slug = encodeURIComponent(`${uni.name} campus`);
  // Source.unsplash.com returns a 1200px image keyed deterministically by
  // the query string and a seed (we use the university id so identically-
  // named institutions never collide).
  return `https://source.unsplash.com/1200x800/?${slug}&sig=${uni.id}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Main loop
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const query = supabase
    .from('universities')
    .select('id, name, country, image_url, logo_url, images_resolved_at')
    .order('qs_rank', { ascending: true, nullsFirst: false });
  if (LIMIT) query.limit(LIMIT);

  const { data: rows, error } = await query;
  if (error) {
    console.error('✖ Failed to load universities:', error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log('No universities found.');
    return;
  }

  // Track which campus URLs we've already used, so we can de-duplicate.
  const seen = new Set();

  console.log(`Resolving images for ${rows.length} universities${DRY_RUN ? ' (dry run)' : ''}…`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!FORCE && row.image_url && row.logo_url) {
      // Already populated; remember the URL so subsequent rows know it's
      // taken (preserves de-duplication across re-runs).
      seen.add(row.image_url);
      skipped += 1;
      continue;
    }

    let resolved;
    try {
      resolved = await resolveOne(row.name);
    } catch (err) {
      failed += 1;
      console.warn(`  ⚠ ${row.name}: ${err.message}`);
      continue;
    }

    let { campus, logo } = resolved;

    // De-duplicate. If another university already claimed this campus URL,
    // fall back to Unsplash so each card gets a distinct photo.
    if (campus && seen.has(campus)) {
      campus = unsplashFallback(row);
    }
    if (!campus) {
      campus = unsplashFallback(row);
    }
    if (campus) seen.add(campus);

    if (DRY_RUN) {
      console.log(
        `  ✓ ${row.name.padEnd(48)} campus=${truncate(campus)}  logo=${truncate(logo)}`,
      );
      updated += 1;
      continue;
    }

    const { error: upErr } = await supabase
      .from('universities')
      .update({
        image_url: campus,
        logo_url: logo,
        images_resolved_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (upErr) {
      failed += 1;
      console.warn(`  ⚠ ${row.name}: ${upErr.message}`);
    } else {
      updated += 1;
      console.log(`  ✓ ${row.name}`);
    }
  }

  console.log(`\nDone. ${updated} updated, ${skipped} already had imagery, ${failed} failed.`);
}

function truncate(s) {
  if (!s) return '—';
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
