import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUniversityImagery } from '@/lib/wiki-images';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { revalidateUniversities } from '@/server/cache';
import { persistUniversityLogo } from '@/server/university-images/logo-storage';

/**
 * GET/POST /api/cron/university-images
 *
 * Scheduled job that fills in missing university imagery. Most rows ship with
 * empty `image_url` / `logo_url`; this resolves campus + logo URLs from
 * Wikipedia / Wikidata / Commons (via resolveUniversityImagery), persists logos
 * in Supabase Storage, and writes the durable URLs back to the directory.
 *
 * Designed to be safe to run on a schedule:
 *   • Only touches rows that are still missing an image or logo (idempotent).
 *   • A shared deadline aborts imagery resolution and stops new row work with
 *     time left for in-flight writes to settle before maxDuration.
 *   • Logo work is bounded to four concurrent rows and six seconds per host.
 *   • Never blanks an existing value — it only fills the gaps.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Manual runs can
 * use the Supabase service-role key. See src/lib/cron-auth.ts.
 *
 * Wire it up in vercel.json (already added):
 *   { "path": "/api/cron/university-images", "schedule": "0 3 * * *" }
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const CRON_WORK_BUDGET_MS = 50_000;
const FINISH_IN_FLIGHT_BUFFER_MS = 5_000;
const RESOLUTION_BUDGET_MS = 20_000;
const ROW_CONCURRENCY = 4;
const LOGO_REQUEST_TIMEOUT_MS = 6_000;

/**
 * Derive the Wikipedia article title we look imagery up by — identical to the
 * client logic in the explorer: strip a trailing parenthetical acronym
 * ("(NUS)") then turn spaces into underscores.
 */
function wikiTitleFor(name: string): string {
  const clean = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return clean.replace(/\s+/g, '_');
}

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const deadlineMs = startedAt + CRON_WORK_BUDGET_MS;
  const stopStartingAt = deadlineMs - FINISH_IN_FLIGHT_BUFFER_MS;

  const url = new URL(request.url);
  const parsedLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const admin = createAdminClient();

  // Rows still missing a campus image or a logo. Highest-ranked first so the
  // most-viewed universities get pictures soonest.
  const { data: rows, error } = await admin
    .from('universities')
    .select('id, name, image_url, logo_url')
    .or('image_url.is.null,logo_url.is.null')
    // Rotate unsuccessful rows behind universities that have never been
    // attempted, then retry the oldest misses first. This prevents one bad
    // logo host from permanently starving lower-ranked universities.
    .order('images_resolved_at', { ascending: true, nullsFirst: true })
    .order('qs_rank', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({
      ok: true,
      scanned: 0,
      processed: 0,
      updated: 0,
      stillMissing: 0,
      deferred: 0,
      durationMs: Date.now() - startedAt,
      message: 'Nothing to resolve.',
    });
  }
  const universityRows = rows;

  // [wikiTitle, displayName] pairs for the resolver.
  const entries = universityRows.map(
    (row) => [wikiTitleFor(row.name), row.name] as [string, string],
  );
  // Resolution has its own cap inside the shared route budget so a slow wiki
  // batch cannot consume all of the time needed to persist successful logos.
  const imageryTimeoutMs = Math.max(
    1,
    Math.min(RESOLUTION_BUDGET_MS, stopStartingAt - Date.now()),
  );
  const imagery = await resolveUniversityImagery(entries, {
    signal: AbortSignal.timeout(imageryTimeoutMs),
  });

  let updated = 0;
  let stillMissing = 0;
  let deferred = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < universityRows.length) {
      const index = cursor;
      cursor += 1;
      const row = universityRows[index];
      if (!row) continue;

      // Claim each row before checking the clock so concurrent workers count
      // every unstarted row exactly once as deferred.
      if (Date.now() >= stopStartingAt) {
        deferred += 1;
        continue;
      }

      const wikiTitle = wikiTitleFor(row.name);
      if (!imagery.has(wikiTitle)) {
        deferred += 1;
        continue;
      }

      const resolved = imagery.get(wikiTitle);
      const nextImage = row.image_url ?? resolved?.campus ?? null;
      const nextLogo =
        row.logo_url ??
        (resolved?.logo
          ? await persistUniversityLogo(
              admin,
              { id: row.id, name: row.name },
              resolved.logo,
              { deadlineMs, requestTimeoutMs: LOGO_REQUEST_TIMEOUT_MS },
            )
          : null);

      const contentChanged = nextImage !== row.image_url || nextLogo !== row.logo_url;

      const { error: upErr } = await admin
        .from('universities')
        .update({
          image_url: nextImage,
          logo_url: nextLogo,
          images_resolved_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (upErr) {
        stillMissing += 1;
      } else {
        if (contentChanged) updated += 1;
        if (!nextImage || !nextLogo) stillMissing += 1;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(ROW_CONCURRENCY, universityRows.length) }, () => worker()),
  );

  // Drop the cached university reads so the freshly resolved imagery is
  // visible on the next request instead of waiting out the 12h TTL. Only
  // bother when something actually changed.
  if (updated > 0) {
    revalidateUniversities();
  }

  return NextResponse.json({
    ok: true,
    scanned: universityRows.length,
    processed: universityRows.length - deferred,
    updated,
    stillMissing,
    deferred,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
