import { NextResponse } from 'next/server';
import { searchHomeUniversities } from '@/lib/home-search';

/**
 * GET /api/home/search?q=<text>
 *
 * Public, unauthenticated typeahead for the landing page. Returns up to a
 * handful of matching universities, each with a scholarship count and a few
 * locked preview cards. Backed by the cached home-search index, so this stays
 * cheap even under repeated keystrokes.
 */
export const revalidate = 43200;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';

  if (q.trim().length < 2) {
    return NextResponse.json({ matches: [] });
  }

  try {
    const matches = await searchHomeUniversities(q, { limit: 6, previewLimit: 3 });
    return NextResponse.json({ matches });
  } catch (error) {
    console.error('home search failed:', error);
    return NextResponse.json({ matches: [] }, { status: 200 });
  }
}
