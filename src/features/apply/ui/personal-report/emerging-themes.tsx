'use client';

import { useT } from '@/lib/i18n';
import type { EmergingThemesSection, PersonalReportAnalytics } from '../../domain';
import { Badge, HorizontalBarChart } from '@/shared/ui';
import { InsufficientDataCard, SectionShell } from './shared';

export function EmergingThemesView({
  section,
  themeMaturity,
  returnTo,
}: {
  section: EmergingThemesSection;
  /** Undefined for a report version generated before analytics existed — see `PersonalReportV2.analytics`. */
  themeMaturity: PersonalReportAnalytics['themeMaturity'] | undefined;
  returnTo: string | undefined;
}) {
  const t = useT();
  return (
    <SectionShell eyebrow={t('Emerging Themes')} title={t('What they keep returning to')}>
      {section.available ? (
        <div className="flex flex-col gap-gb-xl">
          {section.narrative ? (
            <p className="text-gb-sm leading-relaxed text-fg-tertiary" data-no-auto-translate>
              {section.narrative}
            </p>
          ) : null}
          {themeMaturity && themeMaturity.length > 0 ? (
            <div className="flex flex-col gap-gb-md" data-no-auto-translate>
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Theme maturity')}</p>
              <HorizontalBarChart
                ariaLabel={t('Theme maturity')}
                data={themeMaturity.map((theme) => ({
                  key: theme.theme,
                  label: theme.theme,
                  value: theme.maturityScore,
                  caption: t('{count} linked activities', { count: theme.evidenceCount }),
                }))}
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-gb-lg">
            {section.themes.map((theme) => (
              <div key={theme.theme} className="flex flex-col gap-gb-sm rounded-gb-xl border border-line p-gb-lg" data-no-auto-translate>
                <div className="flex flex-wrap items-center justify-between gap-gb-md">
                  <h3 className="text-gb-md font-semibold text-fg">{theme.theme}</h3>
                  <Badge variant="neutral-chip">{theme.statusLabel}</Badge>
                </div>
                <p className="text-gb-sm text-fg-tertiary">{theme.explanation}</p>
                {theme.supportingExperiences.length > 0 ? (
                  <p className="text-gb-xs text-fg-muted">{theme.supportingExperiences.join(', ')}</p>
                ) : null}
                <p className="text-gb-xs text-fg-muted">{theme.limitation}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} returnTo={returnTo} />
      )}
    </SectionShell>
  );
}
