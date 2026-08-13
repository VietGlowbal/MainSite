'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DirectionOption, PortfolioOpportunity, StrategyRecommendationRecord } from '../domain';
import { ReportPanel, ReportTabs, useReportTabs } from './report-chrome';
import { useLanguage } from '@/lib/i18n';
import { Badge, Button, Panel, ScoreRing, type BadgeVariant } from '@/shared/ui';

/**
 * F7 Personalized Strategy — the "pdf-style" strategy report.
 *
 * ─── READ-ONLY, ON PURPOSE ───────────────────────────────────────────────────
 *
 * Unlike the Planner, nothing on this page is a task to check off — it is one
 * generation's worth of synthesis over the Personal Report and Matching
 * Report, six sections (F7.1-F7.6), rendered the same way every time it is
 * opened. See `domain/strategy-recommendation.ts` on why it lives outside the
 * pure evaluation engine.
 *
 * ─── CONTENT STAYS ENGLISH, CHROME STAYS BILINGUAL ───────────────────────────
 *
 * Every AI-authored string on this page (`recommendation.*`) is rendered
 * verbatim, never passed through `t()` — the report was generated in English
 * by product decision. Headings, tab labels and button copy are chrome and go
 * through `t()` like every other report page.
 */

const RECOMMENDATION_VARIANT: Record<PortfolioOpportunity['recommendation'], BadgeVariant> = {
  highly_recommended: 'safe-chip',
  recommended: 'recommend',
  low_priority: 'neutral-chip',
};

const RECOMMENDATION_LABEL: Record<PortfolioOpportunity['recommendation'], string> = {
  highly_recommended: 'Highly recommended',
  recommended: 'Recommended',
  low_priority: 'Low priority',
};

const SOURCE_LABEL: Record<PortfolioOpportunity['source'], string> = {
  existing_activity: 'Already in your portfolio',
  ai_proposed: 'Suggested opportunity',
};

const DIMENSION_LABEL: Record<
  'identityFit' | 'evidenceStrength' | 'consistency' | 'differentiation' | 'futureAlignment' | 'scalability',
  string
> = {
  identityFit: 'Identity fit',
  evidenceStrength: 'Evidence strength',
  consistency: 'Consistency',
  differentiation: 'Differentiation',
  futureAlignment: 'Future alignment',
  scalability: 'Scalability',
};

const TABS = [
  { key: 'direction', label: 'Direction' },
  { key: 'narrative', label: 'Narrative' },
  { key: 'positioning', label: 'Positioning' },
  { key: 'portfolio', label: 'Portfolio' },
  { key: 'differentiation', label: 'Differentiation' },
  { key: 'roadmap', label: 'Roadmap' },
] as const;

export function StrategyRecommendationReport({
  applicationId,
  recommendation,
}: {
  applicationId: string;
  recommendation: StrategyRecommendationRecord;
}) {
  const { t } = useLanguage();
  const { active, setActive } = useReportTabs(TABS);

  return (
    <div className="flex flex-col gap-gb-3xl">
      <header className="flex flex-wrap items-center justify-between gap-gb-xl">
        <div className="flex flex-col gap-gb-xs">
          <h1 className="font-display text-gb-display-sm font-semibold text-fg">
            {t('Your Personalized Strategy')}
          </h1>
          <p className="text-gb-sm text-fg-tertiary">{formatDate(recommendation.createdAt)}</p>
        </div>
        <DownloadPdfButton applicationId={applicationId} />
      </header>

      <ReportTabs
        tabs={TABS}
        active={active}
        onSelect={setActive}
        label={t('Strategy report sections')}
      />

      <ReportPanel tabKey={active}>
        {active === 'direction' ? <DirectionTab recommendation={recommendation} /> : null}
        {active === 'narrative' ? <NarrativeTab recommendation={recommendation} /> : null}
        {active === 'positioning' ? <PositioningTab recommendation={recommendation} /> : null}
        {active === 'portfolio' ? <PortfolioTab recommendation={recommendation} /> : null}
        {active === 'differentiation' ? <DifferentiationTab recommendation={recommendation} /> : null}
        {active === 'roadmap' ? (
          <RoadmapTab applicationId={applicationId} recommendation={recommendation} />
        ) : null}
      </ReportPanel>
    </div>
  );
}

function DirectionTab({ recommendation }: { recommendation: StrategyRecommendationRecord }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-gb-2xl">
      <section className="flex flex-col gap-gb-md">
        <h2 className="text-gb-lg font-semibold text-fg">{t('Why this direction')}</h2>
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {recommendation.chosenDirectionWhy}
        </p>
      </section>

      <div className="grid gap-gb-xl sm:grid-cols-2">
        {recommendation.directionOptions.map((option) => (
          <DirectionCard
            key={option.name}
            option={option}
            isChosen={option.name === recommendation.chosenDirection}
          />
        ))}
      </div>
    </div>
  );
}

