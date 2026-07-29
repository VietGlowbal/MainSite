import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { resolveUniversity, type ResolveOutcome } from '@/features/universities/api';

/**
 * GET/POST /api/cron/link-applications
 *
 * Backfill `course_applications.university_id` for rows that never had one.
 *
 * WHY A BACKFILL AND NOT JUST A RE-PARSE. Resolution now runs inside the parse
 * worker, so every application imported from here on gets an id. That does
 * nothing for the ones already in the database, and re-parsing them to fix it
 * would mean re-fetching every course page and paying for a model call each —
 * to recover a name those rows already store. This reads `university_name` and
 * `course_url` straight off the row instead, so the common case costs one
 * lookup and no AI at all.
 *
 * SAFETY:
 *   • Only ever fills a NULL. An id the student chose in the course-search
 *     modal is never overwritten.
 *   • Capped per run (`?limit=`, default 50, max 200).
 *   • `?dryRun=1` reports what it would do and writes nothing — worth running
 *     first on a directory that has not had supabase-university-domain.sql
 *     applied, since domain matching is the accurate half of the matcher.
 *   • Creates rows for universities that are genuinely absent, tagged
 *     `source='auto_course_parse'` for the review queue. Pass `?create=0` to
 *     match-only and leave the rest for a human.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`, or the service-role key for a
 * manual run. See src/lib/cron-auth.ts.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type Row = {
  id: string;
  university_name: string | null;
  course_url: string | null;
  country: string | null;
};

/** Never resolve this — it is the insert's fallback, not a name. */
const PLACEHOLDER = /^unknown university$/i;

function intParam(request: NextRequest, key: string, fallback: number, max: number): number {
  const raw = request.nextUrl.searchParams.get(key);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = intParam(request, 'limit', DEFAULT_LIMIT, MAX_LIMIT);
  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const allowCreate = request.nextUrl.searchParams.get('create') !== '0';

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('course_applications')
    .select('id, university_name, course_url, country')
    .is('university_id', null)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[link-applications] query failed:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];
  const tally = { matched: 0, created: 0, skipped: 0, failed: 0 };
  const details: Array<{ id: string; name: string | null; outcome: string }> = [];

  for (const row of rows) {
    const name = row.university_name?.trim();
    if (!name || PLACEHOLDER.test(name)) {
      tally.skipped += 1;
      details.push({ id: row.id, name: row.university_name, outcome: 'skipped:placeholder' });
      continue;
    }

    let outcome: ResolveOutcome;
    try {
      outcome = await resolveUniversity({
        name,
        courseUrl: row.course_url,
        country: row.country,
      });
    } catch (err) {
      console.error('[link-applications] resolve threw:', err);
      tally.failed += 1;
      details.push({ id: row.id, name, outcome: 'error' });
      continue;
    }

    if (outcome.status === 'skipped') {
      tally.skipped += 1;
      details.push({ id: row.id, name, outcome: `skipped:${outcome.reason}` });
      continue;
    }

    if (outcome.status === 'created' && !allowCreate) {
      tally.skipped += 1;
      details.push({ id: row.id, name, outcome: 'skipped:create-disabled' });
      continue;
    }

    const label =
      outcome.status === 'matched'
        ? `matched:${outcome.match.reason}`
        : `created:${outcome.universityId}`;

    if (!dryRun) {
      const { error: updateError } = await supabase
        .from('course_applications')
        .update({ university_id: outcome.universityId, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        // Re-assert the NULL: another parse may have linked this row since the
        // select above, and it would have had better evidence than we do.
        .is('university_id', null);

      if (updateError) {
        console.error('[link-applications] update failed:', updateError);
        tally.failed += 1;
        details.push({ id: row.id, name, outcome: 'update-failed' });
        continue;
      }
    }

    if (outcome.status === 'matched') tally.matched += 1;
    else tally.created += 1;
    details.push({ id: row.id, name, outcome: label });
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    considered: rows.length,
    ...tally,
    details,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
