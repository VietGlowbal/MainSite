import { createClient } from '@/lib/supabase/server';
import {
  loadScholarshipDirectory,
  loadScholarshipDirectoryForUser,
} from '@/features/scholarships/directory-loader';
import { parseScholarshipSearchParams } from '@/features/scholarships/directory-query';

export const runtime = 'nodejs';

// The response includes the separate Frequently-picked aggregate. Keep the
// HTTP/CDN lifetime aligned with that provider's short TTL; the underlying
// catalogue/ranking data remains independently cached in the feature loader.
const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  'Vercel-CDN-Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const state = parseScholarshipSearchParams(params);
  if (state.view !== 'directory') {
    return Response.json(
      { error: 'Only the public directory view is available here' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const payload = await loadScholarshipDirectoryForUser({
        state,
        supabase,
        userId: user.id,
      });
      return Response.json(payload, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const payload = await loadScholarshipDirectory(state);
    return Response.json(payload, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    console.error('GET /api/directory/scholarships failed', error);
    return Response.json(
      { error: 'Unable to load scholarships' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
