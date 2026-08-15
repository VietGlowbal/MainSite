import { NextResponse, type NextRequest } from 'next/server';
import { loadManualReview } from '@/server/payments/manual-review-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const review = token ? await loadManualReview(token) : null;
  if (!review) return NextResponse.json({ error: 'Review is unavailable' }, { status: 404, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  return NextResponse.json(review, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
