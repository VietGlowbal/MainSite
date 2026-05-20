import { NextResponse } from 'next/server';
import { resolveUniversityImagery } from '@/lib/wiki-images';

/**
 * Imagery resolver — POST `[ [wikiTitle, displayName], ... ]` and get back
 * `{ wikiTitle: { campus, logo } }`. Used by the search page to lazy-load
 * university images on the client so the initial server response can ship
 * the list of universities instantly without waiting on Wikipedia.
 *
 * Cached aggressively at the edge — this data only changes when a
 * university redesigns their logo, which is essentially never on a
 * product-relevant timescale.
 */
export const runtime = 'nodejs';
export const revalidate = 86400; // 24h

export async function POST(req: Request) {
  let entries: Array<[string, string]> = [];
  try {
    const body = await req.json();
    if (Array.isArray(body)) {
      entries = body
        .filter((e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string')
        .slice(0, 200);
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (entries.length === 0) {
    return NextResponse.json({});
  }

  const map = await resolveUniversityImagery(entries);
  const out: Record<string, { campus: string | null; logo: string | null }> = {};
  for (const [title, imagery] of map.entries()) {
    out[title] = imagery;
  }

  return NextResponse.json(out, {
    headers: {
      // Allow shared caches (Vercel's edge cache, browsers' shared caches)
      // to keep this for a day; revalidate in the background.
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
