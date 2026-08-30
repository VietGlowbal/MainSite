'use client';

import { useT } from '@/lib/i18n';
import type { PersonalReportV2 } from '../../domain';
import type {
  CapabilityRating,
  FuturePathway,
  GrowthPriority,
  PersonalCanvasDetails,
} from '../../domain/personal-canvas-details';
import { Badge, HorizontalBarChart, RadarChart } from '@/shared/ui';
import {
  CapabilityProfileView as LegacyCapabilityProfileView,
  FuturePathwaysView as LegacyFuturePathwaysView,
  GrowthMatrixView as LegacyGrowthMatrixView,
  MotivationProfileView as LegacyMotivationProfileView,
  SocialProofSummaryView as LegacySocialProofSummaryView,
} from './personal-report-insights';

type ReportWithCanvasDetails = PersonalReportV2 & { canvasDetails?: PersonalCanvasDetails };

function detailsFor(report: PersonalReportV2): PersonalCanvasDetails | undefined {
  return (report as ReportWithCanvasDetails).canvasDetails;
}

const BAND_LABEL: Record<CapabilityRating['band'], string> = {
  very_strong: 'Very strong evidence',
  strong: 'Strong evidence',
  consistent: 'Consistent evidence',
  emerging: 'Emerging evidence',
  limited: 'Limited evidence',
};

function confidenceLabel(confidence: CapabilityRating['confidence']): string {
  return confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Medium confidence' : 'Low confidence';
}

function Stars({ stars }: { stars: CapabilityRating['stars'] }) {
  return (
    <span
      aria-label={`${stars} out of 5 evidence stars`}
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-gb-sm tracking-[0.12em] text-fg-brand shadow-2xs"
    >
      <span aria-hidden="true">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
    </span>
  );
}

