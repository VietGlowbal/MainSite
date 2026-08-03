import { notFound, redirect } from 'next/navigation';
import { StatementFeedbackWorkspace } from '@/components/statement/StatementFeedbackWorkspace';
import type {
  LorEvidenceOption,
  StoredLorStrategy,
} from '@/components/statement/LorStrategyWorkspace';
import { LorStrategyInputSchema, LorStrategySchema } from '@/lib/ai/lor';
import { fetchApplicationWorkspace } from '@/lib/api/application-workspace';
import { createClient } from '@/lib/supabase/server';

const storedLorStrategySchema = LorStrategyInputSchema.omit({ applicationId: true }).and(
  LorStrategySchema,
);

export default async function LorFeedbackPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const workspace = await fetchApplicationWorkspace(applicationId, user.id);
  if (!workspace) notFound();

  const { application } = workspace;
  const [activitiesResult, achievementsResult, strategyResult] = await Promise.all([
    supabase
      .from('student_activities')
      .select('id, title, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('student_achievements')
      .select('id, title, detail')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('application_lor_strategies')
      .select('recommender_type, relationship_context, known_duration, observed_evidence, perspective, recommendations, do_not_prioritize, recommendation_brief')
      .eq('application_id', application.id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  const lorEvidence: LorEvidenceOption[] = [
    ...((activitiesResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      kind: 'activity' as const,
      id: row.id as string,
      title: (row.title as string) ?? '',
      description: (row.description as string | null) ?? null,
    })),
    ...((achievementsResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      kind: 'achievement' as const,
      id: row.id as string,
      title: (row.title as string) ?? '',
      description: (row.detail as string | null) ?? null,
    })),
  ];
  const strategyRow = strategyResult.data as Record<string, unknown> | null;
  const parsedStrategy = strategyRow
    ? storedLorStrategySchema.safeParse({
        recommenderType: strategyRow.recommender_type,
        relationshipContext: strategyRow.relationship_context,
        knownDuration: strategyRow.known_duration,
        observedEvidence: strategyRow.observed_evidence,
        perspective: strategyRow.perspective,
        recommendations: strategyRow.recommendations,
        doNotPrioritize: strategyRow.do_not_prioritize,
        recommendationBrief: strategyRow.recommendation_brief,
      })
    : null;
  const initialLorStrategy: StoredLorStrategy | null =
    parsedStrategy?.success ? parsedStrategy.data : null;
  const userName =
    (user.user_metadata?.full_name as string | undefined) || user.email?.split('@')[0] || null;
  const userAvatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <StatementFeedbackWorkspace
      applicationId={application.id}
      targetName={`${application.courseName} · ${application.universityName}`}
      contextNote={workspace.course?.entryRequirementsSummary ?? application.aiSummary}
      reviewType="lor"
      lorEvidence={lorEvidence}
      initialLorStrategy={initialLorStrategy}
      userName={userName}
      userAvatarUrl={userAvatarUrl}
    />
  );
}
