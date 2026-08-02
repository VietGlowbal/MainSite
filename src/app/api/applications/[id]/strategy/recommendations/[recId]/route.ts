import { NextResponse } from 'next/server';
import { recommendationPatchSchema } from '@/features/ai-strategy-dashboard/domain';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/applications/[id]/strategy/recommendations/[recId]
 *
 * Progress Tracker (requirements.md Requirement 13): set one of the five
 * Progress_Status values on a recommendation the student owns.
 */
export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; recId: string }> },
) {
  const { id: applicationId, recId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: application } = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = recommendationPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid update', details: parsed.error.issues },
      { status: 400 },
    );
  }

  /* Only the fields actually sent are written. The board patches a status and
     the calendar patches a deadline; spreading both unconditionally would let
     a stale `undefined` from one view wipe a change just made in the other. */
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.deadline !== undefined) patch.deadline = parsed.data.deadline;

  const { data: updated, error } = await supabase
    .from('application_recommendations')
    .update(patch)
    .eq('id', recId)
    .eq('application_id', applicationId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[strategy/recommendations/:id] update failed', error);
    return NextResponse.json({ error: 'Could not save that change' }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });

  return NextResponse.json({ recommendation: updated });
}
