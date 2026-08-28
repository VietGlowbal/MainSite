'use client';

import { useT } from '@/lib/i18n';
import type { PersonalPositioningSection, PersonalReportAnalytics, PositioningDimensionKey } from '../../domain';
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
  positioningDimensions,
  returnTo,
}: {
  section: PersonalPositioningSection;
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
        <div className="flex flex-col gap-gb-xl">
          <div className="rounded-gb-xl bg-surface-muted p-gb-lg" data-no-auto-translate>
            <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Profile narrative')}</p>
            <p className="mt-gb-xs text-gb-sm leading-relaxed text-fg-tertiary">{section.statement}</p>
            <p className="mt-gb-sm text-gb-xs text-fg-muted">
              {t('{count} linked evidence references · {confidenceLabel}: {confidence}', {
                count: section.evidenceRefs.length,
                confidenceLabel: t('confidence'),
                confidence: section.confidence,
              })}
            </p>
          </div>
          {positioningDimensions ? (
            <div className="flex flex-col gap-gb-md">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('Motivation and direction profile')}
              </p>
              <RadarChart
                ariaLabel={t('Motivation and direction profile')}
                data={positioningDimensions.map((dimension) => ({
                  key: dimension.key,
                  label: t(DIMENSION_LABEL[dimension.key]),
                  value: dimension.score,
                }))}
              />
            </div>
          ) : null}
          <div className="grid gap-gb-sm sm:grid-cols-2">
            <PositioningTrait label={t('Authentic')} value={section.authentic} />
            <PositioningTrait label={t('Differentiated')} value={section.differentiated} />
            <PositioningTrait label={t('Coherent')} value={section.coherent} />
            <PositioningTrait label={t('Direction aligned')} value={section.directionAligned} />
            <PositioningTrait label={t('Credible')} value={section.credible} />
          </div>
          {section.whyThisFits.length > 0 ? (
            <div className="flex flex-col gap-gb-sm">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Experience connection')}</p>
              <ul className="flex list-disc flex-col gap-gb-xs pl-gb-xl text-gb-sm text-fg-tertiary" data-no-auto-translate>
                {section.whyThisFits.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {section.whatPreventsStrongerPositioning.length > 0 ? (
            <div className="flex flex-col gap-gb-sm">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('What prevents stronger positioning')}
              </p>
              <ul className="flex list-disc flex-col gap-gb-xs pl-gb-xl text-gb-sm text-fg-tertiary" data-no-auto-translate>
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
