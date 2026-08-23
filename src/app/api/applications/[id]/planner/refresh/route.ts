import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlannerMode, refreshApplicationPlan, type PlannerRefreshTrigger } from '@/features/ai-strategy-dashboard/api';
import { createClient } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/payments/manual-review-auth';

export const runtime = 'nodejs';
const uuidSchema = z.string().uuid();
const bodySchema = z.object({ trigger: z.enum(['manual_refresh', 'retry']).default('manual_refresh') }).strict();

/** Explicit, bounded recovery path; all ownership/entitlement checks remain server-side. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  const { id } = await context.params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
  let raw: unknown = {};
  try { raw = await request.json(); } catch { /* empty body uses manual_refresh */ }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid refresh request' }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (await getPlannerMode(supabase, user.id) !== 'canonical') return NextResponse.json({ error: 'Planner access requires GlowBal Plus.' }, { status: 403 });
  try {
    const result = await refreshApplicationPlan(supabase, id, user.id, parsed.data.trigger as PlannerRefreshTrigger);
    return NextResponse.json(result, { status: result.reason === 'concurrent' ? 409 : 200 });
  } catch (error) {
    console.error('[planner/refresh] failed', { applicationId: id, userId: user.id, error });
    return NextResponse.json({ error: 'We could not update your plan. Your current plan is still available.' }, { status: 500 });
  }
}
