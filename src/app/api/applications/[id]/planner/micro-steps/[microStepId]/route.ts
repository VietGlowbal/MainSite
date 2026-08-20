import { NextResponse } from 'next/server';
import { PlannerMicroStepUpdateError, updateApplicationPlannerMicroStep } from '@/features/ai-strategy-dashboard/api';
import { plannerMicroStepExecutionPatchSchema } from '@/features/ai-strategy-dashboard/domain';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** Canonical Core 4 execution PATCH — never accepts Core 3 planning fields. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; microStepId: string }> },
) {
  const { id: applicationId, microStepId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = plannerMicroStepExecutionPatchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid task update', details: parsed.error.issues }, { status: 400 });

  try {
    const microStep = await updateApplicationPlannerMicroStep(supabase, applicationId, user.id, microStepId, parsed.data);
    return NextResponse.json({ microStep });
  } catch (error) {
    if (error instanceof PlannerMicroStepUpdateError && error.code === 'not_found') {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    console.error('[planner/micro-steps/:id] update failed', error);
    return NextResponse.json({ error: 'Could not save this task' }, { status: 500 });
  }
}
