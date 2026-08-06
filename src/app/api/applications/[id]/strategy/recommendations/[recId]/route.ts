import { NextResponse } from 'next/server';
import { recommendationPatchSchema } from '@/features/ai-strategy-dashboard/domain';
import { createClient } from '@/lib/supabase/server';

/**
 * PATCH /api/applications/[id]/strategy/recommendations/[recId]
 *
 * The one write path for a recommendation's mutable, student-owned fields —
 * `status` (Progress Tracker, requirements.md Requirement 13), `deadline`
 * (set from the list or dragged on the calendar), and `contentValue` (the
 * detail page's content block — see `recommendationPatchSchema`'s doc
 * comment for why all three live in one schema/route rather than three).
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

  /* Only the fields actually sent are written. The board patches a status,
     the calendar patches a deadline, the detail page's content block patches
     contentValue; spreading all three unconditionally would let a stale
     `undefined` from one caller wipe a change just made by another. */
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.deadline !== undefined) patch.deadline = parsed.data.deadline;
  if (parsed.data.contentValue !== undefined) patch.content_value = parsed.data.contentValue;

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
