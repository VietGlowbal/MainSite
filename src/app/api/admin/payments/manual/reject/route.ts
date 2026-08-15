import { after } from 'next/server';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { authorizeManualReview, sameOrigin } from '@/server/payments/manual-review-auth';
import { dispatchDueManualPaymentJobs } from '@/server/payments/manual-outbox';

const Body = z.object({ token: z.string().min(1), note: z.string().max(1000).optional() });

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Same-origin request required' }, { status: 403 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid review request' }, { status: 400 });
  const auth = await authorizeManualReview(parsed.data.token);
  if (!auth) return NextResponse.json({ error: 'Review is unavailable' }, { status: 403 });
  const { data, error } = await auth.admin.rpc('review_manual_payment', { p_review_id: auth.reviewId, p_token_version: auth.tokenVersion, p_action: 'reject', p_reviewer_id: auth.userId, p_note: parsed.data.note ?? null });
  if (error) return NextResponse.json({ error: 'Could not reject payment' }, { status: 503 });
  after(() => dispatchDueManualPaymentJobs(1).catch(() => undefined));
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
