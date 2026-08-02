import { NextResponse } from 'next/server';
import { generateRecommendations } from '@/features/ai-strategy-dashboard/api';
import { createClient } from '@/lib/supabase/server';

/**
 * GET  /api/applications/[id]/strategy/recommendations — the Dashboard's rows
 *      only (`category IS NOT NULL`) — see the note on `application-workspace.ts`
 *      for why the free per-course sidebar and this feature must not read each
 *      other's rows from the same table.
 * POST /api/applications/[id]/strategy/recommendations — (re)generate from the
 *      latest Course Match Analysis via `generateRecommendations` (shared with
 *      the Dashboard page's generate-on-first-visit path).
 *
 * requirements.md Requirement 10.
 */
export const runtime = 'nodejs';

async function loadApplication(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  userId: string,
) {
  const { data } = await supabase
    .from('course_applications')
    .select('id')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

async function listRecommendations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
) {
  const { data } = await supabase
    .from('application_recommendations')
    .select('*')
    .eq('application_id', applicationId)
    .not('category', 'is', null)
    .is('archived_at', null)
    .order('priority', { ascending: false });
  return data ?? [];
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const application = await loadApplication(supabase, applicationId, user.id);
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  return NextResponse.json({ recommendations: await listRecommendations(supabase, applicationId) });
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const application = await loadApplication(supabase, applicationId, user.id);
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

  const result = await generateRecommendations(supabase, applicationId);
  if (result.error === 'no_match_analysis') {
    return NextResponse.json(
      { error: 'Run your Course Match Analysis first so we know what to recommend.' },
      { status: 422 },
    );
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Could not save your recommendations. If this persists, the database migration may be missing.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ recommendations: await listRecommendations(supabase, applicationId) });
}
