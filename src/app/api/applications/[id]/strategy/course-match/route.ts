import { NextResponse } from 'next/server';
import { deriveCourseMatchAnalysis } from '@/features/ai-strategy-dashboard/domain';
import type { MatchInputsPresent, PillarBreakdown, PillarKey } from '@/lib/match-insights';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/applications/[id]/strategy/course-match — the latest Course Match
 * Analysis (requirements.md Requirement 7), reshaped from the existing
 * five-pillar match-insights engine.
 *
 * READ-ONLY, DELIBERATELY. Generation stays on the existing
 * `POST /api/applications/[id]/match-insights` endpoint — same rate limiting,
 * document-text caching and storage it already has. Requirement 7.2 says
 * "extended, not replaced"; a second POST here would be the replacement this
 * spec explicitly rules out. The analysis page calls that endpoint directly
 * when nothing exists yet, then re-reads through here.
 */
export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = await context.params;
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

  const { data: latest } = await supabase
    .from('application_match_analyses')
    .select('*')
    .eq('application_id', applicationId)
    .eq('analysis_status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) return NextResponse.json({ analysis: null });

  const pillars = (latest.pillars ?? {}) as Record<PillarKey, PillarBreakdown>;
  const inputsPresent = (latest.inputs_present ?? {}) as MatchInputsPresent;

  const analysis = deriveCourseMatchAnalysis(
    applicationId,
    pillars,
    latest.confidence ?? 0,
    inputsPresent,
    latest.current_match_score ?? 0,
    latest.max_possible_match_score ?? 0,
  );

  return NextResponse.json({ analysis });
}
