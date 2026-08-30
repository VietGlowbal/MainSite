'use client';

import { useT } from '@/lib/i18n';
import type { PersonalPositioningSection, PersonalReportAnalytics, PersonalReportV2, PositioningDimensionKey } from '../../domain';
import { Badge, RadarChart } from '@/shared/ui';
import { InsufficientDataCard, SectionShell } from './shared';

const DIMENSION_LABEL: Record<PositioningDimensionKey, string> = {
  authenticity: 'Authenticity',
  differentiation: 'Differentiation',
  coherence: 'Coherence',
  directionAlignment: 'Direction alignment',
  credibility: 'Credibility',
};

function PositioningTrait({ label, value }: { label: string; value: boolean }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-gb-md rounded-gb-md border border-line px-gb-lg py-gb-sm">
      <span className="text-gb-sm text-fg-tertiary">{label}</span>
      <Badge variant={value ? 'safe-chip' : 'neutral-chip'}>{value ? t('Yes') : t('Not yet')}</Badge>
    </div>
  );
}

export function PersonalPositioningView({
  section,
  report,
  positioningDimensions,
  returnTo,
}: {
  section: PersonalPositioningSection;
  report?: PersonalReportV2;
  /** Undefined for a report version generated before analytics existed — see `PersonalReportV2.analytics`. */
  positioningDimensions: PersonalReportAnalytics['positioningDimensions'] | undefined;
  returnTo: string | undefined;
}) {
  const t = useT();
  return (
    <SectionShell
      eyebrow={t('Personal Positioning')}
      title={t('An evidence-grounded positioning statement')}
      confidence={section.confidence}
    >
      {section.available ? (
        <div className="flex flex-col gap-gb-xl" data-no-auto-translate>
          <div className="rounded-gb-xl border border-line bg-surface p-6 sm:p-7 shadow-xs">
            <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Profile narrative')}</p>
            <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">{report?.narrativeDetails?.profilePositioning?.profileNarrative ?? section.statement}</p>
            {report?.narrativeDetails?.profilePositioning?.positioningOptions.length ? (
              <div className="mt-gb-lg flex flex-col gap-gb-sm border-t border-line/60 pt-gb-md">
                <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-muted">{t('Positioning options')}</p>
                {report.narrativeDetails.profilePositioning.positioningOptions.map((option) => (
                  <div key={option.title} className="rounded-gb-lg border border-line/50 bg-surface-muted/60 p-gb-md text-gb-sm leading-relaxed text-fg-secondary">
                    <span className="font-bold text-fg">{option.title}:</span> {option.statement}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="mt-gb-md text-gb-xs font-medium text-fg-muted">
              {t('{count} linked evidence references · {confidenceLabel}: {confidence}', {
                count: section.evidenceRefs.length,
                confidenceLabel: t('confidence'),
                confidence: section.confidence,
              })}
            </p>
          </div>
          {positioningDimensions ? (
            <div className="flex flex-col gap-gb-md rounded-gb-xl border border-line bg-surface p-6 sm:p-7 shadow-xs">
              <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">
                {t('Motivation and direction profile')}
              </p>
              <div className="flex justify-center py-gb-sm">
                <RadarChart
                  ariaLabel={t('Motivation and direction profile')}
                  data={positioningDimensions.map((dimension) => ({
                    key: dimension.key,
                    label: t(DIMENSION_LABEL[dimension.key]),
                    value: dimension.score,
                  }))}
                />
              </div>
            </div>
          ) : null}
          <div className="grid gap-gb-md sm:grid-cols-2 lg:grid-cols-3">
            <PositioningTrait label={t('Authentic')} value={section.authentic} />
            <PositioningTrait label={t('Differentiated')} value={section.differentiated} />
            <PositioningTrait label={t('Coherent')} value={section.coherent} />
            <PositioningTrait label={t('Direction aligned')} value={section.directionAligned} />
            <PositioningTrait label={t('Credible')} value={section.credible} />
          </div>
          {section.whyThisFits.length > 0 || report?.narrativeDetails?.profilePositioning?.experienceConnection ? (
            <div className="flex flex-col gap-gb-sm rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
              <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Experience connection')}</p>
              {report?.narrativeDetails?.profilePositioning?.experienceConnection ? (
                <div className="rounded-gb-lg border border-line/60 bg-surface-muted/60 p-gb-lg">
                  <p className="text-gb-base font-bold text-fg">{report.narrativeDetails.profilePositioning.experienceConnection.strongestProfileThread}</p>
                  <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">{report.narrativeDetails.profilePositioning.experienceConnection.connectionExplanation}</p>
                  <p className="mt-gb-sm text-gb-xs font-medium text-fg-muted">{t('{count} supporting experiences', { count: report.narrativeDetails.profilePositioning.experienceConnection.supportingExperienceCount })}</p>
                </div>
              ) : (
                <ul className="flex list-disc flex-col gap-gb-sm pl-gb-xl text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
                  {section.whyThisFits.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              )}
            </div>
          ) : null}
          {section.whatPreventsStrongerPositioning.length > 0 ? (
            <div className="flex flex-col gap-gb-sm rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
              <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">
                {t('What prevents stronger positioning')}
              </p>
              <ul className="flex list-disc flex-col gap-gb-sm pl-gb-xl text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
                {section.whatPreventsStrongerPositioning.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} returnTo={returnTo} />
      )}
    </SectionShell>
  );
}
