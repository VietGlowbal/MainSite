import { NextResponse } from 'next/server';
import { recommendationStatusPatchSchema } from '@/features/ai-strategy-dashboard/domain';
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

  const parsed = recommendationStatusPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid status', details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { data: updated, error } = await supabase
    .from('application_recommendations')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('id', recId)
    .eq('application_id', applicationId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('[strategy/recommendations/:id] update failed', error);
    return NextResponse.json({ error: 'Could not update status' }, { status: 500 });
  }
  if (!updated) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });

  return NextResponse.json({ recommendation: updated });
}
