import { NextResponse } from 'next/server';
import { generateRoadmapTasks, getPlannerMode } from '@/features/ai-strategy-dashboard/api';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/applications/[id]/strategy/roadmap-tasks — turns the latest F7
 * Personalized Strategy report's Execution Roadmap into Planner tasks, via
 * `generateRoadmapTasks`. The "Add to Planner" button on
 * `strategy-recommendation-report.tsx`'s Roadmap tab.
 */
export const runtime = 'nodejs';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (await getPlannerMode(supabase, user.id) === 'canonical') {
    return NextResponse.json({ error: 'This application uses the canonical Planner.' }, { status: 409 });
  }

  const { data: application } = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const result = await generateRoadmapTasks(supabase, applicationId);
  if (result.error === 'no_strategy_recommendation') {
    return NextResponse.json(
      { error: 'Generate your Personalized Strategy report first so we know what to add.' },
      { status: 422 },
    );
  }
  if (!result.ok) {
    return NextResponse.json({ error: 'Could not save your tasks. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({
    inserted: result.inserted,
    updated: result.updated,
    archived: result.archived,
  });
}
