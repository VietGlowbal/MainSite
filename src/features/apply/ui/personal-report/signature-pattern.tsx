'use client';

import { useT } from '@/lib/i18n';
import type { PersonalReportAnalytics, SignaturePatternSection } from '../../domain';
import { HorizontalBarChart } from '@/shared/ui';
import { InsufficientDataCard, SectionShell } from './shared';

export function SignaturePatternView({
  section,
  patternSupport,
  returnTo,
}: {
  section: SignaturePatternSection;
  /** Undefined for a report version generated before analytics existed — see `PersonalReportV2.analytics`. */
  patternSupport: PersonalReportAnalytics['signaturePatternSupport'] | undefined;
  returnTo: string | undefined;
}) {
  const t = useT();
  return (
    <SectionShell
      eyebrow={t('Signature Pattern')}
      title={t('The behavioural sequence that repeats')}
      confidence={section.confidence}
    >
      {section.available ? (
        <div className="flex flex-col gap-gb-lg">
          <div className="flex flex-wrap items-center gap-gb-lg text-gb-sm text-fg-tertiary" data-no-auto-translate>
            <span>
              {t('Pattern strength')}:{' '}
              {section.patternStrength === 'established' ? t('Established') : t('Emerging')}
            </span>
            <span>
              {t('{count} supporting experiences', { count: section.supportingExperienceCount })}
            </span>
          </div>
          <div className="grid gap-gb-lg sm:grid-cols-2" data-no-auto-translate>
            {section.steps.map((step, index) => (
              <div key={step.key} className="flex flex-col gap-gb-sm rounded-gb-xl border border-line p-gb-lg">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-brand">
                  {index + 1}. {step.label}
                </p>
                <p className="text-gb-sm text-fg">{step.description}</p>
                {step.examples.length > 0 ? (
                  <p className="text-gb-xs text-fg-muted">{step.examples.join(', ')}</p>
                ) : null}
              </div>
            ))}
          </div>
          {section.distinctiveness ? (
            <p className="text-gb-sm text-fg-tertiary" data-no-auto-translate>
              {section.distinctiveness}
            </p>
          ) : null}
          {patternSupport ? (
            <div className="flex flex-col gap-gb-md border-t border-line pt-gb-lg">
              <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                {t('Pattern frequency across activities')}
              </p>
              <HorizontalBarChart
                ariaLabel={t('Pattern frequency across activities')}
                data={patternSupport.map((item) => ({
                  key: item.key,
                  label: t(item.label),
                  value: item.strength,
                  caption: t('{count} linked activities', { count: item.evidenceCount }),
                }))}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <InsufficientDataCard data={section.insufficientData!} returnTo={returnTo} />
      )}
    </SectionShell>
  );
}
