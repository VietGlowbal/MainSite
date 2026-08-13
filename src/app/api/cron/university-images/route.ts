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
 *   • Capped per run (`?limit=`, default 40) to stay well within the function
 *     timeout and to be gentle on the Wikipedia APIs.
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

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

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
    .order('qs_rank', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, updated: 0, message: 'Nothing to resolve.' });
  }

  // [wikiTitle, displayName] pairs for the resolver.
  const entries = rows.map((r) => [wikiTitleFor(r.name), r.name] as [string, string]);
  const imagery = await resolveUniversityImagery(entries);

  let updated = 0;
  let stillMissing = 0;

  for (const row of rows) {
    const resolved = imagery.get(wikiTitleFor(row.name));
    const nextImage = row.image_url ?? resolved?.campus ?? null;
    const nextLogo =
      row.logo_url ??
      (resolved?.logo
        ? await persistUniversityLogo(admin, { id: row.id, name: row.name }, resolved.logo)
        : null);

    // Skip the write if nothing new was found.
    if (nextImage === row.image_url && nextLogo === row.logo_url) {
      stillMissing += 1;
      continue;
    }

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
      updated += 1;
    }
  }

  // Drop the cached university reads so the freshly resolved imagery is
  // visible on the next request instead of waiting out the 12h TTL. Only
  // bother when something actually changed.
  if (updated > 0) {
    revalidateUniversities();
  }

  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    updated,
    stillMissing,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