function DirectionCard({ option, isChosen }: { option: DirectionOption; isChosen: boolean }) {
  const { t } = useLanguage();
  const dimensionKeys = Object.keys(DIMENSION_LABEL) as Array<keyof typeof DIMENSION_LABEL>;

  return (
    <Panel
      as="article"
      className={`flex flex-col gap-gb-lg${isChosen ? ' ring-2 ring-brand' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-gb-md">
        <h3 className="text-gb-md font-semibold text-fg">{option.name}</h3>
        {isChosen ? <Badge variant="brand-chip">{t('Recommended')}</Badge> : null}
      </div>
      <ScoreRing value={option.overall * 10} measure="match" label={t('Overall')} size="sm" />
      <dl className="grid grid-cols-2 gap-gb-md">
        {dimensionKeys.map((key) => (
          <div key={key} className="flex flex-col gap-gb-xxs">
            <dt className="text-gb-xs text-fg-tertiary">{t(DIMENSION_LABEL[key])}</dt>
            <dd className="text-gb-sm font-medium text-fg">{option[key].toFixed(1)}/10</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function NarrativeTab({ recommendation }: { recommendation: StrategyRecommendationRecord }) {
  const { t } = useLanguage();
  return (
    <section className="flex flex-col gap-gb-md">
      <h2 className="text-gb-lg font-semibold text-fg">
        {t('Your story, retold through this direction')}
      </h2>
      <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
        {recommendation.narrative}
      </p>
    </section>
  );
}

function PositioningTab({ recommendation }: { recommendation: StrategyRecommendationRecord }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="grid gap-gb-xl sm:grid-cols-2">
        <Panel className="flex flex-col gap-gb-md">
          <h3 className="text-gb-sm font-semibold text-fg-tertiary">{t('Before')}</h3>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {recommendation.positioningBefore}
          </p>
        </Panel>
        <Panel className="flex flex-col gap-gb-md ring-2 ring-brand">
          <h3 className="text-gb-sm font-semibold text-fg-brand">{t('After')}</h3>
          <p className="text-gb-sm leading-relaxed text-fg-secondary">
            {recommendation.positioningAfter}
          </p>
        </Panel>
      </div>
      <section className="flex flex-col gap-gb-md">
        <h2 className="text-gb-lg font-semibold text-fg">{t('Why this is stronger')}</h2>
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {recommendation.positioningRationale}
        </p>
      </section>
    </div>
  );
}

function PortfolioTab({ recommendation }: { recommendation: StrategyRecommendationRecord }) {
  const { t } = useLanguage();
  return (
    <ul className="flex flex-col gap-gb-md">
      {recommendation.portfolioEvaluations.map((item) => (
        <li key={item.name}>
          <Panel padding="sm" elevation="flat" className="flex flex-col gap-gb-sm">
            <div className="flex flex-wrap items-center justify-between gap-gb-md">
              <p className="text-gb-sm font-semibold text-fg">{item.name}</p>
              <div className="flex flex-wrap items-center gap-gb-xs">
                <Badge variant="neutral">{t(SOURCE_LABEL[item.source])}</Badge>
                <Badge variant={RECOMMENDATION_VARIANT[item.recommendation]}>
                  {t(RECOMMENDATION_LABEL[item.recommendation])}
                </Badge>
              </div>
            </div>
            <p className="text-gb-sm text-fg-secondary">{item.strategicContribution}</p>
          </Panel>
        </li>
      ))}
    </ul>
  );
}

function DifferentiationTab({ recommendation }: { recommendation: StrategyRecommendationRecord }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col gap-gb-2xl">
      <section className="flex flex-col gap-gb-md">
        <h2 className="text-gb-lg font-semibold text-fg">
          {t('The crowded pattern you currently resemble')}
        </h2>
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {recommendation.differentiationInsight}
        </p>
      </section>
      <section className="flex flex-col gap-gb-md">
        <h2 className="text-gb-lg font-semibold text-fg">{t('How to stand out')}</h2>
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {recommendation.differentiationProposal}
        </p>
      </section>
    </div>
  );
}

function RoadmapTab({
  applicationId,
  recommendation,
}: {
  applicationId: string;
  recommendation: StrategyRecommendationRecord;
}) {
  const { t } = useLanguage();
  const { roadmap } = recommendation;
  return (
    <div className="flex flex-col gap-gb-2xl">
      <section className="flex flex-col gap-gb-md">
        <h2 className="text-gb-lg font-semibold text-fg">{roadmap.chosenStrategy}</h2>
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">{roadmap.why}</p>
      </section>
      <div className="grid gap-gb-xl sm:grid-cols-2">
        <ChecklistSection heading={t('Prioritize')} items={roadmap.prioritize} />
        <ChecklistSection heading={t('Avoid')} items={roadmap.avoid} />
      </div>
      <section className="flex flex-col gap-gb-md">
        <h2 className="text-gb-lg font-semibold text-fg">{t('Expected positioning')}</h2>
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {roadmap.expectedPositioning}
        </p>
      </section>
      <section className="flex flex-col gap-gb-md">
        <h2 className="text-gb-lg font-semibold text-fg">{t('Long-term narrative')}</h2>
        <p className="max-w-2xl text-gb-sm leading-relaxed text-fg-secondary">
          {roadmap.longTermNarrative}
        </p>
      </section>
      <AddToPlannerCard applicationId={applicationId} />
    </div>
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
