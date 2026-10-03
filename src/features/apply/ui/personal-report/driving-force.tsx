'use client';

import { useT } from '@/lib/i18n';
import { STUDY_MOTIVATION_SUPPLEMENT_KEY, type DrivingForceSection, type PersonalReportV2 } from '../../domain';
import { Badge } from '@/shared/ui';
import { InlineAnswerAction, InsufficientDataCard, SectionShell } from './shared';

export function DrivingForceView({
  section,
  report,
  returnTo,
  onAnswered,
}: {
  section: DrivingForceSection;
  report?: PersonalReportV2;
  returnTo: string | undefined;
  /** Omitted while viewing a past version — answering a question only ever updates the latest one. */
  onAnswered?: (() => void) | undefined;
}) {
  const t = useT();
  const narrative = report?.narrativeDetails?.drivingForce;
  const components = [
    { key: 'primaryMotivation', label: t('Primary motivation'), value: narrative?.primaryMotivation || section.primaryMotivation, empty: t('Not established from the available evidence.') },
    { key: 'repeatedChoices', label: t('Repeated choices'), value: narrative?.repeatedChoices.length ? narrative.repeatedChoices : section.repeatedChoices, empty: t('No repeated opportunity choice is established yet.') },
    { key: 'recurringProblems', label: t('Recurring problems'), value: narrative?.recurringProblems.length ? narrative.recurringProblems : section.recurringProblems, empty: t('No recurring problem domain is established yet.') },
    { key: 'decisionMaking', label: t('Decision-making'), value: section.decisionMaking || narrative?.decisionMaking, empty: t('No decision-making pattern is established yet.') },
    { key: 'underlyingValues', label: t('Underlying values'), value: narrative?.underlyingValues.length ? narrative.underlyingValues : section.underlyingValues, empty: t('Values cannot be interpreted confidently yet.') },
    { key: 'strategicInterpretation', label: t('Strategic interpretation'), value: narrative?.strategicInterpretation || section.strategicInterpretation || section.explanation, empty: t('Not established from the available evidence.') },
  ] as const;
  return (
    <SectionShell eyebrow={t('Driving Force')} title={t('What consistently motivates them')}>
      {section.available ? (
        <div className="flex flex-col gap-gb-xl" data-no-auto-translate>
          <div>
            <div className="flex flex-wrap items-center gap-gb-md">
              <h3 className="font-display text-gb-display-xs sm:text-gb-display-sm font-bold tracking-gb-display-tight text-fg">
                {section.headline}
              </h3>
              {section.isHypothesis ? (
                <Badge variant="neutral-chip">{t('Emerging hypothesis')}</Badge>
              ) : null}
            </div>
            <p className="mt-gb-sm text-gb-base sm:text-gb-md leading-relaxed text-fg-secondary">{narrative?.strategicInterpretation ?? section.explanation}</p>
          </div>

          <div className="grid gap-gb-lg sm:grid-cols-2">
            {components.map(({ key, label, value, empty }) => {
              const hasContent = Array.isArray(value) ? value.length > 0 : Boolean(value);
              const limitation = section.componentLimitations?.[key];
              return (
                <div key={key} className="flex flex-col gap-gb-sm rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
                  <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{label}</p>
                  {hasContent && Array.isArray(value) ? (
                    <ul className="flex list-disc flex-col gap-gb-xs pl-gb-lg text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
                      {value.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  ) : hasContent ? (
                    <p className="text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">{value}</p>
                  ) : limitation ? (
                    <InsufficientDataCard data={limitation} returnTo={returnTo} onAnswered={onAnswered} />
                  ) : (
                    <p className="text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">{empty}</p>
                  )}
                </div>
              );
            })}
          </div>
          {section.missingPersonalGrounding ? (
            <p className="rounded-gb-xl border border-line bg-surface-muted/60 p-6 text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
              {section.missingPersonalGrounding}
            </p>
          ) : null}
          {section.reflectionPrompt ? (
            <div className="flex flex-wrap items-center justify-between gap-gb-md rounded-gb-xl border border-line bg-surface-muted/60 p-6">
              <p className="text-gb-sm sm:text-gb-base text-fg-secondary">{section.reflectionPrompt}</p>
              {onAnswered ? (
                <InlineAnswerAction
                  label="Answer this"
                  fieldKey={STUDY_MOTIVATION_SUPPLEMENT_KEY}
                  onAnswered={onAnswered}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-gb-lg" data-no-auto-translate>
          <div className="rounded-gb-xl border border-dashed border-line bg-surface-muted/50 p-6 text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">
            {t('The Motivation Landscape remains visible, but the current record does not support a substantive conclusion yet.')}
          </div>
          <div className="grid gap-gb-lg sm:grid-cols-2">
            {[
              [t('Primary motivation'), t('Not established from the available evidence.')],
              [t('Repeated choices'), t('No repeated opportunity choice is established yet.')],
              [t('Recurring problems'), t('No recurring problem domain is established yet.')],
              [t('Decision-making'), t('No decision-making pattern is established yet.')],
              [t('Underlying values'), t('Values cannot be interpreted confidently yet.')],
            ].map(([label, value]) => (
              <div key={label} className="rounded-gb-xl border border-line bg-surface p-6 shadow-xs">
                <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{label}</p>
                <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">{value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-gb-xl border border-line bg-surface-muted/60 p-6">
            <p className="text-gb-xs font-bold uppercase tracking-wider text-fg-brand">{t('Strategic interpretation')}</p>
            <p className="mt-gb-xs text-gb-sm sm:text-gb-base leading-relaxed text-fg-secondary">{t('Add a detailed motivation and activity reflection before interpreting the applicant\'s values or strategic direction.')}</p>
          </div>
          <InsufficientDataCard data={section.insufficientData!} returnTo={returnTo} onAnswered={onAnswered} />
        </div>
      )}
    </SectionShell>
  );
}
