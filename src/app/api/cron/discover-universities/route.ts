import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthorizedCron } from '@/lib/cron-auth';
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

type HipolabsUniversity = {
  name?: string;
  country?: string;
};

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

  // Existing names, lower-cased, for de-duplication.
  const { data: existingRows, error } = await admin.from('universities').select('name');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const existing = new Set((existingRows ?? []).map((r) => (r.name ?? '').trim().toLowerCase()));

  // Gather candidates across the configured countries, de-duplicating against
  // both the DB and within this run.
  const countries = configuredCountries();
  const candidates: { name: string; country: string }[] = [];
  const seenThisRun = new Set<string>();

  for (const country of countries) {
    if (candidates.length >= limit) break;
    const list = await fetchCountry(country);
    for (const u of list) {
      if (candidates.length >= limit) break;
      const name = (u.name ?? '').trim();
      const uCountry = (u.country ?? country).trim();
      if (name.length < 2) continue;
      const key = name.toLowerCase();
      if (existing.has(key) || seenThisRun.has(key)) continue;
      seenThisRun.add(key);
      candidates.push({ name, country: uCountry });
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      added: 0,
      message: 'No new universities found (or the source was unreachable).',
      countries,
    });
  }

  // Tagged insert; fall back to a bare insert if the `source` column isn't
  // present yet (supabase-university-source.sql not applied).
  let insert = await admin
    .from('universities')
    .insert(candidates.map((c) => ({ ...c, source: 'auto' })))
    .select('id');
  if (insert.error) {
    insert = await admin.from('universities').insert(candidates).select('id');
  }

  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }

  // New rows are in the table; drop the cached reads so they appear on the
  // next request rather than after the 12h TTL expires.
  revalidateUniversities();

  return NextResponse.json({
    ok: true,
    added: insert.data?.length ?? candidates.length,
    sample: candidates.slice(0, 10).map((c) => `${c.name} (${c.country})`),
    countries,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
