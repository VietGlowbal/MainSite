import { loadScholarshipDirectory } from '@/features/scholarships/directory-loader';
import { parseScholarshipSearchParams } from '@/features/scholarships/directory-query';

export const runtime = 'nodejs';

const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  'Vercel-CDN-Cache-Control': 'public, max-age=43200, stale-while-revalidate=86400',
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