export function SnapshotCapabilityProfileView({ report }: { report: PersonalReportV2 }) {
  const t = useT();
  const details = detailsFor(report);
  if (!details) return <LegacyCapabilityProfileView report={report} />;
  if (details.capabilities.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-2xl">
      <div className="grid gap-gb-2xl lg:grid-cols-12">
        <div className="flex flex-col justify-between gap-gb-lg rounded-gb-xl border border-line bg-surface p-6 sm:p-7 shadow-xs lg:col-span-5">
          <div>
            <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">
              {t('Capability profile')}
            </p>
            <h3 className="mt-gb-xs text-gb-lg sm:text-gb-xl font-bold text-fg">
              {t('Capability overview')}
            </h3>
            <p className="mt-gb-sm text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
              {report.narrativeDetails?.provenCapabilities?.overview ?? t('The clearest capabilities in this snapshot are {capabilities}. They are grounded in {count} recorded experiences.', {
                capabilities: details.capabilities.slice(0, 3).map((capability) => capability.name).join(', '),
                count: new Set(details.capabilities.flatMap((capability) => capability.supportingEvidence.map((evidence) => evidence.activityId))).size,
              })}
            </p>
            <p className="mt-gb-sm text-gb-xs sm:text-gb-sm leading-relaxed text-fg-tertiary">
              {t('The strongest named capabilities in this report snapshot. Scores represent strength of supporting evidence, not an ability ceiling.')}
            </p>
          </div>
          <div className="flex justify-center py-gb-sm">
            <RadarChart
              ariaLabel="Named capability evidence profile"
              data={details.capabilities.map((capability) => ({
                key: capability.name.toLowerCase().replace(/\s+/g, '-'),
                label: capability.name,
                value: capability.score,
              }))}
            />
          </div>
        </div>

        <div className="grid gap-gb-lg sm:grid-cols-1 xl:grid-cols-2 lg:col-span-7">
          {details.capabilities.map((capability) => {
            const narrativeCap = report.narrativeDetails?.provenCapabilities?.capabilities.find(
              (item) => item.capability.toLowerCase() === capability.name.toLowerCase(),
            );
            const howDemonstrated = narrativeCap?.howDemonstrated ?? capability.why;
            const whyItMatters = narrativeCap?.whyItMatters;

            return (
              <article
                key={capability.name}
                className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface p-6 shadow-xs transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-gb-sm">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-gb-base sm:text-gb-md font-bold text-fg leading-snug" data-no-auto-translate>
                      {capability.name}
                    </h3>
                    <p className="mt-0.5 text-gb-xs font-medium text-fg-muted">
                      {BAND_LABEL[capability.band]}
                    </p>
                  </div>
                  <Stars stars={capability.stars} />
                </div>

                <p className="text-gb-sm leading-relaxed text-fg-secondary">
                  {howDemonstrated}
                </p>

                {whyItMatters ? (
                  <div className="rounded-gb-lg border border-line/60 bg-surface-muted/70 p-gb-md">
                    <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">
                      {t('Why it matters')}
                    </p>
                    <p className="mt-1 text-gb-xs sm:text-gb-sm leading-relaxed text-fg-secondary">
                      {whyItMatters}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-gb-xs">
                  <Badge variant="neutral-chip">
                    {capability.evidenceCount} {capability.evidenceCount === 1 ? t('experience') : t('experiences')}
                  </Badge>
                  <Badge variant="neutral-chip">{confidenceLabel(capability.confidence)}</Badge>
                  {capability.verifiedEvidenceCount > 0 ? (
                    <Badge variant="safe-chip">{capability.verifiedEvidenceCount} {t('verified')}</Badge>
                  ) : null}
                </div>

                {capability.supportingEvidence.length > 0 ? (
                  <div className="mt-auto border-t border-line/80 pt-gb-md">
                    <p className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">
                      {t('Supporting evidence')}
                    </p>
                    <ul className="mt-gb-sm flex flex-col gap-gb-xs text-gb-xs text-fg-tertiary" data-no-auto-translate>
                      {capability.supportingEvidence.map((evidence) => (
                        <li key={evidence.activityId} className="flex items-start justify-between gap-gb-sm">
                          <span className="font-medium text-fg-secondary">{evidence.title}</span>
                          <span className="shrink-0 font-medium text-fg-muted">{evidence.evidenceStrength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
      <div className="rounded-gb-xl border border-line bg-surface-muted/60 p-6 sm:p-7">
        <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('How these capabilities combine')}</p>
        <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">{report.narrativeDetails?.provenCapabilities?.combinationInsight ?? t('This profile shows how the named capabilities overlap across the same evidence record. The combination is more informative than any single score and remains bounded by the supporting activities shown above.')}</p>
      </div>
      <p className="text-gb-xs text-fg-muted">
        {t('Rating rule: recurrence + evidence quality + verification + recorded outcomes. One activity cannot receive more than 3 stars; two cannot receive 5 stars.')}
      </p>
    </div>
  );
}

export function SnapshotMotivationProfileView({ report }: { report: PersonalReportV2 }) {
  const details = detailsFor(report);
  if (!details) return <LegacyMotivationProfileView report={report} />;
  if (details.motivations.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-xl rounded-gb-xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
      <div className="flex flex-col gap-gb-xs">
        <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Motivation profile</p>
        <h3 className="text-gb-lg sm:text-gb-xl font-bold text-fg">What repeatedly appears in your stated motivations</h3>
        <p className="text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
          These bars show recurrence across motivations you explicitly recorded. They are not personality scores.
        </p>
      </div>
      <HorizontalBarChart
        ariaLabel="Repeated stated motivations"
        data={details.motivations.map((motivation) => ({
          key: motivation.label.toLowerCase().replace(/\s+/g, '-'),
          label: motivation.label,
          value: motivation.score,
          caption: `${motivation.evidenceCount} supporting reflection${motivation.evidenceCount === 1 ? '' : 's'} · ${confidenceLabel(motivation.confidence)}`,
        }))}
      />
    </div>
  );
}

export function SnapshotSocialProofSummaryView({ report }: { report: PersonalReportV2 }) {
  const t = useT();
  const details = detailsFor(report);
  if (!details) return <LegacySocialProofSummaryView report={report} />;
  if (details.socialProof.every((metric) => metric.value === 0)) return null;

  const activities = details.socialProof.find((metric) => metric.key === 'activities')?.value ?? 0;
  const quantified = details.socialProof.find((metric) => metric.key === 'quantifiedOutcomes')?.value ?? 0;
  const verified = details.socialProof.find((metric) => metric.key === 'verifiedEvidence')?.value ?? 0;
  return (
    <div className="flex flex-col gap-gb-xl">
      <div className="grid gap-gb-lg sm:grid-cols-2 lg:grid-cols-3">
        {details.socialProof.map((metric) => (
          <div key={metric.key} className="flex flex-col justify-between rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
            <div>
              <p className="font-display text-gb-display-sm sm:text-gb-display-md font-bold text-fg-brand">{metric.value}</p>
              <p className="mt-gb-xs text-gb-base font-bold text-fg">{t(metric.label)}</p>
            </div>
            <p className="mt-2 text-gb-xs sm:text-gb-sm text-fg-tertiary leading-relaxed">{t(metric.caption)}</p>
          </div>
        ))}
      </div>
      <div className="rounded-gb-xl border border-line bg-surface-muted/60 p-6 sm:p-7" data-no-auto-translate>
        <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('What the numbers suggest')}</p>
        <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
          {report.narrativeDetails?.socialProof?.conclusion ?? t('The current record contains {activities} recorded experiences; {quantified} include quantified outcomes and {verified} are verified or checkable. These counts describe the evidence base, not an admissions prediction.', {
            activities,
            quantified,
            verified,
          })}
        </p>
      </div>
    </div>
  );
}

function formatImpactLabel(impact: 'high' | 'medium' | 'low', t: (s: string) => string) {
  if (impact === 'high') return t('High impact');
  if (impact === 'medium') return t('Medium impact');
  return t('Low impact');
}

function formatEffortLabel(effort: 'high' | 'medium' | 'low', t: (s: string) => string) {
  if (effort === 'high') return t('High effort');
  if (effort === 'medium') return t('Medium effort');
  return t('Low effort');
}

function MatrixQuadrant({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: GrowthPriority[];
}) {
  const t = useT();
  return (
    <div className="flex min-h-48 flex-col rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
      <p className="text-gb-base font-bold text-fg">{title}</p>
      <p className="text-gb-xs text-fg-muted">{subtitle}</p>
      <div className="mt-gb-md flex flex-1 flex-col gap-gb-sm">
        {items.length === 0 ? (
          <p className="my-auto rounded-gb-md bg-surface-muted px-gb-md py-gb-sm text-gb-xs text-fg-muted">
            {t('No current priority in this quadrant.')}
          </p>
        ) : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-gb-md border border-line/50 bg-surface-muted/80 px-gb-md py-gb-sm">
            <p className="text-gb-sm font-semibold text-fg">{t(item.title)}</p>
            <p className="text-gb-xs text-fg-tertiary">{t(item.source)} {t('signal')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SnapshotGrowthMatrixView({ report }: { report: PersonalReportV2 }) {
  const t = useT();
  const details = detailsFor(report);
  if (!details) return <LegacyGrowthMatrixView report={report} />;
  const items = details.growthPriorities;
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-xl rounded-gb-xl border border-line bg-surface p-6 sm:p-8 shadow-xs">
      <div>
        <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Growth priority matrix')}</p>
        <h3 className="mt-gb-xs text-gb-lg sm:text-gb-xl font-bold text-fg">{t('Where additional evidence could strengthen your profile')}</h3>
        <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
          {t('Impact reflects how central the current gap is to your personal profile. Effort estimates whether it can be improved by clarifying current evidence or needs new experiences.')}
        </p>
      </div>
      <div className="grid gap-gb-lg md:grid-cols-2">
        <MatrixQuadrant title={t('Quick wins')} subtitle={t('High impact · Low/medium effort')} items={items.filter((item) => item.impact === 'high' && item.effort !== 'high')} />
        <MatrixQuadrant title={t('Major investments')} subtitle={t('High impact · High effort')} items={items.filter((item) => item.impact === 'high' && item.effort === 'high')} />
        <MatrixQuadrant title={t('Useful additions')} subtitle={t('Medium impact · Low/medium effort')} items={items.filter((item) => item.impact === 'medium' && item.effort !== 'high')} />
        <MatrixQuadrant title={t('Longer-term depth')} subtitle={t('Medium impact · High effort')} items={items.filter((item) => item.impact === 'medium' && item.effort === 'high')} />
      </div>
      <div className="grid gap-gb-lg sm:grid-cols-2">
        {items.map((item) => (
          <article key={item.id} className="flex flex-col gap-gb-sm rounded-gb-xl border border-line/60 bg-surface-muted/70 p-6">
            <div className="flex flex-wrap items-center gap-gb-xs">
              <Badge variant="neutral-chip">{formatImpactLabel(item.impact, t)}</Badge>
              <Badge variant="neutral-chip">{formatEffortLabel(item.effort, t)}</Badge>
            </div>
            <h4 className="mt-gb-xs text-gb-base font-bold text-fg">{t(item.title)}</h4>
            <p className="text-gb-sm leading-relaxed text-fg-secondary" data-no-auto-translate>{item.gap}</p>
            <div className="mt-auto border-t border-line/60 pt-gb-sm">
              <p className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">{t('Suggested direction')}</p>
              <p className="mt-1 text-gb-sm leading-relaxed text-fg-secondary">{t(item.suggestedDirection)}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PathwayCard({ pathway }: { pathway: FuturePathway }) {
  return (
    <article className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
      <div className="flex items-start justify-between gap-gb-md">
        <h3 className="text-gb-base sm:text-gb-md font-bold text-fg" data-no-auto-translate>{pathway.label}</h3>
        <Badge variant={pathway.isStatedDirection ? 'brand-chip' : pathway.confidence === 'high' ? 'safe-chip' : 'neutral-chip'}>
          {pathway.statusLabel}
        </Badge>
      </div>
      <p className="text-gb-sm leading-relaxed text-fg-secondary" data-no-auto-translate>{pathway.rationale}</p>
      {pathway.supportingExperiences.length > 0 ? (
        <div className="mt-auto border-t border-line/60 pt-gb-sm">
          <p className="text-gb-xs font-semibold uppercase tracking-wider text-fg-muted">Supported by</p>
          <div className="mt-gb-xs flex flex-wrap gap-gb-xs" data-no-auto-translate>
            {pathway.supportingExperiences.map((experience) => (
              <Badge key={experience} variant="brand-chip">{experience}</Badge>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function SnapshotFuturePathwaysView({ report }: { report: PersonalReportV2 }) {
  const details = detailsFor(report);
  if (!details) return <LegacyFuturePathwaysView report={report} />;
  if (details.futurePathways.length === 0) return null;

  return (
    <div className="flex flex-col gap-gb-xl">
      <div>
        <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">Possible future directions</p>
        <h3 className="mt-gb-xs text-gb-lg sm:text-gb-xl font-bold text-fg">Exploring Potential Pathways</h3>
        <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
          Your stated direction is separated from evidence-backed emerging themes. The latter are possibilities to explore, not career predictions.
        </p>
      </div>
      <div className="grid gap-gb-lg sm:grid-cols-2">
        {details.futurePathways.map((pathway) => <PathwayCard key={`${pathway.isStatedDirection ? 'stated' : 'theme'}-${pathway.label}`} pathway={pathway} />)}
      </div>
    </div>
  );
}
