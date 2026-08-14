'use client';

import { useT } from '@/lib/i18n';
import type { PersonalReportAnalytics, ReportOverview } from '../../domain';
import { HorizontalBarChart, RadarChart } from '@/shared/ui';
import { SectionShell } from './shared';

/**
 * "Profile at a glance" — the synopsis + two report-wide charts at the top
 * of the report (implementation spec §5, §6, §7). Both charts read
 * straight from `PersonalReportV2.analytics`, never recomputed here; the
 * whole section renders nothing for a report version generated before
 * analytics existed, rather than a broken chart.
 */
export function ProfileAtAGlanceView({
  overview,
  analytics,
}: {
  overview: ReportOverview | null | undefined;
  analytics: PersonalReportAnalytics | undefined;
}) {
  const t = useT();
  if (!overview && !analytics) return null;

  return (
    <SectionShell eyebrow={t('Profile at a glance')} title={t('Profile at a glance')}>
      {overview ? (
        <p className="text-gb-md leading-relaxed text-fg" data-no-auto-translate>
          {overview.summary}
        </p>
      ) : null}
      {analytics ? (
        <div className="grid gap-gb-2xl md:grid-cols-2">
          <div className="flex flex-col gap-gb-md">
            <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
              {t('Competency & evidence profile')}
            </p>
            <RadarChart
              ariaLabel={t('Competency & evidence profile')}
              data={analytics.competencyEvidenceProfile.map((metric) => ({
                key: metric.key,
                label: t(metric.label),
                value: metric.score,
              }))}
            />
          </div>
          <div className="flex flex-col gap-gb-md">
            <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
              {t('Narrative identity signals')}
            </p>
            <HorizontalBarChart
              ariaLabel={t('Narrative identity signals')}
              data={analytics.narrativeIdentitySignals.map((metric) => ({
                key: metric.key,
                label: t(metric.label),
                value: metric.score,
                caption: metric.explanation ? t(metric.explanation) : undefined,
              }))}
            />
          </div>
        </div>
      ) : null}
    </SectionShell>
  );
}
