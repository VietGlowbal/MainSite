import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { recommendationFromRow, recommendationHelp } from '@/features/ai-strategy-dashboard/domain';
import {
  AiCoachPanel,
  ContentBlockInput,
  EvidenceUpload,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  ProgressStatusControl,
  categoryLabel,
  categoryVariant,
  formatDate,
} from '@/features/ai-strategy-dashboard/ui';
import { createClient } from '@/lib/supabase/server';
import { Badge, Container, ICONS, KitIcon, Panel } from '@/shared/ui';

/**
 * `/ai-strategy/[applicationId]/strategy/recommendations/[recommendationId]`
 * — requirements.md Requirement 11. Ownership of `applicationId` already
 * enforced by the layout above this route.
 *
 * RENDERS ONLY WHAT'S REAL. "How universities evaluate it" and "suggested
 * learning resources" (two of Requirement 11.1's four sections) have no
 * backing data — no per-requirement mapping, no resource catalogue — so
 * they stay omitted rather than filled with invented text, the same
 * discipline the Applicant Analysis report uses for an empty section.
 *
 * THE BODY IS genUI, FROM A FIXED VOCABULARY. `rec.contentSchema` is one of
 * three shapes an AI chose when this recommendation was generated —
 * `ContentBlockInput` switches on it. `null` means the task is finished
 * elsewhere (`help` below, via `recommendationHelp`) rather than filled in
 * on this page; the two are mutually exclusive by construction (see
 * `normalizeContentBlock` in `src/lib/ai/match-insights.ts`), so at most one
 * of "Suggested next step" / the content block ever has anything to show.
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
  const help = recommendationHelp(rec, applicationId);

  return (
    <Container className="max-w-3xl py-gb-7xl">
      <div className="flex flex-col gap-gb-3xl">
        <Link
          href={`/ai-strategy/${applicationId}/strategy/dashboard`}
          className="inline-flex items-center gap-gb-xs self-start text-gb-sm font-semibold text-fg-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <KitIcon art={ICONS.arrowLeft} frame={16} className="shrink-0" />
          Back to planner
        </Link>

        <div className="flex flex-col gap-gb-lg">
          <div className="flex flex-wrap items-center gap-gb-md">
            {rec.category ? (
              <Badge variant={categoryVariant(rec.category)}>{categoryLabel(rec.category)}</Badge>
            ) : null}
            <Badge variant={PRIORITY_VARIANT[rec.priority]}>
              {PRIORITY_LABEL[rec.priority]} priority
            </Badge>
            <ProgressStatusControl
              applicationId={applicationId}
              recommendationId={rec.id}
              status={rec.status}
              label={`Status for ${rec.title}`}
            />
          </div>
          <h1 className="font-display text-gb-display-sm font-semibold text-fg">{rec.title}</h1>
        </div>

        {/* Meta bar — only the facts that are actually set. A student who
            hasn't been given a deadline or a time estimate for this task
            should see nothing here, not a fabricated "TBD". */}
        {rec.deadline || rec.estimatedEffort || rec.evidenceRequired ? (
          <div className="flex flex-wrap items-center gap-gb-2xl rounded-gb-lg border border-line bg-surface-muted px-gb-xl py-gb-lg text-gb-sm text-fg-tertiary">
            {rec.deadline ? (
              <span className="flex items-center gap-gb-xs">
                <KitIcon art={ICONS.calendar} frame={16} className="shrink-0" />
                Due {formatDate(rec.deadline)}
              </span>
            ) : null}
            {rec.estimatedEffort ? (
              <span className="flex items-center gap-gb-xs">
                <KitIcon art={ICONS.clock} frame={16} className="shrink-0" />
                Estimated time: {rec.estimatedEffort}
              </span>
            ) : null}
            {rec.evidenceRequired ? (
              <span className="flex items-center gap-gb-xs">
                <KitIcon art={ICONS.checkCircle} frame={16} className="shrink-0" />
                Evidence required
              </span>
            ) : null}
          </div>
        ) : null}

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

        {rec.submitChecklist.length > 0 ? (
          <Panel>
            <p className="text-gb-sm font-semibold text-fg">What to submit</p>
            <ul className="mt-gb-md flex flex-col gap-gb-sm">
              {rec.submitChecklist.map((item) => (
                <li key={item} className="flex items-start gap-gb-sm text-gb-sm text-fg-tertiary">
                  <KitIcon
                    art={ICONS.checkCircle}
                    frame={16}
                    className="mt-gb-xxs shrink-0 text-fg-brand"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {/* The tool that finishes this task, or the AI's own link — resolved by
            the same `recommendationHelp` the Dashboard table uses, so the detail
            page and the row that led here cannot offer different next steps.
            Previously this rendered `actionTarget` raw, which the model almost
            never populates. See domain/strategy-tool.ts. */}
        {help ? (
          <Panel>
            <p className="text-gb-sm font-semibold text-fg">Suggested next step</p>
            {help.external ? (
              <a
                href={help.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-gb-xs inline-block text-gb-sm font-semibold text-fg-brand hover:underline"
              >
                {help.label}
              </a>
            ) : (
              <Link
                href={help.href}
                className="mt-gb-xs inline-block text-gb-sm font-semibold text-fg-brand hover:underline"
              >
                {help.label}
              </Link>
            )}
          </Panel>
        ) : null}

        {rec.contentSchema ? (
          <Panel>
            <p className="mb-gb-lg text-gb-sm font-semibold text-fg">Task content</p>
            <ContentBlockInput
              applicationId={applicationId}
              recommendationId={rec.id}
              schema={rec.contentSchema}
              value={rec.contentValue}
            />
          </Panel>
        ) : null}

        <Panel>
          <p className="mb-gb-lg text-gb-sm font-semibold text-fg">Supporting files</p>
          <EvidenceUpload applicationId={applicationId} recommendationId={rec.id} />
        </Panel>

        <Panel>
          <p className="mb-gb-lg text-gb-sm font-semibold text-fg">AI Coach</p>
          <AiCoachPanel
            applicationId={applicationId}
            recommendationId={rec.id}
            suggestedQuestions={rec.suggestedQuestions}
          />
        </Panel>

        {rec.tips.length > 0 ? (
          <Panel>
            <p className="mb-gb-md text-gb-sm font-semibold text-fg">Tips</p>
            {/* A plain list, not an accordion — each tip is one short string
                with nothing further to reveal, so a chevron that expands to
                an empty body would be an affordance for something that
                isn't there. */}
            <ul className="flex flex-col gap-gb-sm">
              {rec.tips.map((tip) => (
                <li
                  key={tip}
                  className="rounded-gb-md border border-line px-gb-lg py-gb-md text-gb-sm text-fg-tertiary"
                >
                  {tip}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </Container>
  );
}
