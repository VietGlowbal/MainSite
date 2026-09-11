import { notFound, redirect } from 'next/navigation';
import { StatementFeedbackWorkspace } from '@/components/statement/StatementFeedbackWorkspace';
import type {
  LorEvidenceOption,
  StoredLorStrategy,
} from '@/components/statement/LorStrategyWorkspace';
import { LorStrategyInputSchema, LorStrategySchema } from '@/lib/ai/lor';
import { getApplicationDocumentContext } from '@/features/apply/application-document-context';
import { getServerIdentity } from '@/server/auth/server-identity';

const storedLorStrategySchema = LorStrategyInputSchema.omit({ applicationId: true }).and(
  LorStrategySchema,
);

export default async function LorFeedbackPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { supabase, identity: user } = await getServerIdentity();
  if (!user) redirect('/auth');

  const [context, activitiesResult, achievementsResult, strategyResult] = await Promise.all([
    getApplicationDocumentContext(applicationId, user.id),
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
      .eq('application_id', applicationId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);
  if (!context) notFound();
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
  return (
    <StatementFeedbackWorkspace
      applicationId={context.id}
      targetName={`${context.courseName ?? ''} · ${context.universityName ?? ''}`}
      contextNote={context.entryRequirementsSummary ?? context.aiSummary}
      reviewType="lor"
      lorEvidence={lorEvidence}
      initialLorStrategy={initialLorStrategy}
      userName={user.name}
      userAvatarUrl={user.avatarUrl}
    />
  );
}
