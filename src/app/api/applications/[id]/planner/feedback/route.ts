import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlannerMode, savePlannerFeedback } from '@/features/ai-strategy-dashboard/api';
import { createClient } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/payments/manual-review-auth';

export const runtime = 'nodejs';
const uuid = z.string().uuid();
const schema = z.object({
  targetType: z.enum(['plan', 'micro_step']), targetId: uuid.nullable().optional(), rating: z.number().int().min(1).max(5).nullable().optional(),
  reason: z.enum(['not_relevant', 'already_done', 'too_generic', 'incorrect', 'too_easy', 'too_hard', 'not_actionable', 'other']).nullable().optional(), comment: z.string().trim().max(1000).nullable().optional(),
}).strict().refine((value) => (value.targetType === 'plan' && !value.targetId) || (value.targetType === 'micro_step' && Boolean(value.targetId)), { message: 'Invalid feedback target' });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  const { id: applicationId } = await context.params;
  if (!uuid.safeParse(applicationId).success) return NextResponse.json({ error: 'Invalid application id' }, { status: 400 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid feedback', details: parsed.error.issues }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (await getPlannerMode(supabase, user.id) !== 'canonical') return NextResponse.json({ error: 'Planner access requires GlowBal Plus.' }, { status: 403 });
  const result = await savePlannerFeedback(applicationId, user.id, parsed.data);
  if (result.kind === 'not_found') return NextResponse.json({ error: 'Planner not found' }, { status: 404 });
  if (result.kind === 'target_not_found') return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (result.kind === 'failed') return NextResponse.json({ error: 'Could not save feedback' }, { status: 500 });
  return NextResponse.json({ ok: true, id: result.id });
}
