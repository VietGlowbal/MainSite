import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CanonicalPlannerAccessError, getPlannerMode, PlannerMicroStepUpdateError, progressApplicationPlan } from '@/features/ai-strategy-dashboard/api';
import { plannerMicroStepExecutionPatchSchema } from '@/features/ai-strategy-dashboard/domain';
import { createClient } from '@/lib/supabase/server';
import { sameOrigin } from '@/server/payments/manual-review-auth';

export const runtime = 'nodejs';
const uuidSchema = z.string().uuid();

/** Canonical Core 4 execution PATCH — never accepts Core 3 planning fields. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; microStepId: string }> },
) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  const { id: applicationId, microStepId } = await context.params;
  if (!uuidSchema.safeParse(applicationId).success || !uuidSchema.safeParse(microStepId).success) {
    return NextResponse.json({ error: 'Invalid task identifier' }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (await getPlannerMode(supabase, user.id) !== 'canonical') return NextResponse.json({ error: 'Planner access requires GlowBal Plus.' }, { status: 403 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = plannerMicroStepExecutionPatchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid task update', details: parsed.error.issues }, { status: 400 });

  try {
    const result = await progressApplicationPlan(applicationId, user.id, microStepId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CanonicalPlannerAccessError && error.code === 'not_found') return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (error instanceof CanonicalPlannerAccessError && error.code === 'not_entitled') return NextResponse.json({ error: 'Planner access requires GlowBal Plus.' }, { status: 403 });
    if (error instanceof PlannerMicroStepUpdateError && error.code === 'not_found') {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (error instanceof PlannerMicroStepUpdateError && error.code === 'input_required') {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof PlannerMicroStepUpdateError && error.code === 'invalid_content') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[planner/micro-steps/:id] update failed', error);
    return NextResponse.json({ error: 'Could not save this task' }, { status: 500 });
  }
}
