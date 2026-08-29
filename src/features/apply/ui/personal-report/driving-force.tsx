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
  return (
    <SectionShell eyebrow={t('Driving Force')} title={t('What consistently motivates them')} confidence={section.confidence}>
      {section.available ? (
        <div className="flex flex-col gap-gb-lg" data-no-auto-translate>
          <div className="flex flex-wrap items-center gap-gb-md">
            <h3 className="font-display text-gb-display-xs font-semibold tracking-gb-display-tight text-fg">
              {section.headline}
            </h3>
            {section.isHypothesis ? (
              <Badge variant="neutral-chip">{t('Emerging hypothesis')}</Badge>
            ) : null}
          </div>
          <p className="text-gb-md leading-relaxed text-fg-tertiary">{narrative?.strategicInterpretation ?? section.explanation}</p>
          {narrative ? (
            <div className="grid gap-gb-md border-t border-line pt-gb-xl sm:grid-cols-3">
              <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-lg">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Primary motivation')}</p>
                <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg">{narrative.primaryMotivation}</p>
              </div>
              <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-lg">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Repeated choices')}</p>
                <ul className="mt-gb-sm flex list-disc flex-col gap-gb-xs pl-gb-lg text-gb-sm text-fg-tertiary">
                  {narrative.repeatedChoices.map((choice) => <li key={choice}>{choice}</li>)}
                </ul>
              </div>
              <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-lg">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Underlying values')}</p>
                <ul className="mt-gb-sm flex list-disc flex-col gap-gb-xs pl-gb-lg text-gb-sm text-fg-tertiary">
                  {narrative.underlyingValues.map((value) => <li key={value}>{value}</li>)}
                </ul>
              </div>
              {narrative.recurringProblems.length > 0 ? (
                <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-lg sm:col-span-3">
                  <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">{t('Recurring problems')}</p>
                  <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-tertiary">{narrative.recurringProblems.join(' · ')}</p>
                </div>
              ) : null}
            </div>
          ) : section.repeatedMotivations.length > 0 ? (
            <div className="grid gap-gb-md border-t border-line pt-gb-xl sm:grid-cols-2">
              <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-lg">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {t('Primary motivation')}
                </p>
                <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg">{section.repeatedMotivations[0]}</p>
              </div>
              <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-lg">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {t('Repeated motivation signals')}
                </p>
                <ul className="mt-gb-sm flex list-disc flex-col gap-gb-xs pl-gb-lg text-gb-sm text-fg-tertiary">
                  {section.repeatedMotivations.map((motivation, index) => (
                    <li key={`${motivation}-${index}`}>{motivation}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-gb-xl border border-line bg-surface-muted p-gb-lg sm:col-span-2">
                <p className="text-gb-xs font-semibold uppercase tracking-wide text-fg-muted">
                  {t('Strategic interpretation')}
                </p>
                <p className="mt-gb-sm text-gb-sm leading-relaxed text-fg-tertiary">{section.explanation}</p>
              </div>
            </div>
          ) : null}
          {section.missingPersonalGrounding ? (
            <p className="rounded-gb-xl bg-surface-muted p-gb-lg text-gb-sm text-fg-tertiary">
              {section.missingPersonalGrounding}
            </p>
          ) : null}
          {section.reflectionPrompt ? (
            <div className="flex flex-wrap items-center justify-between gap-gb-md rounded-gb-xl border border-line bg-surface-muted p-gb-lg">
              <p className="text-gb-sm text-fg-tertiary">{section.reflectionPrompt}</p>
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
        <InsufficientDataCard data={section.insufficientData!} returnTo={returnTo} onAnswered={onAnswered} />
      )}
    </SectionShell>
  );
}
