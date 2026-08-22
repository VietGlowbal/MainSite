'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PortfolioOpportunity, StrategyRecommendationRecord } from '../domain';
import {
  DIRECTION_DIMENSION_LABELS,
  DIRECTION_DIMENSIONS,
  PRIORITY_LEVEL_LABELS,
  chosenDiffersFromTopScore,
  developmentStrategies,
  rankedDirections,
  strategicOverview,
  strategicPriorities,
  type PriorityLevel,
  type RankedDirection,
} from '../domain';
import { useLanguage } from '@/lib/i18n';
import { Badge, Button, Panel, ProgressBar, type BadgeVariant } from '@/shared/ui';
import { usePlusStatus } from '@/features/plus/hooks/use-plus-status';
import type { ReactNode } from 'react';

/**
 * The Personalized Strategy report.
 *
 * ─── WHY THIS STOPPED BEING SIX TABS ─────────────────────────────────────────
 *
 * The previous version was a tab strip named after the engine's own internals —
 * Direction, Narrative, Positioning, Portfolio, Differentiation, Roadmap. That
 * is the order F7 computes things in, not the order a student needs to read
 * them, and it buried the answer: a student opening "what is my strategy" had
 * to click six tabs to assemble one. It is now a single document in the order
 * docs/strategy-reports-spec.md asks for — where I am, what I am aiming at, my
 * top priorities, then the supporting analysis.
 *
 * ─── THE DIMENSION SCORES NOW MAKE AN ARGUMENT ───────────────────────────────
 *
 * Six scores per direction used to be rendered as a row of numbers, leaving the
 * reading to the student. `strategicOverview` turns the highest into the reason
 * this direction was chosen and the lowest into the thing most likely to
 * undermine it, which is what the layout's Current Position block asks for.
 *
 * ─── CONTENT STAYS AS GENERATED, CHROME STAYS BILINGUAL ──────────────────────
 *
 * AI-authored strings (`recommendation.*`) render verbatim and never go through
 * `t()`, unchanged from before. Headings and buttons are chrome and do.
 */

const RECOMMENDATION_VARIANT: Record<PortfolioOpportunity['recommendation'], BadgeVariant> = {
  highly_recommended: 'safe-chip',
  recommended: 'recommend',
  low_priority: 'neutral-chip',
};

const PRIORITY_VARIANT: Record<PriorityLevel, BadgeVariant> = {
  high: 'reach',
  medium: 'recommend',
  low: 'neutral-chip',
};

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'priorities', label: 'Priorities' },
  { id: 'development', label: 'Development' },
  { id: 'narrative', label: 'Narrative' },
  { id: 'roadmap', label: 'Roadmap' },
] as const;

/**
 * Wraps a section with a blur + "Go Plus" CTA for non-Plus users.
 *
 * Plus status is resolved once by the parent and passed in, so the gate never
 * re-runs the entitlement check while the reader moves around the report. The
 * `usePlusStatus()` fallback is only for a caller that has no status to hand.
 */
