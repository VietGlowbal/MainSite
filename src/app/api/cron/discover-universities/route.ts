import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthorizedCron } from '@/lib/cron-auth';
import {
  buildHipolabsCandidate,
  type HipolabsCandidate,
  type HipolabsUniversity,
} from '@/lib/university-discovery/hipolabs';
import { revalidateUniversities } from '@/server/cache';

/**
 * GET/POST /api/cron/discover-universities
 *
 * Scheduled job that finds universities we don't have yet and adds them to the
 * list, tagged `source = 'auto'` so the team can review/enrich them. The image
 * cron (/api/cron/university-images) then fills in their imagery.
 *
 * Data source: the free Hipolabs universities dataset
 * (https://universities.hipolabs.com/search?country=<Country>). It's a plain,
 * no-key list of institution names + countries + domains — great for "what
 * exists" coverage, but it carries no rankings, tuition, or editorial data, so
 * discovered rows are intentionally sparse until enriched.
 *
 * SAFETY — this is deliberately conservative:
 *   • Disabled unless `ENABLE_UNIVERSITY_DISCOVERY=true`. Scheduling it is inert
 *     until you flip that flag, so it can never silently dilute the curated list.
 *   • Only inserts names that don't already exist (case-insensitive).
 *   • Capped per run (`?limit=`, default 25).
 *   • Restricted to a configured set of countries
 *     (`UNIVERSITY_DISCOVERY_COUNTRIES`, comma-separated) so growth is targeted.
 *   • Rows are tagged `source='auto'` for an easy review queue
 *     (see supabase-university-source.sql).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; manual runs can
 * use the Supabase service-role key. See src/lib/cron-auth.ts.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const EXISTING_PAGE_SIZE = 1_000;
const MAX_EXISTING_ROWS = 50_000;

// Sensible default focus list — GlowBal's core study destinations. Override via
// the UNIVERSITY_DISCOVERY_COUNTRIES env var (comma-separated country names as
// the Hipolabs dataset spells them).
const DEFAULT_COUNTRIES = [
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'Singapore',
  'Vietnam',
];

const HIPOLABS = 'https://universities.hipolabs.com/search';

function configuredCountries(): string[] {
  const raw = process.env.UNIVERSITY_DISCOVERY_COUNTRIES;
  if (!raw) return DEFAULT_COUNTRIES;
  const list = raw.split(',').map((c) => c.trim()).filter(Boolean);
  return list.length > 0 ? list : DEFAULT_COUNTRIES;
}

async function fetchCountry(country: string): Promise<HipolabsUniversity[]> {
  try {
    const res = await fetch(`${HIPOLABS}?country=${encodeURIComponent(country)}`, {
      headers: { 'User-Agent': 'glowbal-edu-platform/1.0 (university discovery)' },
      // No caching — we want fresh additions each run.
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as HipolabsUniversity[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (process.env.ENABLE_UNIVERSITY_DISCOVERY !== 'true') {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'Discovery is disabled. Set ENABLE_UNIVERSITY_DISCOVERY=true to enable.',
    });
  }

  const url = new URL(request.url);
  const parsedLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const admin = createAdminClient();

  // Supabase projects commonly cap one response at 1,000 rows. Page through
  // the review table so growth beyond 1,000 institutions does not reinsert
  // a university whose identity happened to fall outside the first page.
  const existingRows: { name: string | null; primary_domain: string | null }[] = [];
  for (let offset = 0; offset < MAX_EXISTING_ROWS; offset += EXISTING_PAGE_SIZE) {
    const { data, error } = await admin
      .from('universities')
      .select('name, primary_domain')
      .order('id', { ascending: true })
      .range(offset, offset + EXISTING_PAGE_SIZE - 1);
    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          migration_required: 'supabase-hipolabs-crawl-seeds.sql',
        },
        { status: 500 },
      );
    }
    const page = data ?? [];
    existingRows.push(...page);
    if (page.length < EXISTING_PAGE_SIZE) break;
    if (existingRows.length >= MAX_EXISTING_ROWS) {
      return NextResponse.json(
        {
          error: `University identity scan exceeded the ${MAX_EXISTING_ROWS}-row safety limit.`,
        },
        { status: 500 },
      );
    }
  }
  const existing = new Set(existingRows.map((r) => (r.name ?? '').trim().toLowerCase()));
  const existingDomains = new Set(
    existingRows
      .map((r) => (r.primary_domain ?? '').trim().toLowerCase())
      .filter(Boolean),
  );

  // Gather candidates across the configured countries, de-duplicating against
  // both the DB and within this run.
  const countries = configuredCountries();
  const candidates: HipolabsCandidate[] = [];
  const seenThisRun = new Set<string>();
  const seenDomains = new Set<string>();
  let rejectedWithoutDomain = 0;
  const discoveredAt = new Date().toISOString();

  for (const country of countries) {
    if (candidates.length >= limit) break;
    const list = await fetchCountry(country);
    for (const u of list) {
      if (candidates.length >= limit) break;
      const candidate = buildHipolabsCandidate(u, country, discoveredAt);
      if (!candidate) {
        rejectedWithoutDomain += 1;
        continue;
      }
      const key = candidate.name.toLowerCase();
      if (
        existing.has(key) ||
        seenThisRun.has(key) ||
        existingDomains.has(candidate.primary_domain) ||
        seenDomains.has(candidate.primary_domain)
      ) {
        continue;
      }
      seenThisRun.add(key);
      seenDomains.add(candidate.primary_domain);
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      added: 0,
      message: 'No new universities found (or the source was unreachable).',
      countries,
      rejected_without_valid_domain: rejectedWithoutDomain,
    });
  }

  const insert = await admin
    .from('universities')
    .insert(candidates)
    .select('id');

  if (insert.error) {
    return NextResponse.json(
      {
        error: insert.error.message,
        migration_required: 'supabase-hipolabs-crawl-seeds.sql',
      },
      { status: 500 },
    );
  }

  // New rows are in the table; drop the cached reads so they appear on the
  // next request rather than after the 12h TTL expires.
  revalidateUniversities();

  return NextResponse.json({
    ok: true,
    added: insert.data?.length ?? candidates.length,
    review_status: 'pending',
    crawl_seed_enabled: false,
    rejected_without_valid_domain: rejectedWithoutDomain,
    sample: candidates.slice(0, 10).map((candidate) => ({
      name: candidate.name,
      country: candidate.country,
      country_code: candidate.country_code,
      primary_domain: candidate.primary_domain,
      official_url: candidate.official_url,
    })),
    countries,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
