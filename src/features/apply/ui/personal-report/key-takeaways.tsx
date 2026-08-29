'use client';

import type { PersonalReportInsight, PersonalReportV2 } from '../../domain';
import { useT } from '@/lib/i18n';

function firstUseful(values: Array<string | null | undefined>, fallback: string): string {
  return values.find((value) => Boolean(value?.trim()))?.trim() ?? fallback;
}

function TakeawayCard({ title, insight, finding }: { title: string; insight: string; finding?: PersonalReportInsight }) {
  const t = useT();
  return (
    <article className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface p-gb-xl">
      <div className="flex items-start gap-gb-md">
        <span aria-hidden="true" className="text-gb-xl leading-none text-fg-brand">★</span>
        <div className="flex flex-col gap-gb-sm">
          <h3 className="font-display text-gb-lg font-semibold text-fg">{title}</h3>
          <p className="text-gb-sm leading-relaxed text-fg-tertiary" data-no-auto-translate>
            {insight}
          </p>
          {finding ? (
            <div className="flex flex-col gap-gb-xs border-t border-line pt-gb-md text-gb-xs text-fg-muted" data-no-auto-translate>
              <p>
                <span className="font-semibold text-fg">{t('Evidence basis')}:</span>{' '}
                {t('{scope} signal · {count} linked evidence references · {confidence} confidence', {
                  scope: t(finding.scope === 'repeated' ? 'Repeated' : finding.scope === 'isolated' ? 'Isolated' : 'Insufficient'),
                  count: finding.evidenceIds.length,
                  confidence: t(finding.confidence === 'high' ? 'High' : finding.confidence === 'medium' ? 'Medium' : 'Low'),
                })}
              </p>
              {finding.importance || finding.currentGap ? (
                <p>
                  <span className="font-semibold text-fg">{t('Why it matters')}:</span>{' '}
                  {finding.importance ?? finding.currentGap}
                </p>
              ) : null}
              {finding.direction ? (
                <p>
                  <span className="font-semibold text-fg">{t('Recommended direction')}:</span> {finding.direction}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/**
 * Closing summary built only from findings already present in the stored
 * report. These are editorial shortcuts into the report, not new model
 * conclusions, which keeps older report versions safe and explainable.
 */
export function KeyTakeawaysView({ report }: { report: PersonalReportV2 }) {
  const structured = report.keyTakeaways;
  const narrative = report.narrativeDetails?.keyTakeaways;
  const standOut = firstUseful(
    [report.signaturePattern.distinctiveness, report.coreIdentity.interpretation, report.coreIdentity.headline],
    'Your strongest differentiator will become clearer as you add more reflected experiences.',
  );
  const advantage = firstUseful(
    [report.personalPositioning.statement, report.overallSummary?.paragraphs[0]],
    'Your competitive advantage is still emerging from the evidence currently available.',
  );
  const growth = firstUseful(
    [
      report.personalPositioning.whatPreventsStrongerPositioning[0],
      report.coreIdentity.stillDeveloping[0],
      report.emergingThemes.themes[0]?.limitation,
    ],
    'Continue adding specific evidence so emerging strengths can be separated from areas that genuinely need development.',
  );

  return (
    <section aria-labelledby="key-takeaways-title" className="flex flex-col gap-gb-xl border-t border-line pt-gb-3xl">
      <div className="flex max-w-2xl flex-col gap-gb-sm">
        <p className="text-gb-xs font-semibold uppercase tracking-[0.14em] text-fg-brand">Key Takeaways</p>
        <h2
          id="key-takeaways-title"
          className="font-display text-gb-display-sm font-semibold tracking-gb-display-tight text-fg"
        >
          What to remember before you build the application
        </h2>
        <p className="text-gb-sm leading-relaxed text-fg-tertiary">
          Three evidence-backed ideas to carry into your positioning, university matching and application strategy.
        </p>
      </div>

      <div className="grid gap-gb-lg md:grid-cols-3">
        <TakeawayCard
          title="What Makes You Stand Out"
          insight={narrative?.whatMakesYouStandOut.insight ?? structured?.whatMakesYouStandOut.statement ?? standOut}
          {...(structured?.whatMakesYouStandOut ? { finding: structured.whatMakesYouStandOut } : {})}
        />
        <TakeawayCard
          title="Your Competitive Advantage"
          insight={narrative?.competitiveAdvantage.advantageStatement ?? structured?.competitiveAdvantage.statement ?? advantage}
          {...(structured?.competitiveAdvantage ? { finding: structured.competitiveAdvantage } : {})}
        />
        <TakeawayCard
          title="Your Growth Opportunity"
          insight={narrative?.growthOpportunity.recommendedDirection ?? structured?.growthOpportunity.statement ?? growth}
          {...(structured?.growthOpportunity ? { finding: structured.growthOpportunity } : {})}
        />
      </div>
    </section>
  );
}
