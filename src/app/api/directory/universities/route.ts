import { loadUniversityDirectory } from '@/features/universities/directory-loader';
import { parseUniversitySearchParams } from '@/features/universities/directory-query';

export const runtime = 'nodejs';

const PUBLIC_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
  'Vercel-CDN-Cache-Control': 'public, max-age=43200, stale-while-revalidate=86400',
};

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const payload = await loadUniversityDirectory(parseUniversitySearchParams(params));
    return Response.json(payload, { headers: PUBLIC_CACHE_HEADERS });
  } catch (error) {
    console.error('GET /api/directory/universities failed', error);
    return Response.json(
      { error: 'Unable to load universities' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
