import { notFound, redirect } from 'next/navigation';
import { recommendationFromRow } from '@/features/ai-strategy-dashboard/domain';
import {
  AiCoachPanel,
  EvidenceUpload,
  ProgressStatusControl,
} from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';
import { Badge, Container, Panel } from '@/shared/ui';

/**
 * `/ai-strategy/[applicationId]/strategy/recommendations/[recommendationId]`
 * — requirements.md Requirement 11. Ownership of `applicationId` already
 * enforced by the layout above this route.
 *
 * RENDERS ONLY WHAT'S REAL. Requirement 11.1 asks for four sections; only two
 * have an actual data source today — "why this matters" (the AI's own
 * `reason`/detail text) and "how much it could improve admission chances"
 * (`estimatedImpact`, a real number from the match-insights call). "How
 * universities evaluate it" and "suggested learning resources" have no
 * backing data yet (no per-requirement mapping, no resource catalogue) — see
 * `recommendationFromImprovementAction`'s doc comment — so they're omitted
 * rather than filled with invented text, consistent with how the Applicant
 * Analysis report treats an empty section.
 */
export default async function RecommendationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string; recommendationId: string }>;
}) {
  const { applicationId, recommendationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { data: row } = await supabase
    .from('application_recommendations')
    .select('*')
    .eq('id', recommendationId)
    .eq('application_id', applicationId)
    .maybeSingle();

  if (!row) notFound();

  const rec = recommendationFromRow(row);

  return (
    <Container className="max-w-3xl py-gb-7xl">
      <div className="flex flex-col gap-gb-3xl">
        <div className="flex flex-col gap-gb-lg">
          <div className="flex flex-wrap items-center gap-gb-md">
            <Badge variant={rec.priority === 'low' ? 'neutral' : 'reach'}>{rec.priority}</Badge>
            <ProgressStatusControl
              applicationId={applicationId}
              recommendationId={rec.id}
              status={rec.status}
              label={`Status for ${rec.title}`}
            />
          </div>
          <h1 className="font-display text-gb-display-sm font-semibold text-fg">{rec.title}</h1>
        </div>

        {rec.reason ? (
          <Panel>
            <p className="text-gb-sm font-semibold text-fg">Why this matters</p>
            <p className="mt-gb-xs text-gb-sm text-fg-tertiary">{rec.reason}</p>
          </Panel>
        ) : null}

        {rec.estimatedImpact != null ? (
          <Panel>
            <p className="text-gb-sm font-semibold text-fg">
              How much it could improve admission chances
            </p>
            <p className="mt-gb-xs text-gb-sm text-fg-tertiary">
              Up to +{rec.estimatedImpact} points toward this category&rsquo;s match score.
            </p>
          </Panel>
        ) : null}

        {rec.actionTarget ? (
          <Panel>
            <p className="text-gb-sm font-semibold text-fg">Suggested next step</p>
            <a
              href={rec.actionTarget}
              target={rec.actionType === 'external_url' ? '_blank' : undefined}
              rel={rec.actionType === 'external_url' ? 'noopener noreferrer' : undefined}
              className="mt-gb-xs inline-block text-gb-sm font-semibold text-fg-brand hover:underline"
            >
              {rec.actionLabel ?? 'View'}
            </a>
          </Panel>
        ) : null}

        <Panel>
          <p className="mb-gb-lg text-gb-sm font-semibold text-fg">AI Coach</p>
          <AiCoachPanel applicationId={applicationId} recommendationId={rec.id} />
        </Panel>

        <Panel>
          <p className="mb-gb-lg text-gb-sm font-semibold text-fg">Evidence</p>
          <EvidenceUpload applicationId={applicationId} recommendationId={rec.id} />
        </Panel>
      </div>
    </Container>
  );
}