function PlusGated({
  children,
  isPlus: propIsPlus,
  loading: propLoading,
}: {
  children: ReactNode;
  isPlus?: boolean;
  loading?: boolean;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const plusStatus = usePlusStatus();
  const isPlus = propIsPlus ?? plusStatus.isPlus;
  const loading = propLoading ?? plusStatus.loading;

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (isPlus) return <>{children}</>;

  return (
    <div className="relative select-none overflow-hidden rounded-gb-2xl">
      <div className="pointer-events-none opacity-30 blur-md" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-gb-lg rounded-gb-2xl border border-line bg-surface/90 p-gb-3xl text-center shadow-xl backdrop-blur-md">
          <span className="text-3xl" aria-hidden="true">🔒</span>
          <p className="text-gb-sm font-semibold text-fg">
            {t('Upgrade to GlowBal Plus to unlock this section')}
          </p>
          <Button size="sm" onClick={() => router.push('/plus')}>
            {t('Upgrade to Plus')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StrategyRecommendationReport({
  applicationId,
  recommendation,
  initialPlus,
}: {
  applicationId: string;
  recommendation: StrategyRecommendationRecord;
  initialPlus?: boolean;
}) {
  const { t } = useLanguage();
  const { isPlus, loading } = usePlusStatus(initialPlus);
  const overview = strategicOverview(recommendation);
  const priorities = strategicPriorities(recommendation);
  const ranked = rankedDirections(recommendation);
  const development = developmentStrategies(recommendation);

  return (
    <div className="flex flex-col gap-gb-4xl">
      <header className="flex flex-wrap items-center justify-between gap-gb-xl">
        <div className="flex flex-col gap-gb-xs">
          <h1 className="font-display text-gb-display-sm font-semibold text-fg">
            {t('Your Personalized Strategy')}
          </h1>
          <p className="text-gb-sm text-fg-tertiary">{formatDate(recommendation.createdAt)}</p>
        </div>
        <DownloadPdfButton applicationId={applicationId} />
      </header>

      <nav aria-label={t('Strategy report sections')} className="-mx-gb-lg overflow-x-auto px-gb-lg">
        <ul className="flex min-w-max gap-gb-xs">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex rounded-gb-full bg-surface-muted px-gb-lg py-gb-xs text-gb-xs font-medium text-fg-secondary transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t(section.label)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <StrategicOverviewSection overview={overview} recommendation={recommendation} />

      <PlusGated isPlus={isPlus} loading={loading}>
        <div className="flex flex-col gap-gb-4xl">
          <PrioritiesSection priorities={priorities} />
          <DevelopmentSection development={development} ranked={ranked} recommendation={recommendation} />
          <NarrativeSection recommendation={recommendation} />
          <RoadmapSection applicationId={applicationId} recommendation={recommendation} />
        </div>
      </PlusGated>
    </div>
  );
}

function SectionHeading({
  id,
  index,
  title,
  blurb,
}: {
  id: string;
  index: number;
  title: string;
  blurb?: string;
}) {
  return (
    <div className="flex flex-col gap-gb-xs">
      <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{index}</p>
      <h2
        id={id}
        className="scroll-mt-gb-4xl font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg"
      >
        {title}
      </h2>
      {blurb ? <p className="max-w-2xl text-gb-sm text-fg-tertiary">{blurb}</p> : null}
    </div>
  );
}

function StrategicOverviewSection({
  overview,
  recommendation,
}: {
  overview: ReturnType<typeof strategicOverview>;
  recommendation: StrategyRecommendationRecord;
}) {
  const { t } = useLanguage();

  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading id="overview" index={1} title={t('Where you are, and where this takes you')} />

      <div className="grid gap-gb-lg md:grid-cols-2">
        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Current position')}</h3>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">{overview.currentPosition}</p>
          {overview.keyStrength ? (
            <p className="text-gb-sm text-fg-tertiary">
              {t('Strongest dimension')}: {t(overview.keyStrength.label)} ({overview.keyStrength.score}/10)
            </p>
          ) : null}
          {overview.biggestChallenge ? (
            <p className="text-gb-sm text-fg-tertiary">
              {t('Biggest challenge')}: {t(overview.biggestChallenge.label)} ({overview.biggestChallenge.score}/10)
            </p>
          ) : null}
        </Panel>

        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Strategic goal')}</h3>
          <p className="font-display text-gb-lg font-semibold text-fg">{overview.strategicGoal}</p>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {overview.strategicPositioning}
          </p>
        </Panel>
      </div>

      {overview.topPriorities.length > 0 ? (
        <div className="flex flex-col gap-gb-md">
          <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Top priorities')}</h3>
          <ol className="flex flex-col gap-gb-md">
            {overview.topPriorities.map((priority, index) => (
              <li key={priority} className="flex gap-gb-lg">
                <span className="font-display text-gb-lg font-semibold text-fg-brand">
                  {index + 1}
                </span>
                <span className="text-gb-sm leading-relaxed text-fg-secondary">{priority}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <Panel className="flex flex-col gap-gb-md">
        <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Expected outcome')}</h3>
        <p className="text-gb-sm leading-relaxed text-fg-secondary">{overview.expectedOutcome}</p>
      </Panel>

      {chosenDiffersFromTopScore(recommendation) ? (
        <Panel className="flex flex-col gap-gb-xs">
          <h3 className="text-gb-sm font-semibold text-fg">
            {t('This is not the highest-scoring option, and that is deliberate')}
          </h3>
          <p className="text-gb-sm leading-relaxed text-fg-tertiary">
            {recommendation.chosenDirectionWhy}
          </p>
        </Panel>
      ) : null}
    </section>
  );
}

function PrioritiesSection({
  priorities,
}: {
  priorities: ReturnType<typeof strategicPriorities>;
}) {
  const { t } = useLanguage();

  if (priorities.length === 0) return null;

  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading
        id="priorities"
        index={2}
        title={t('What to work on')}
        blurb={t('Ordered by how much each one moves your position, not by how easy it is.')}
      />

      <div className="flex flex-col gap-gb-md">
        {priorities.map((row) => (
          <Panel key={row.priority} className="flex flex-col gap-gb-md">
            <div className="flex flex-wrap items-center justify-between gap-gb-md">
              <h3 className="text-gb-md font-semibold text-fg">{row.priority}</h3>
              <Badge variant={PRIORITY_VARIANT[row.level]}>
                {t(PRIORITY_LEVEL_LABELS[row.level])}
              </Badge>
            </div>
            <p className="text-gb-xs text-fg-muted">{t(row.currentSituation)}</p>
            <p className="text-gb-sm leading-relaxed text-fg-secondary">{row.whyItMatters}</p>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function DevelopmentSection({
  development,
  ranked,
  recommendation,
}: {
  development: ReturnType<typeof developmentStrategies>;
  ranked: RankedDirection[];
  recommendation: StrategyRecommendationRecord;
}) {
  const { t } = useLanguage();

  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading id="development" index={3} title={t('How to develop your profile')} />

      {development.differentiation ? (
        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-sm font-semibold text-fg-secondary">
            {t('What makes you different')}
          </h3>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {development.differentiation.insight}
          </p>
          <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('How to amplify it')}</h3>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {development.differentiation.proposal}
          </p>
        </Panel>
      ) : null}

      <div className="flex flex-col gap-gb-md">
        <h3 className="text-gb-sm font-semibold text-fg-secondary">
          {t('The directions we compared')}
        </h3>
        <p className="text-gb-xs text-fg-muted">
          {t('Each direction is scored on six dimensions. The margin shows how close the decision was.')}
        </p>
        <div className="flex flex-col gap-gb-md">
          {ranked.map((option) => (
            <Panel
              key={option.name}
              className={`flex flex-col gap-gb-md ${option.isChosen ? 'border-brand' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-gb-md">
                <div className="flex flex-wrap items-center gap-gb-md">
                  <h4 className="text-gb-md font-semibold text-fg">{option.name}</h4>
                  {option.isChosen ? (
                    <Badge variant="brand-subtle">{t('Recommended')}</Badge>
                  ) : null}
                </div>
                <span className="text-gb-sm text-fg-tertiary">
                  {option.overall}/10
                  {option.margin > 0 ? ` · ${t('{n} behind', { n: option.margin })}` : ''}
                </span>
              </div>
              <dl className="grid gap-gb-md sm:grid-cols-2 lg:grid-cols-3">
                {DIRECTION_DIMENSIONS.map((key) => (
                  <div key={key} className="flex flex-col gap-gb-xxs">
                    <dt className="text-gb-xs text-fg-muted">
                      {t(DIRECTION_DIMENSION_LABELS[key])}
                    </dt>
                    <dd>
                      <ProgressBar
                        value={option[key] * 10}
                        label={t(DIRECTION_DIMENSION_LABELS[key])}
                        size="sm"
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ))}
        </div>
      </div>

      {development.missing.length > 0 ? (
        <p className="max-w-2xl text-gb-xs text-fg-muted">
          {t(
            'Academic and experience strategies are not generated yet. They are part of the report specification but the engine does not produce them, so nothing is shown rather than something recycled from the sections above.',
          )}
        </p>
      ) : null}

      <Panel className="flex flex-col gap-gb-md">
        <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Portfolio opportunities')}</h3>
        <ul className="flex flex-col gap-gb-md">
          {recommendation.portfolioEvaluations.map((opportunity) => (
            <li key={opportunity.name} className="flex flex-col gap-gb-xxs">
              <div className="flex flex-wrap items-center gap-gb-md">
                <span className="text-gb-sm font-medium text-fg">{opportunity.name}</span>
                <Badge variant={RECOMMENDATION_VARIANT[opportunity.recommendation]}>
                  {t(
                    opportunity.recommendation === 'highly_recommended'
                      ? 'Highly recommended'
                      : opportunity.recommendation === 'recommended'
                        ? 'Recommended'
                        : 'Low priority',
                  )}
                </Badge>
              </div>
              <p className="text-gb-sm text-fg-tertiary">{opportunity.strategicContribution}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}

function NarrativeSection({
  recommendation,
}: {
  recommendation: StrategyRecommendationRecord;
}) {
  const { t } = useLanguage();

  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading
        id="narrative"
        index={4}
        title={t('The story your application should tell')}
      />

      <Panel className="flex flex-col gap-gb-md">
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {recommendation.narrative}
        </p>
      </Panel>

      <div className="grid gap-gb-lg md:grid-cols-2">
        <Panel className="flex flex-col gap-gb-xs">
          <h3 className="text-gb-sm font-semibold text-fg-tertiary">{t('How you read now')}</h3>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {recommendation.positioningBefore}
          </p>
        </Panel>
        <Panel className="flex flex-col gap-gb-xs border-brand">
          <h3 className="text-gb-sm font-semibold text-fg-brand">{t('How you could read')}</h3>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {recommendation.positioningAfter}
          </p>
        </Panel>
      </div>

      <Panel className="flex flex-col gap-gb-md">
        <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Why this is stronger')}</h3>
        <p className="text-gb-sm leading-relaxed text-fg-secondary">
          {recommendation.positioningRationale}
        </p>
      </Panel>

      <Panel className="flex flex-col gap-gb-md">
        <h3 className="text-gb-sm font-semibold text-fg-secondary">{t('Long-term narrative')}</h3>
        <p className="text-gb-sm leading-relaxed text-fg-secondary">
          {recommendation.roadmap.longTermNarrative}
        </p>
      </Panel>
    </section>
  );
}

function RoadmapSection({
  applicationId,
  recommendation,
}: {
  applicationId: string;
  recommendation: StrategyRecommendationRecord;
}) {
  const { t } = useLanguage();
  const { roadmap } = recommendation;

  return (
    <section className="flex flex-col gap-gb-xl">
      <SectionHeading id="roadmap" index={5} title={t('Your roadmap')} />

      <Panel className="flex flex-col gap-gb-md">
        <h3 className="text-gb-md font-semibold text-fg">{roadmap.chosenStrategy}</h3>
        <p className="text-gb-sm leading-relaxed text-fg-secondary">{roadmap.why}</p>
      </Panel>

      <div className="grid gap-gb-lg md:grid-cols-2">
        <ChecklistSection heading={t('Prioritise')} items={roadmap.prioritize} />
        <ChecklistSection heading={t('Avoid')} items={roadmap.avoid} />
      </div>

      <AddToPlannerCard applicationId={applicationId} />
    </section>
  );
}

type AddToPlannerState = { kind: 'idle' } | { kind: 'generating' } | { kind: 'failed' };

/**
 * Turns `roadmap.prioritize`/`.avoid` into Planner tasks
 * (`generateRoadmapTasks`) and hands off to the Planner to see them — same
 * "generate, then go look" shape as the onboarding flow into `/strategy/analysis`.
 * Re-clicking is safe: the generator reconciles by (category, title), so this
 * never duplicates a task already added.
 */
function AddToPlannerCard({ applicationId }: { applicationId: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [state, setState] = useState<AddToPlannerState>({ kind: 'idle' });

  async function run() {
    setState({ kind: 'generating' });
    try {
      const response = await fetch(`/api/applications/${applicationId}/strategy/roadmap-tasks`, {
        method: 'POST',
      });
      if (!response.ok) {
        setState({ kind: 'failed' });
        return;
      }
      router.push(`/ai-strategy/${applicationId}/strategy/dashboard`);
    } catch {
      setState({ kind: 'failed' });
    }
  }

  return (
    <Panel className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{t('Turn this into Planner tasks')}</h2>
      <p className="max-w-2xl text-gb-sm text-fg-tertiary">
        {t(
          'Adds what to prioritize and what to avoid, above, to your Planner as tasks you can track. Safe to click again after this report regenerates — it updates the same tasks rather than duplicating them.',
        )}
      </p>
      <Button
        size="sm"
        variant={state.kind === 'failed' ? 'secondary' : 'primary'}
        className="self-start"
        onClick={() => void run()}
        disabled={state.kind === 'generating'}
      >
        {state.kind === 'generating'
          ? t('Adding to Planner...')
          : state.kind === 'failed'
            ? t('Try again')
            : t('Add to Planner')}
      </Button>
    </Panel>
  );
}

function ChecklistSection({ heading, items }: { heading: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">{heading}</h2>
      <ul className="flex flex-col gap-gb-xs">
        {items.map((item) => (
          <li key={item} className="text-gb-sm text-fg-secondary">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

type ExportState = { kind: 'idle' } | { kind: 'generating' } | { kind: 'ready'; url: string } | { kind: 'failed' };

/** Same shape as the CV export button (`cv-layout-workspace.tsx`) — generate, then link the signed URL. */
function DownloadPdfButton({ applicationId }: { applicationId: string }) {
  const { t } = useLanguage();
  const [state, setState] = useState<ExportState>({ kind: 'idle' });

  async function runExport() {
    setState({ kind: 'generating' });
    try {
      const response = await fetch(
        `/api/applications/${applicationId}/strategy/recommendation/export`,
        { method: 'POST' },
      );
      const data = (await response.json().catch(() => ({}))) as { url?: string };
      if (!response.ok || !data.url) {
        setState({ kind: 'failed' });
        return;
      }
      setState({ kind: 'ready', url: data.url });
    } catch {
      setState({ kind: 'failed' });
    }
  }

  if (state.kind === 'ready') {
    return (
      <Button
        size="sm"
        href={state.url}
        target="_blank"
        rel="noopener noreferrer"
        download="personalized-strategy.pdf"
      >
        {t('Download PDF')}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant={state.kind === 'failed' ? 'secondary' : 'primary'}
      onClick={() => void runExport()}
      disabled={state.kind === 'generating'}
    >
      {state.kind === 'generating'
        ? t('Preparing PDF...')
        : state.kind === 'failed'
          ? t('Try again')
          : t('Download PDF')}
    </Button>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
